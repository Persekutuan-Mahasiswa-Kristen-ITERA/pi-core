/**
 * FR-25 / SM-2 — "0 endpoints without a server-side `can()` check (enforced by a failing test)".
 *
 * Scans `apps/api/src` for every `.<method>("<path>")` call and classifies it:
 *
 *  - called on a **router** (`app`, `*Routes`, `*Router`) → it is an HTTP route and must be declared
 *    in `registry.ts`, either public-with-a-reason or guarded by a permission;
 *  - called on anything else → it must be listed in `NON_ROUTE_CALLS` below, so a `c.get("actor")`
 *    style context read is a deliberate entry rather than a silent hole in the scan.
 *
 * Add a route and forget to decide its authorization, and this suite fails.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_AUTHORIZATION, findAuthorization } from "./registry";
import { ROUTER_RECEIVER, findRegistrationsInSource, type Registration } from "./scan";

const SRC = join(import.meta.dirname, "..");

/**
 * Calls that look like a route registration but are not. Kept explicit so a new one is a decision,
 * not a silent miss.
 */
const NON_ROUTE_CALLS: readonly string[] = [
  // Hono context reads inside middleware / handlers, not routes.
  "middleware/authorization.ts GET actor",
  "middleware/session.ts GET requestId",
  "routes/auth.ts GET auth",
  "routes/sign-in-page.ts GET actor",
  "routes/sign-in-page.ts GET sessionEmail",
  "routes/mobile-auth.ts GET db",
  "routes/mobile-auth.ts GET actor",
  "routes/mobile-auth.ts GET requestId",
  "app.ts GET requestId",
  "http/errors.ts GET requestId",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function findCalls(): Registration[] {
  return sourceFiles(SRC).flatMap((file) =>
    findRegistrationsInSource(relative(SRC, file), readFileSync(file, "utf8")),
  );
}

const calls = findCalls();
const routes = calls.filter((c) => ROUTER_RECEIVER.test(c.receiver));
const nonRoutes = calls.filter((c) => !ROUTER_RECEIVER.test(c.receiver));
const key = (c: Registration) => `${c.file} ${c.method} ${c.path}`;

describe("route authorization coverage (FR-25, SM-2)", () => {
  it("finds the routes the API actually registers", () => {
    // Guards against the scanner silently matching nothing, which would make this suite vacuous.
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.map(key)).toContain("app.ts GET /");
    expect(routes.map(key)).toContain("routes/health.ts GET /health");
  });

  it("declares every registered route in the registry", () => {
    const undeclared = routes.filter((r) => findAuthorization(r.file, r.method, r.path) === undefined).map(key);
    expect(undeclared, "add these to apps/api/src/routes/registry.ts").toEqual([]);
  });

  it("classifies every non-router call explicitly", () => {
    const unclassified = nonRoutes.map(key).filter((k) => !NON_ROUTE_CALLS.includes(k));
    expect(unclassified, "add these to NON_ROUTE_CALLS (with a reason) or fix the receiver name").toEqual([]);
  });

  it("does not keep stale NON_ROUTE_CALLS entries", () => {
    const found = nonRoutes.map(key);
    const stale = NON_ROUTE_CALLS.filter((k) => !found.includes(k));
    expect(stale).toEqual([]);
  });

  it("requires every non-public route to name a permission", () => {
    for (const entry of ROUTE_AUTHORIZATION) {
      if (entry.public === true) continue;
      expect(entry.permission, `${entry.file} ${entry.method} ${entry.path}`).toBeDefined();
    }
  });

  it("requires every public route to carry a written reason", () => {
    for (const entry of ROUTE_AUTHORIZATION) {
      if (entry.public !== true) continue;
      expect(entry.reason, `${entry.file} ${entry.method} ${entry.path}`).toBeTruthy();
    }
  });

  it("never marks a route both public and permission-guarded", () => {
    for (const entry of ROUTE_AUTHORIZATION) {
      expect(
        entry.public === true && entry.permission !== undefined,
        `${entry.file} ${entry.method} ${entry.path}`,
      ).toBe(false);
    }
  });

  it("does not list routes that no longer exist", () => {
    const registered = new Set(routes.map(key));
    const stale = ROUTE_AUTHORIZATION.filter((e) => !registered.has(`${e.file} ${e.method} ${e.path}`)).map(
      (e) => `${e.file} ${e.method} ${e.path}`,
    );
    expect(stale, "remove these from apps/api/src/routes/registry.ts").toEqual([]);
  });
});
