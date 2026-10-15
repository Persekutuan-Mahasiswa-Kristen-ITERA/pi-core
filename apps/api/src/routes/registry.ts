/**
 * Route authorization registry — FR-25 / SM-2 ("0 endpoints without a server-side `can()` check,
 * enforced by a failing test").
 *
 * Every HTTP route the API registers must appear here, either as **public with a written reason**
 * or with the **permission** it requires. `authorization-coverage.test.ts` scans the route files
 * for `.<method>("<path>")` registrations and fails if one is missing from this table, so adding a
 * route without deciding its authorization breaks CI.
 *
 * `file` + `path` are the registration as written in the source (the path is relative to the
 * router); `mountedAt` records where that router is mounted, for readers.
 */
import type { PermissionKey } from "@pi-core/shared";
import type { HttpMethod } from "./scan";

export type { HttpMethod };

export interface RouteAuthorization {
  /** Path of the file under `apps/api/src/`. */
  file: string;
  method: HttpMethod;
  /** The path as registered in that file. */
  path: string;
  /** Where the containing router is mounted, when it is not the root app. */
  mountedAt?: string;
  /** `true` when the route deliberately needs no permission check. */
  public?: true;
  /** Why it is safe to expose without a check. Required whenever `public` is set. */
  reason?: string;
  /** The permission the route requires. Mutually exclusive with `public`. */
  permission?: PermissionKey;
}

export const ROUTE_AUTHORIZATION: readonly RouteAuthorization[] = [
  {
    file: "app.ts",
    method: "GET",
    path: "/",
    public: true,
    reason: "Service banner (name, version, environment). Returns no member data.",
  },
  {
    file: "routes/health.ts",
    method: "GET",
    path: "/health",
    mountedAt: "/api/v1",
    public: true,
    reason:
      "Liveness probe. Returns only { ok, database, role, environment, latencyMs } — no member data — and is also hit by the keep-alive Cron Trigger (ADR-0014).",
  },
];

/** Every registration the coverage test expects to find, as `file METHOD path`. */
export function registryKey(entry: Pick<RouteAuthorization, "file" | "method" | "path">): string {
  return `${entry.file} ${entry.method} ${entry.path}`;
}

export function findAuthorization(
  file: string,
  method: HttpMethod,
  path: string,
): RouteAuthorization | undefined {
  return ROUTE_AUTHORIZATION.find((e) => e.file === file && e.method === method && e.path === path);
}
