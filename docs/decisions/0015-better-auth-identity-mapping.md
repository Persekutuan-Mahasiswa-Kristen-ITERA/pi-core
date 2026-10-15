# ADR-0015 — Better Auth identity mapping and per-request auth instance

- **Status:** Accepted
- **Date:** 2026-10-15
- **Related:** ADR-0007 (auth library = Better Auth), ADR-0009 (Hyperdrive + one short-lived client per request), ADR-0013 (static-first web + thin API Worker), FR-1/FR-4, NFR-1

## Context

ADR-0007 chose Better Auth. It needs a database with four models — `user`, `session`, `account`,
`verification` — while `docs/ARCHITECTURE.md` §4 already defines `members` as the organization's
member registry: the row RBAC resolves against (`loadActor`), the row `google_sub` is linked on, and
the row `status` gates admission.

Two questions had to be answered before writing any wiring:

1. Does Better Auth get its **own** `user` table, or does its `user` model **map onto `members`**?
2. Where does the auth instance live, given that our Worker deliberately opens **one short-lived
   Postgres client per request** (ADR-0009) — a module-scope pool makes workerd cancel requests
   (found the hard way in story 1.6)?

## Decision

**1. Map Better Auth's `user` onto `members`.** One identity record, not two: a second `user` table
would become a second answer to "who is this person", and the two would drift (a member renamed, a
member deactivated, a `google_sub` relinked). Mapping keeps FR-4 literal — the first sign-in writes
`google_sub` into the row that RBAC already reads.

Consequences:
- Add **`members.email_verified`** (boolean, not null, default false). This is real data we learn
  from Google's verified claim, and it belongs on the member.
- Map `name` → `full_name`, and `createdAt`/`updatedAt` onto the existing columns. Better Auth's
  optional `image` is not mapped (we keep `avatar_key` for R2, which is a different thing).
- `session`, `account` and `verification` stay **Better Auth's own tables**, created as its schema
  expects and left alone. They are auth infrastructure, not organization data.
- `members` keeps its own columns (`nim`, `faculty`, `status`, …) that Better Auth knows nothing
  about; extra columns are fine.

**2. One auth instance per request**, created in a Hono middleware and stored on the context, with
`app.all("/api/auth/*", (c) => c.get("auth").handler(c.req.raw))`. This is the documented Cloudflare
pattern and the only one compatible with ADR-0009: the Drizzle client is per-request, so the auth
instance that wraps it must be too. A singleton would reintroduce the hanging-pool bug.

Consequences:
- `nodejs_compat` is required (Better Auth uses `AsyncLocalStorage`) — already set in
  `apps/api/wrangler.jsonc`.
- The auth routes live on the **API Worker** (ADR-0013: `apps/web` is a static export and has no
  server to host a callback), mounted with `app.all(...)`.
- The route is declared in the FR-25 authorization registry as **public with a written reason**:
  there is no session yet at that point, and the request is the sign-in attempt itself. Admission is
  still enforced — by `resolveSignIn` (FR-1/FR-3/FR-4, NFR-2/3) around the Better Auth callback —
  not by the route guard.
- **Cross-origin cookies in staging.** `apps/web` and `apps/api` are separate `*.workers.dev`
  subdomains, so the session cookie is cross-site: it needs `SameSite=None; Secure` and explicit
  CORS `credentials` plus Better Auth `trustedOrigins`. In production both are served from one
  origin (ADR-0013's single Worker), where this disappears. Worth verifying at the first staging
  sign-in rather than assuming.

## Alternatives considered

- **A separate `user` table** (Better Auth's default): simpler wiring, but two identity records and
  a join on every authorization decision. Rejected.
- **A module-scope auth instance / connection pool**: the fastest-looking option and the one that
  breaks on Workers — workerd cancels a request whose I/O outlives it (ADR-0009, story 1.6).
  Rejected.
- **Hand-rolling the Google flow**: rejected already in ADR-0007 (identity root).
