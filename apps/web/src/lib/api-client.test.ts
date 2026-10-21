/**
 * `apiFetch` — the one place the admin web reaches the API.
 *
 * The behaviour worth pinning is the 401 path, because everything about it is invisible when it goes
 * wrong: no retry means a session dies at the first expiry, a retry loop hammers the token endpoint,
 * and three widgets refreshing at once spend three refresh tokens when the provider rotates them (so
 * two of them fail and the page half-loads). The tests drive exactly those three cases.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshTokens = vi.fn();
const storedRefreshToken = vi.fn();
const persistTokens = vi.fn();
const clearTokens = vi.fn();

vi.mock("./oidc", () => ({
  API_BASE_URL: "https://api.test",
  persistTokens: (...args: unknown[]) => persistTokens(...args),
  clearTokens: () => clearTokens(),
  storedRefreshToken: () => storedRefreshToken(),
  refreshTokens: (token: string) => refreshTokens(token) as Promise<unknown>,
}));

const { apiFetch, hasSessionToken, renewSession, setSessionTokens } = await import("./api-client");

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  refreshTokens.mockReset();
  storedRefreshToken.mockReset();
  persistTokens.mockReset();
  clearTokens.mockReset();
  // `sessionStorage.getItem` returns null when absent; a mock that returns undefined would send
  // `renewSession` down the "there is a token" path with nothing to spend.
  storedRefreshToken.mockReturnValue(null);
  setSessionTokens(null);
  // Resetting the session above already called these; start each test with clean call counts.
  persistTokens.mockClear();
  clearTokens.mockClear();
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
});

function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as unknown as Response;
}

describe("apiFetch", () => {
  it("sends the bearer token and asks for JSON", async () => {
    setSessionTokens({ accessToken: "at-1", refreshToken: "rt-1", expiresAt: Date.now() + 60_000 });
    fetchMock.mockResolvedValue(response(200));

    await apiFetch("/api/v1/members");

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(url).toBe("https://api.test/api/v1/members");
    expect(init.headers.get("authorization")).toBe("Bearer at-1");
    expect(init.headers.get("accept")).toBe("application/json");
  });

  it("sends no authorization header when there is no session", async () => {
    setSessionTokens(null);
    fetchMock.mockResolvedValue(response(401));

    await apiFetch("/api/v1/members");

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get("authorization")).toBeNull();
  });

  it("keeps the caller's own headers", async () => {
    setSessionTokens({ accessToken: "at-1", refreshToken: "rt-1", expiresAt: Date.now() + 60_000 });
    fetchMock.mockResolvedValue(response(200));

    await apiFetch("/api/v1/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers; method: string }];
    expect(init.headers.get("content-type")).toBe("application/json");
    expect(init.method).toBe("POST");
  });

  it("renews once on 401 and retries with the new token", async () => {
    setSessionTokens({ accessToken: "stale", refreshToken: "rt-1", expiresAt: Date.now() - 1 });
    storedRefreshToken.mockReturnValue("rt-1");
    refreshTokens.mockResolvedValue({ accessToken: "fresh", refreshToken: "rt-2", expiresAt: Date.now() + 60_000 });
    fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200));

    const result = await apiFetch("/api/v1/members");

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondHeaders = (fetchMock.mock.calls[1] as [string, { headers: Headers }])[1].headers;
    expect(secondHeaders.get("authorization")).toBe("Bearer fresh");
  });

  it("does not loop when the retried request is also refused", async () => {
    setSessionTokens({ accessToken: "stale", refreshToken: "rt-1", expiresAt: Date.now() - 1 });
    storedRefreshToken.mockReturnValue("rt-1");
    refreshTokens.mockResolvedValue({ accessToken: "still-bad", refreshToken: "rt-2", expiresAt: Date.now() + 60_000 });
    fetchMock.mockResolvedValue(response(401));

    const result = await apiFetch("/api/v1/members");

    expect(result.status).toBe(401);
    // Exactly two sends and one refresh: a second 401 means the credential is genuinely unusable.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
  });

  it("returns the 401 as-is when there is no refresh token to spend", async () => {
    setSessionTokens({ accessToken: "at-1", refreshToken: null, expiresAt: Date.now() + 60_000 });
    storedRefreshToken.mockReturnValue(null);
    fetchMock.mockResolvedValue(response(401));

    const result = await apiFetch("/api/v1/members");

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("shares one refresh between concurrent callers", async () => {
    setSessionTokens({ accessToken: "stale", refreshToken: "rt-1", expiresAt: Date.now() - 1 });
    storedRefreshToken.mockReturnValue("rt-1");
    refreshTokens.mockResolvedValue({ accessToken: "fresh", refreshToken: "rt-2", expiresAt: Date.now() + 60_000 });
    fetchMock.mockResolvedValue(response(401));

    await Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);

    // The provider rotates refresh tokens: three parallel refreshes would invalidate two of them.
    expect(refreshTokens).toHaveBeenCalledTimes(1);
  });
});

describe("renewSession", () => {
  it("reports failure and forgets the session when the refresh is rejected", async () => {
    setSessionTokens({ accessToken: "at", refreshToken: "rt", expiresAt: Date.now() - 1 });
    storedRefreshToken.mockReturnValue("rt");
    refreshTokens.mockRejectedValue(new Error("invalid_grant"));

    await expect(renewSession()).resolves.toBe(false);

    expect(clearTokens).toHaveBeenCalled();
    expect(hasSessionToken()).toBe(false);
  });

  it("reports failure without a request when no refresh token is stored", async () => {
    storedRefreshToken.mockReturnValue(null);

    await expect(renewSession()).resolves.toBe(false);
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("keeps the refreshed session in memory on success", async () => {
    storedRefreshToken.mockReturnValue("rt-1");
    refreshTokens.mockResolvedValue({ accessToken: "at-2", refreshToken: "rt-2", expiresAt: Date.now() + 60_000 });

    await expect(renewSession()).resolves.toBe(true);

    expect(hasSessionToken()).toBe(true);
    expect(refreshTokens).toHaveBeenCalledWith("rt-1");
    // Persisting the rotated refresh token is `refreshTokens`' job inside `oidc.ts`; here it is mocked,
    // so the assertion that matters is that the in-memory session is usable again.
    expect(clearTokens).not.toHaveBeenCalled();
  });
});

describe("setSessionTokens", () => {
  it("clears storage when the session ends", () => {
    setSessionTokens({ accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 1000 });

    setSessionTokens(null);

    expect(clearTokens).toHaveBeenCalled();
    expect(hasSessionToken()).toBe(false);
  });
});
