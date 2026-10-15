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
  {
    file: "routes/auth.ts",
    method: "ALL",
    path: "*",
    mountedAt: "/api/auth",
    public: true,
    reason:
      "Better Auth's own handler (ADR-0007/ADR-0015): this IS the sign-in attempt, so there is no session to authorize yet. NOT YET WIRED: the allowlist (FR-3), invite-only (FR-4) and email_verified (NFR-1) checks in resolveSignIn are not called from the OAuth callback yet, so today any Google account that completes consent would get a session and a members row. That hook is the remaining work of story 3.1; until it lands, keep the OAuth consent screen in Testing mode so only listed test users can consent.",
  },
  {
    file: "routes/sign-in-page.ts",
    method: "GET",
    path: "/",
    mountedAt: "/sign-in",
    public: true,
    reason:
      "Minimal same-origin sign-in page, a staging placeholder for the Epic 4 UI. Public because a sign-in page must be reachable without a session. It shows the session it obtained (member id + effective roles) as the end-to-end proof of the chain; it exposes nothing that get-session does not already expose to the cookie holder.",
  },
  {
    file: "routes/mobile-auth.ts",
    method: "GET",
    path: "/finish",
    mountedAt: "/api/v1/auth/mobile",
    public: true,
    reason:
      "Leg 2 of the mobile hand-off (story 3.3). Public because the system browser reaches it with a cookie session, not an API credential — and it is admitted anyway: sessionMiddleware must have produced an actor (otherwise 400), which means the member already passed allowlist, invite-only and email-verified checks. It mints a single-use code bound to the app's PKCE challenge and the configured redirect URI, and refuses any redirect URI that is not on the list, so it cannot be used as an open redirector.",
  },
  {
    file: "routes/mobile-auth.ts",
    method: "POST",
    path: "/exchange",
    mountedAt: "/api/v1/auth/mobile",
    public: true,
    reason:
      "Leg 3 of the mobile hand-off (story 3.3). Public because the credential IS the payload: a single-use code plus the PKCE verifier that hashes to the challenge bound to it at mint time. Wrong verifier, expired code and already-used code all return one generic invalid_grant (NFR-3) while the precise reason goes to the audit log; the code is stored only as a SHA-256 hash, so a database read cannot be replayed.",
  },
  {
    file: "routes/mobile-auth.ts",
    method: "POST",
    path: "/sign-out",
    mountedAt: "/api/v1/auth/mobile",
    public: true,
    reason:
      "Ends exactly the session the caller presents as a Bearer token — it deletes only the row matching that token, so it can revoke nothing else and grants no access. Returning ok for an unknown token is deliberate: sign-out should be idempotent and must not report whether a token was valid.",
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
