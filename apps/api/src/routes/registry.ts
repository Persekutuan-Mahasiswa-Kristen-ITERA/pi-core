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
  {
    file: "routes/members.ts",
    method: "GET",
    path: "/",
    mountedAt: "/api/v1/members",
    permission: "member:read",
    reason:
      "List members. Guarded by member:read, and the actor's scope is applied inside the SQL (FR-26) rather than by filtering the result, so no code path can return a row the scope excluded. Sensitive columns (NIM, phone) are only selected when the actor holds member:read_sensitive (FR-9); the response says whether they were included instead of leaving the client to guess.",
  },
  {
    file: "routes/members.ts",
    method: "GET",
    path: "/:id",
    mountedAt: "/api/v1/members",
    permission: "member:read",
    reason:
      "One member, same scope rules as the list. A member outside the actor's scope answers 404 rather than 403, deliberately: a distinct forbidden would confirm the id exists, which is the enumeration the scoping exists to prevent (FR-8).",
  },
  {
    file: "routes/members.ts",
    method: "POST",
    path: "/",
    mountedAt: "/api/v1/members",
    permission: "member:create",
    reason:
      "Create a member (FR-10). Guarded by member:create; the body is a .strict() zod schema so an unknown field is rejected rather than dropped — silently ignoring status or googleSub is how mass assignment gets in. A duplicate email is answered as a conflict, not a 500, and every creation writes an audit row (FR-43).",
  },
  {
    file: "routes/members.ts",
    method: "PATCH",
    path: "/:id",
    mountedAt: "/api/v1/members",
    permission: "profile:update_own",
    reason:
      "Update a member (FR-11). The route guard is the SELF form of profile:update_own — which every member holds — because the real rule is per-field and lives in updateMember: a member may change their own phone and photo, and anything else needs member:update with its own scope. Checking only profile:update_own here would let a member set their own status or email, so the field allow-list is the actual control. Audited (FR-43), and an out-of-scope member is 'not found' rather than updatable.",
  },
  {
    file: "routes/members.ts",
    method: "POST",
    path: "/:id/deactivate",
    mountedAt: "/api/v1/members",
    permission: "member:deactivate",
    reason:
      "Soft-delete a member (FR-12) and end their access (FR-5). Guarded by member:deactivate. The row is never hard-deleted — assignments and audit rows reference it — so status becomes inactive and deleted_at is set; the member's sessions are deleted in the same call and the count is returned, so the caller can see that access actually ended rather than merely that a column changed. Audited (FR-43).",
  },
  {
    file: "routes/periods.ts",
    method: "GET",
    path: "/",
    mountedAt: "/api/v1/periods",
    permission: "period:read",
    reason:
      "List periods and report which is active (FR-22's filter needs to know). Guarded by period:read; a period is not personal data, so there is no scope narrowing beyond the permission.",
  },
  {
    file: "routes/periods.ts",
    method: "POST",
    path: "/",
    mountedAt: "/api/v1/periods",
    permission: "period:manage",
    reason:
      "Create a period (FR-19). Guarded by period:manage, body is a .strict() zod schema with ISO dates only (the column is a date, so accepting a timestamp invites timezone surprises), and the new period is deliberately NOT active — activation is a separate audited decision, and creating a period must not silently change everyone's access. Audited (FR-43).",
  },
  {
    file: "routes/periods.ts",
    method: "PATCH",
    path: "/:id",
    mountedAt: "/api/v1/periods",
    permission: "period:manage",
    reason:
      "Edit a period's label or dates (FR-19). Guarded by period:manage; the date range is re-checked after merging with the stored row, so a partial update cannot produce an end before a start. Audited (FR-43).",
  },
  {
    file: "routes/periods.ts",
    method: "POST",
    path: "/:id/activate",
    mountedAt: "/api/v1/periods",
    permission: "period:activate",
    reason:
      "Activate a period (FR-20, FR-21). Guarded by period:activate, which is a separate permission from period:manage on purpose. Deactivate-then-activate inside ONE transaction: the partial unique index permits only one active row, so the other order would violate it mid-transaction, and doing the two statements separately would leave a window with no active period during which every scoped query silently returns nothing. One audit row for the whole event, because what matters is that access moved and between which periods.",
  },
  {
    file: "routes/org-units.ts",
    method: "GET",
    path: "/",
    mountedAt: "/api/v1/org-units",
    permission: "orgunit:read",
    reason:
      "Read the organization tree (FR-15). O-scoped by design: the org chart is available to every authenticated member, because it is structure rather than personal data. Inactive units are excluded unless asked for explicitly.",
  },
  {
    file: "routes/org-units.ts",
    method: "POST",
    path: "/",
    mountedAt: "/api/v1/org-units",
    permission: "orgunit:manage",
    reason:
      "Create a unit (FR-16). Guarded by orgunit:manage; the slug is constrained to lowercase-with-hyphens because it appears in the materialised path and is compared; the parent's path is read to compute the new unit's path and depth (FR-18). A duplicate slug under the same parent is a conflict, not a 500. Audited (FR-43).",
  },
  {
    file: "routes/org-units.ts",
    method: "PATCH",
    path: "/:id",
    mountedAt: "/api/v1/org-units",
    permission: "orgunit:manage",
    reason:
      "Rename, reorder or move a unit (FR-16). Guarded by orgunit:manage. A move rewrites the whole subtree's path and depth in ONE statement, because doing it row by row would leave a window where half the subtree has the new path and half the old — silently changing who can see what. Moving a unit under itself or its own descendant is refused explicitly, since a self-referential path chain would make every subtree check match the wrong set. Changing `type` while positions are assigned is refused by the composite FK (FR-30) and mapped to a conflict. Audited (FR-43).",
  },
  {
    file: "routes/org-units.ts",
    method: "POST",
    path: "/:id/deactivate",
    mountedAt: "/api/v1/org-units",
    permission: "orgunit:manage",
    reason:
      "Soft-delete a unit (FR-16) — the only removal offered, because units referenced by assignments must never be hard-deleted. Refused while it still has active children, which would otherwise leave them reachable while their scope path points at a unit no longer part of the tree. Assignments are NOT a reason to refuse: that is exactly the case FR-16 says must be soft-deleted, so the count is recorded instead. Audited (FR-43).",
  },
  {
    file: "routes/avatar.ts",
    method: "POST",
    path: "/:id/avatar/presign",
    mountedAt: "/api/v1/members",
    permission: "profile:update_own",
    reason:
      "Mint a presigned R2 PUT (FR-14). Guarded by the self form of profile:update_own, and the handler additionally allows member:update for someone else's photo — uploading is a write, so the write rules apply rather than the read scopes. Type and size are enforced by R2 itself, not here: the content type and length are signed into the URL, so a client sending anything else gets a 403 from R2 — that constrains the OBJECT, whereas a handler check would only constrain the request. The key is random and namespaced, because a predictable key lets anyone who learns the layout enumerate avatars. The key is NOT stored on the member here; the client PATCHes avatarKey after the upload succeeds, so an abandoned upload cannot leave a member pointing at an object that was never written.",
  },
  {
    file: "routes/avatar.ts",
    method: "POST",
    path: "/:id/avatar/confirm",
    mountedAt: "/api/v1/members",
    permission: "profile:update_own",
    reason:
      "Finish an upload: verify the bytes really are an image, strip its metadata, and only then write avatarKey (FR-14, NFR-8). This is the step that closes the gap a presigned PUT leaves open — R2 stores the client's bytes verbatim, so the Worker reads the object once, removes the identifying JPEG APP1/APP13/COM segments or PNG tEXt/eXIf or WebP EXIF/XMP chunks, and puts the cleaned bytes back. It is a structural walk over the container, not a decode, which is why it fits in a Worker. Colour-bearing segments (ICC, Adobe) are deliberately KEPT: stripping them would shift every photo's colours without removing any identity. Refuses a key belonging to another member (keys are namespaced by member id), refuses bytes that are not a JPEG/PNG/WebP (magic bytes, not the declared content type — R2 enforced the content type we signed, this enforces what the file actually is, and the file is deleted), and refuses a missing object. avatarKey is written HERE and nowhere else, so an abandoned or failed upload leaves the profile untouched. Audited (FR-43) via the member update.",
  },
  {
    file: "routes/roles.ts",
    method: "GET",
    path: "/",
    mountedAt: "/api/v1/roles",
    permission: "role:read",
    reason:
      "List roles with their permissions (FR-22). Guarded by role:read. System roles come back with isSystem:true so the UI can show the lock (FR-23, D3) — but the lock is enforced at the write layer, not here.",
  },
  {
    file: "routes/roles.ts",
    method: "GET",
    path: "/permissions",
    mountedAt: "/api/v1/roles",
    permission: "role:read",
    reason:
      "The fixed permission catalog (FR-24). Declared BEFORE /:id because Hono matches in registration order — the other way round the catalog would be swallowed as a role id and become unreachable.",
  },
  {
    file: "routes/roles.ts",
    method: "GET",
    path: "/:id",
    mountedAt: "/api/v1/roles",
    permission: "role:read",
    reason: "Read one role by id or key (FR-22). Guarded by role:read; an unknown id is a 404.",
  },
  {
    file: "routes/roles.ts",
    method: "POST",
    path: "/",
    mountedAt: "/api/v1/roles",
    permission: "role:manage",
    reason:
      "Create a custom role from the fixed catalog (FR-24). Guarded by role:manage. Every permission key is checked against PERMISSION_KEYS before anything is written, so a typo cannot create a role that grants nothing (silently useless) or something unrecognised (silently broad); the SCOPE is taken from the catalog and never from the request, because scope is a property of the permission rather than of whoever assembles the bundle. The key is namespaced `custom:` so it cannot collide with a seeded role, and isSystem is not settable from outside — a custom role cannot declare itself a system role. Audited (FR-43).",
  },
  {
    file: "routes/roles.ts",
    method: "PATCH",
    path: "/:id",
    mountedAt: "/api/v1/roles",
    permission: "role:manage",
    reason:
      "Update a custom role (FR-24). Guarded by role:manage. Refuses system roles outright rather than ignoring the request (FR-23, D3): they are what the RBAC matrix is built on, so editing one in place would silently change what every existing member can do with no record that the matrix moved — and a silent no-op would let an admin believe they had changed it. Audited (FR-43) with the before/after permission sets.",
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
