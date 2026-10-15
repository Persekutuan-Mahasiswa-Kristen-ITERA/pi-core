/**
 * The rate limiter (FR-53), tested directly rather than through a real endpoint.
 *
 * The point of testing it in isolation is that the limit has to be provably enforced *and* provably
 * released — a limiter that never resets is an outage waiting for traffic, and one that never counts is
 * decoration.
 */
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { toErrorResponse } from "../http/errors";
import type { AppEnv } from "../env";
import { rateLimit } from "./rate-limit";

function buildApp(limit: number, windowMs: number) {
  const app = new Hono<AppEnv>();
  app.use("*", rateLimit({ limit, windowMs, scope: "test", key: () => "fixed-key" }));
  app.get("/", (c) => c.json({ ok: true }));
  // Mirrors the real app: without this a thrown ApiError would surface as Hono's default 500.
  app.onError((err, c) => toErrorResponse(c, err));
  return app;
}

const env = {} as AppEnv["Bindings"];

describe("story 4.1 — rate limiting", () => {
  it("allows up to the limit, then answers 429 with the uniform envelope and Retry-After", async () => {
    const app = buildApp(3, 60_000);

    for (let i = 0; i < 3; i += 1) {
      const res = await app.request("/", {}, env);
      expect(res.status).toBe(200);
    }

    const blocked = await app.request("/", {}, env);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");

    const body = (await blocked.json()) as { error: { code: string; message: string; requestId: string } };
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.message).toContain("test");
    expect(typeof body.error.requestId).toBe("string");
  });

  it("releases the window once it has passed", async () => {
    const app = buildApp(1, 30);
    expect((await app.request("/", {}, env)).status).toBe(200);
    expect((await app.request("/", {}, env)).status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 45));
    expect((await app.request("/", {}, env)).status).toBe(200);
  });

  it("keys independently, so one caller cannot exhaust another's budget", async () => {
    const app = new Hono<AppEnv>();
    app.use(
      "*",
      rateLimit({
        limit: 1,
        windowMs: 60_000,
        scope: "test",
        key: (c) => c.req.header("x-caller") ?? "none",
      }),
    );
    app.get("/", (c) => c.json({ ok: true }));

    expect((await app.request("/", { headers: { "x-caller": "a" } }, env)).status).toBe(200);
    expect((await app.request("/", { headers: { "x-caller": "a" } }, env)).status).toBe(429);
    expect((await app.request("/", { headers: { "x-caller": "b" } }, env)).status).toBe(200);
  });
});
