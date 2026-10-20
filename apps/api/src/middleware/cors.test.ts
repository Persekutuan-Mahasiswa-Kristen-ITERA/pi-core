import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { AppEnv } from "../env";
import { corsMiddleware, corsResponseMiddleware } from "./cors";

const WEB = "https://web.example.test";

const env = {
  BETTER_AUTH_URL: "https://api.example.test",
  CORS_ORIGINS: WEB,
};

/**
 * The Better Auth handler mounted at `/api/auth` returns a `Response` it built itself. That replaces
 * the object Hono was going to decorate, so headers set with `c.header()` never reached the client and
 * the browser reported `TypeError: Failed to fetch` on the OAuth token exchange — with the server
 * answering correctly. These tests pin the repair.
 */
function appWithRoutes() {
  const app = new Hono<AppEnv>();
  app.use("*", corsMiddleware);
  app.use("*", corsResponseMiddleware);
  // Stands in for the Better Auth handler: a response built outside Hono's context.
  app.post("/raw", () => {
    return new Response(JSON.stringify({ error: "invalid_grant" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  });
  app.get("/json", (c) => c.json({ ok: true }));
  return app;
}

describe("CORS on responses built outside Hono", () => {
  it("adds the allowlist headers to a raw Response", async () => {
    const response = await appWithRoutes().fetch(
      new Request("http://localhost/raw", {
        method: "POST",
        headers: { origin: WEB },
      }),
      env,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("vary")).toBe("Origin");
    // The status and body the route chose must survive the header repair.
    await expect(response.json()).resolves.toEqual({ error: "invalid_grant" });
  });

  it("still decorates ordinary Hono responses", async () => {
    const response = await appWithRoutes().fetch(
      new Request("http://localhost/json", { headers: { origin: WEB } }),
      env,
    );
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
  });

  it("does not invent headers for an origin that is not allowed", async () => {
    const response = await appWithRoutes().fetch(
      new Request("http://localhost/json", {
        headers: { origin: "https://evil.example.test" },
      }),
      env,
    );
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers a preflight with the allowlist headers", async () => {
    const response = await appWithRoutes().fetch(
      new Request("http://localhost/raw", { method: "OPTIONS", headers: { origin: WEB } }),
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
  });
});
