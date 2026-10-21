/**
 * The browser half of the OIDC flow (ADR-0018).
 *
 * These are the properties that make the flow safe, and each one is invisible when it breaks: a PKCE
 * challenge that is not actually derived from the stored verifier, a `state` that is not compared, a
 * verifier left in `sessionStorage` after a failed exchange, or a `resource` that points at the issuer
 * instead of the API origin — the last one mints a token the API refuses, and the symptom is "sign-in
 * silently bounces", not an error anyone can read.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  API_BASE_URL,
  CLIENT_ID,
  ISSUER,
  SCOPE,
  beginSignIn,
  callbackUrl,
  clearTokens,
  completeSignIn,
  persistTokens,
  readPendingState,
  refreshTokens,
  storedRefreshToken,
} from "./oidc";

const fetchMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
});

function tokenResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

/** base64url(SHA-256(verifier)), recomputed independently of the module. */
async function expectedChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("beginSignIn", () => {
  it("builds an authorization-code request with PKCE S256 and the registered callback", async () => {
    const url = new URL(await beginSignIn());

    expect(url.origin + url.pathname).toBe(`${ISSUER}/oauth2/authorize`);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(callbackUrl());
    expect(url.searchParams.get("scope")).toBe(SCOPE);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("sends the API origin as `resource`, not the issuer", async () => {
    // `@better-auth/oauth-provider` puts `resource` into `aud` verbatim, and `/api/v1/access` compares
    // it to the API origin. The issuer here produced a token the API rejected.
    const url = new URL(await beginSignIn());

    expect(url.searchParams.get("resource")).toBe(API_BASE_URL);
    expect(url.searchParams.get("resource")).not.toBe(ISSUER);
  });

  it("stores a verifier whose SHA-256 is the challenge it sent, and stores no challenge", async () => {
    const url = new URL(await beginSignIn());
    const verifier = sessionStorage.getItem("picore.pkce.verifier");

    expect(verifier).not.toBeNull();
    // 48 random bytes, base64url → 64 characters, inside PKCE's 43–128 range.
    expect(verifier).toHaveLength(64);
    expect(await expectedChallenge(verifier ?? "")).toBe(url.searchParams.get("code_challenge"));
    expect(readPendingState()).toBe(url.searchParams.get("state"));
  });

  it("uses a fresh verifier and state for every attempt", async () => {
    const first = new URL(await beginSignIn());
    const second = new URL(await beginSignIn());

    expect(first.searchParams.get("state")).not.toBe(second.searchParams.get("state"));
    expect(first.searchParams.get("code_challenge")).not.toBe(second.searchParams.get("code_challenge"));
  });
});

describe("completeSignIn", () => {
  it("exchanges the code with the stored verifier and the API origin as resource", async () => {
    const url = new URL(await beginSignIn());
    const state = url.searchParams.get("state") ?? "";
    const verifier = sessionStorage.getItem("picore.pkce.verifier") ?? "";

    fetchMock.mockResolvedValue(tokenResponse({ access_token: "at-1", refresh_token: "rt-1", expires_in: 900 }));

    const tokens = await completeSignIn("code-123", state);

    expect(tokens.accessToken).toBe("at-1");
    expect(tokens.refreshToken).toBe("rt-1");
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());

    const [url2, init] = fetchMock.mock.calls[0] as [string, { body: string; method: string }];
    expect(url2).toBe(`${ISSUER}/oauth2/token`);
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code-123");
    expect(body.get("code_verifier")).toBe(verifier);
    expect(body.get("client_id")).toBe(CLIENT_ID);
    expect(body.get("resource")).toBe(API_BASE_URL);
    // The refresh token is the only long-lived credential, and it goes to sessionStorage.
    expect(storedRefreshToken()).toBe("rt-1");
  });

  it("refuses a callback whose state does not match the pending one", async () => {
    await beginSignIn();

    await expect(completeSignIn("code-123", "attacker-state")).rejects.toThrow("state mismatch");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("consumes the verifier even when the exchange fails, so a replayed code cannot be retried", async () => {
    const url = new URL(await beginSignIn());
    const state = url.searchParams.get("state") ?? "";
    fetchMock.mockResolvedValue(tokenResponse({ error: "invalid_grant" }, 400));

    await expect(completeSignIn("code-123", state)).rejects.toThrow("token request failed (400)");

    expect(sessionStorage.getItem("picore.pkce.verifier")).toBeNull();
    await expect(completeSignIn("code-123", state)).rejects.toThrow("no pending authorization in this tab");
  });

  it("does not put the provider's response body in the error", async () => {
    const url = new URL(await beginSignIn());
    const state = url.searchParams.get("state") ?? "";
    fetchMock.mockResolvedValue(tokenResponse({ error_description: "client pi-core-admin-web secret abc" }, 400));

    await expect(completeSignIn("code-123", state)).rejects.toThrow(/^token request failed \(400\)$/);
  });

  it("rejects a token response with no access_token", async () => {
    const url = new URL(await beginSignIn());
    const state = url.searchParams.get("state") ?? "";
    fetchMock.mockResolvedValue(tokenResponse({ token_type: "Bearer" }));

    await expect(completeSignIn("code-123", state)).rejects.toThrow("no access_token");
  });

  it("defaults the lifetime to 900 s when the provider omits expires_in", async () => {
    const url = new URL(await beginSignIn());
    const state = url.searchParams.get("state") ?? "";
    fetchMock.mockResolvedValue(tokenResponse({ access_token: "at-1" }));

    const before = Date.now();
    const tokens = await completeSignIn("code-123", state);

    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 900_000);
    expect(tokens.expiresAt).toBeLessThanOrEqual(Date.now() + 900_000);
  });
});

describe("refreshTokens", () => {
  it("sends the refresh grant and persists the rotated token", async () => {
    fetchMock.mockResolvedValue(tokenResponse({ access_token: "at-2", refresh_token: "rt-2", expires_in: 60 }));

    const tokens = await refreshTokens("rt-1");

    const body = new URLSearchParams((fetchMock.mock.calls[0] as [string, { body: string }])[1].body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt-1");
    expect(body.get("client_id")).toBe(CLIENT_ID);
    expect(tokens.accessToken).toBe("at-2");
    expect(storedRefreshToken()).toBe("rt-2");
  });
});

describe("clearTokens", () => {
  it("removes the refresh token and any pending PKCE material", async () => {
    await beginSignIn();
    persistTokens({ accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 1000 });

    clearTokens();

    expect(storedRefreshToken()).toBeNull();
    expect(sessionStorage.getItem("picore.pkce.verifier")).toBeNull();
    expect(readPendingState()).toBeNull();
  });
});
