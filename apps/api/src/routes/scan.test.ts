/**
 * The scanner must actually find things — a scan that silently matches nothing would make the
 * coverage suite vacuous and let an unauthorized route ship.
 */
import { describe, expect, it } from "vitest";
import { findRegistrationsInSource, ROUTER_RECEIVER } from "./scan";

const key = (r: { receiver: string; method: string; path: string }) => `${r.receiver} ${r.method} ${r.path}`;

describe("findRegistrationsInSource()", () => {
  it("finds a single-method registration", () => {
    const found = findRegistrationsInSource("app.ts", 'app.get("/", (c) => c.json({}));');
    expect(found.map(key)).toEqual(["app GET /"]);
  });

  it("finds a multi-method registration mounted with .on()", () => {
    const source = 'app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));';
    const found = findRegistrationsInSource("app.ts", source);
    expect(found.map(key).sort()).toEqual(["app GET /api/auth/*", "app POST /api/auth/*"]);
  });

  it("finds a registration mounted with .all() — how a library handler is attached in Hono", () => {
    const source = 'app.all("/api/auth/*", (c) => auth.handler(c.req.raw));';
    const found = findRegistrationsInSource("app.ts", source);
    expect(found.map(key)).toEqual(["app ALL /api/auth/*"]);
  });

  it("finds a registration on a router-named object", () => {
    const found = findRegistrationsInSource("routes/health.ts", 'healthRoutes.get("/health", handler);');
    expect(found.map(key)).toEqual(["healthRoutes GET /health"]);
  });

  it("ignores non-router calls such as reading a context variable", () => {
    const found = findRegistrationsInSource("middleware/authorization.ts", 'const actor = c.get("actor");');
    expect(found.map(key)).toEqual(["c GET actor"]);
    // …and the receiver test is what separates it from a real route.
    expect(ROUTER_RECEIVER.test("c")).toBe(false);
    expect(ROUTER_RECEIVER.test("app")).toBe(true);
    expect(ROUTER_RECEIVER.test("healthRoutes")).toBe(true);
    expect(ROUTER_RECEIVER.test("authRouter")).toBe(true);
  });

  it("finds every method and path in a realistic file", () => {
    const source = [
      'import { Hono } from "hono";',
      'export const routes = new Hono();',
      'routes.get("/members", list);',
      'routes.post("/members", create);',
      'routes.patch("/members/:id", update);',
      'routes.delete("/members/:id", remove);',
      'app.on(["GET", "POST"], "/api/auth/*", handler);',
    ].join("\n");
    const found = findRegistrationsInSource("routes/members.ts", source);
    expect(found.map(key).sort()).toEqual([
      "app GET /api/auth/*",
      "app POST /api/auth/*",
      "routes DELETE /members/:id",
      "routes GET /members",
      "routes PATCH /members/:id",
      "routes POST /members",
    ]);
  });

  it("ignores a .on() whose method list contains no HTTP method", () => {
    const found = findRegistrationsInSource("app.ts", 'thing.on(["ready", "close"], "/x", h);');
    expect(found).toEqual([]);
  });

  it("ignores registrations that only appear in comments", () => {
    const source = [
      "/**",
      ' *   router.get("/path", handler)',
      ' *   app.on(["POST", "GET"], "/api/auth/*", h)',
      " */",
      '// app.delete("/documented-only", h);',
      'app.get("/real", handler);',
    ].join("\n");
    const found = findRegistrationsInSource("scan.ts", source);
    expect(found.map(key)).toEqual(["app GET /real"]);
  });

  it("keeps a URL inside a string from being treated as a comment", () => {
    const source = 'app.get("https://example.com/x", handler);';
    const found = findRegistrationsInSource("app.ts", source);
    expect(found.map(key)).toEqual(["app GET https://example.com/x"]);
  });

  it("returns nothing for source with no registrations", () => {
    expect(findRegistrationsInSource("empty.ts", "export const x = 1;")).toEqual([]);
  });
});
