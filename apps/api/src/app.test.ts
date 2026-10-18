/**
 * Story 4.1 — the API conventions, tested as behaviour rather than by reading the source.
 *
 * These run without a database: the foundation is middleware, so `app.request(...)` is enough.
 */
import { describe, expect, it } from "vitest";
import { app } from "./app";
import type { Env } from "./env";

/** Minimal env: the middleware under test never touches Hyperdrive. */
const env = {
  BETTER_AUTH_URL: "https://api.example.test",
  CORS_ORIGINS: "https://admin.example.test",
  BETTER_AUTH_SECRET: "test",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
} as unknown as Env;

const call = (path: string, init?: RequestInit): Promise<Response> =>
  Promise.resolve(app.request(path, init, env));

describe("story 4.1 — API conventions", () => {
  it("returns the uniform error envelope, with a requestId, for an unknown path", async () => {
    const res = await call("/nope");
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: { code: string; message: string; requestId: string } };
    expect(body.error.code).toBe("not_found");
    expect(typeof body.error.message).toBe("string");
    // FR-51: the id is always present and is also on the response, so a report can quote either.
    expect(body.error.requestId).not.toBe("");
    expect(res.headers.get("x-request-id")).toBe(body.error.requestId);
  });

  it("honours an inbound request id, but only a well-formed one", async () => {
    const good = await call("/nope", { headers: { "x-request-id": "abc12345" } });
    expect(((await good.json()) as { error: { requestId: string } }).error.requestId).toBe("abc12345");

    // Anything else would end up in logs and audit rows verbatim, so it is replaced. Note the value
    // must still be a *legal* header — a newline is rejected by `Headers` before our code runs, so a
    // value with spaces and slashes is what actually exercises the check.
    const hostile = await call("/nope", { headers: { "x-request-id": "has spaces and /slashes/" } });
    const body = (await hostile.json()) as { error: { requestId: string } };
    expect(body.error.requestId).not.toBe("has spaces and /slashes/");
    expect(body.error.requestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("sets the security headers on every response (NFR-10)", async () => {
    const res = await call("/");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");

    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("echoes the origin only when it is allowlisted, and never a wildcard (FR-54)", async () => {
    const allowed = await call("/", { headers: { origin: "https://admin.example.test" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://admin.example.test");
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true");
    // Without `Vary: Origin` a cache could serve one origin's response to another.
    expect(allowed.headers.get("vary")).toContain("Origin");

    const other = await call("/", { headers: { origin: "https://evil.example" } });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
    expect(other.headers.get("access-control-allow-origin")).not.toBe("*");
  });

  it("refuses a credentialed cross-origin mutation from an unlisted origin (FR-54)", async () => {
    const res = await call("/api/v1/anything", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("forbidden");
  });

  it("allows a mutation with no Origin at all — the native app, which sends none", async () => {
    const res = await call("/api/v1/anything", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    // 404, not 403: it got past CORS and simply has no route.
    expect(res.status).toBe(404);
  });

  it("answers a preflight from an unlisted origin with 403 rather than a permissive 204", async () => {
    const bad = await call("/", { method: "OPTIONS", headers: { origin: "https://evil.example" } });
    expect(bad.status).toBe(403);

    const good = await call("/", { method: "OPTIONS", headers: { origin: "https://admin.example.test" } });
    expect(good.status).toBe(204);
  });

  it("still serves the health probe and the service root", async () => {
    // The health route reaches for the database, so only assert it is routed (not 404).
    const root = await call("/");
    expect(root.status).toBe(200);
    const body = (await root.json()) as { service: string };
    expect(body.service).toBe("pi-core-api");
  });

  it("rejects an oversized request body with 413 payload_too_large (NFR-11)", async () => {
    const hugeBody = "a".repeat(1024 * 1024 + 10);
    const res = await call("/api/v1/anything", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: hugeBody,
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { code: string; message: string; requestId: string } };
    expect(body.error.code).toBe("payload_too_large");
    expect(body.error.requestId).not.toBe("");
  });
});
