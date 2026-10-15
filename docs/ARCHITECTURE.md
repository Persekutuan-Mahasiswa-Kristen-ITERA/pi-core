# ARCHITECTURE — PI-CORE (planning-stage proposal)

Status legend: **[Owner]** = decided by the owner · **[Proposed]** = architect's proposal, agent may refine via ADR ·
**[Verify]** = must be checked against current official docs before relying on it.

> **Companion:** the BMAD architecture spine — `_bmad-output/planning-artifacts/architecture/architecture-PMK-CORE-2026-10-15/ARCHITECTURE-SPINE.md` — holds the invariants (AD-1…AD-15) derived from this document. Keep the two in sync; this document is authoritative for the org model, roles and auth approach.

## 1. Product scope
PI-CORE owns: member identity, organization structure, periods, assignments (who holds which position in which unit in which period),
roles & permissions, authentication (Google), OIDC provider for other PMK apps, audit log.
PI-CORE does NOT own: events, finance, minutes, inventory, recruitment (other apps).

Deliverables [Owner]: (a) native mobile app (Expo), (b) admin **website** for desktop, (c) shared HTTP API. The Figma prototype is mobile only.

## 2. Organization model [Owner structure, Proposed modeling]
PMK ITERA = Persekutuan Mahasiswa Kristen ITERA. "Anggota" = all Christian students of ITERA (baseline membership, no assignment needed).

Structure tree (`org_units`): `organization` -> `bph` | 7 `department` | 1 `bureau`; each department -> `division`s.

| Unit | Type | Children (divisions) |
|---|---|---|
| BPH PMK ITERA | bph | none |
| Departemen Internal | department | EO; Harmonisasi |
| Departemen Eksternal | department | Intra Kampus; Ekstra Kampus |
| Departemen Pelayanan Khusus | department | Worship; Worship Creator; Musik |
| Departemen Talenta | department | Art Interest; Ekstra Youth |
| Departemen Operasional | department | Logistik; Akomodasi |
| Departemen CMIT | department | Pubdok; Desain; IT |
| Departemen Pembinaan Rohani | department | Gospel Group; Doa |
| Biro Kewirausahaan | bureau | none (no divisions) |

7 departments + 1 bureau = 8 top units; 16 divisions. Names come from the owner; confirm official spelling at seed time.
Structure can change between periods, so units are editable (`orgunit:manage`) and soft-deletable, never hard-deleted when referenced.

## 3. Positions, Roles, Permissions [Proposed]
Definitions (this resolves the prototype's "Role" vs "Position"):
- **Position** = a title in a unit type (what a person *is*). Seeded, with a `rank` (lower number = more senior) and `unit_type`.
- **Role** = a bundle of permissions (what a person *may do*). Shown in the prototype's Roles screen.
- **Assignment** = member x org_unit x position x period. A member may hold several assignments in one period.
- Effective roles of a member = union of `position_roles` for their assignments **in the active period** + explicit system grants + implicit `anggota`.

### Positions (seed)
| unit_type | position (key) | rank | default roles |
|---|---|---|---|
| bph | Ketua Umum (`ketua_umum`) | 10 | bph, organization_admin |
| bph | Sekretaris Jenderal (`sekretaris_jenderal`) | 20 | bph, organization_admin |
| bph | Sekretaris Umum 1, 2 (`sekretaris_umum_1/2`) | 30 | bph, organization_admin |
| bph | Bendahara Umum 1, 2 (`bendahara_umum_1/2`) | 30 | bph, bendahara |
| department | Kepala Departemen (`kepala_departemen`) | 40 | kepala_departemen |
| department | Sekretaris Departemen (`sekretaris_departemen`) | 50 | sekretaris |
| bureau | Kepala Biro (`kepala_biro`) | 40 | kepala_departemen |
| bureau | Sekretaris Biro (`sekretaris_biro`) | 50 | sekretaris |
| division | Kepala Divisi (`kepala_divisi`) | 60 | kepala_divisi |
| division / bureau | Staff (`staff`) | 70 | staff |
| reserved | Panitia (`panitia`) | 80 | panitia (event-scoped; deferred with Events) |

The mapping is configurable data (`position_roles`), seeded idempotently. Ketua Umum, Sekjen and Sekum are the "organization admins"; per **ADR-0002** (owner, 2026-10-15) **all Kepala Departemen and Kepala Biro also hold `organization_admin`**, and `super_admin` is held by the Kepala Divisi IT / Kepala Departemen CMIT plus a backup.

### Roles
`super_admin` (technical, granted explicitly, NOT tied to a position/period), `organization_admin`, `bph`, `bendahara`,
`kepala_departemen` (also Kepala Biro), `sekretaris` (Sekdep/Sekbiro), `kepala_divisi`, `staff`, `panitia` (reserved), `anggota` (implicit baseline).
System roles are immutable. Custom roles may be created by `super_admin` from the fixed permission catalog.
Roles screen "Total Members" = distinct members holding the role in the active period.

### Permission catalog and default matrix
Scope: **O** = organization-wide, **U** = only the holder's own unit subtree, **S** = self only, **-** = none.

| Permission | super_admin | org_admin | bph | kepala_dept/biro | sekretaris | kepala_divisi | staff | anggota |
|---|---|---|---|---|---|---|---|---|
| `profile:read_own`, `profile:update_own` | S | S | S | S | S | S | S | S |
| `orgunit:read`, `period:read` | O | O | O | O | O | O | O | O |
| `member:read` (name, email, avatar, unit, position) | O | O | O | U | U | U | U | - |
| `member:read_sensitive` (NIM, phone, ...) | O | O | - | - | U | - | - | - |
| `member:create`, `member:deactivate` | O | O | - | - | - | - | - | - |
| `member:update` | O | O | - | - | U | - | - | - |
| `assignment:read` | O | O | O | U | U | U | - | - |
| `assignment:manage` (create/update/end) | O | O | - | U* | U* | - | - | - |
| `orgunit:manage`, `period:manage`, `period:activate` | O | O | - | - | - | - | - | - |
| `role:read` | O | O | O | - | - | - | - | - |
| `role:manage`, `permission-mapping:manage` | O | - | - | - | - | - | - | - |
| `integration:read` | O | O | - | - | - | - | - | - |
| `integration:manage`, `settings:read`, `settings:manage` | O | - | - | - | - | - | - | - |
| `audit:read` | O | O | - | - | - | - | - | - |
| `report:read` | reserved (Reports screen deferred) |

\* **Rank guard, `U` scope only.** A manager whose `assignment:manage` is **U**-scoped may only create/modify assignments whose position `rank` is
**strictly greater** (more junior) than their own highest-ranking position in that subtree, and only inside that subtree. It does **not** apply at `O`
scope. Because of **ADR-0002** every Kepala Departemen and Kepala Biro *also* holds `organization_admin` (scope `O`), so their effective
`assignment:manage` is org-wide and **not** rank-limited — in practice the guard binds `sekretaris`. Test **both** the guarded and the org-admin
behaviour explicitly (owner decision, 2026-10-15).

Rules: deny by default. Permissions are checked server-side through one function `can(actor, permission, target?)` in `packages/shared`
(pure, unit-tested). Users can never grant themselves permissions. The last `super_admin` cannot be removed. Every grant change is audited.
`organization_admin` cannot edit `super_admin` grants, roles, or integrations.

## 4. Data model draft [Proposed] — agent finalizes in Phase 1 via ADR
- `members`: id (uuid), email (citext, unique), full_name, nim, faculty, study_program, cohort_year, phone, avatar_key (R2), status
  (`active|inactive`), google_sub (nullable, unique, set at first login), auth-library user link, timestamps, deleted_at (soft delete).
- `periods`: id, label (`2026/2027`), start_date, end_date, is_active. **Partial unique index: at most one `is_active = true`.** Activation is one transaction.
- `org_units`: id, parent_id, type, name, slug (unique within parent), sort_order, path or closure table for subtree queries, is_active.
- `positions`: id, key (unique), name, unit_type, rank, is_unique_per_unit (e.g. Kepala Divisi).
- `roles`: id, key, name, is_system, description. `permissions`: key. `role_permissions`: role_id, permission_key, scope (`O|U|S`).
- `position_roles`: position_id, role_id.
- `assignments`: id, member_id, org_unit_id, position_id, period_id, starts_on, ends_on, created_by. Constraints: unique(member, unit, position, period);
  uniqueness for `is_unique_per_unit` positions per (unit, period); org_unit.type must match position.unit_type.
- `system_grants`: member_id, role_key (`super_admin`), granted_by, granted_at.
- `allowed_email_domains`: domain, allow_subdomains (bool), is_active. Seed (**ADR-0005**, owner 2026-10-15): **ITERA domains only** — `itera.ac.id` and `student.itera.ac.id` (with `allow_subdomains` set appropriately). `pmkitera.web.id` is **not** seeded (its mailboxes are not Google accounts).
- `integrations` (= OIDC clients): id, key (`nexus|finance|notulensi|panitia|inventory`), name, client_id, redirect_uris[], allowed_scopes[], status,
  last_authorized_at. No plaintext client secrets stored (hash, or public client + PKCE).
- `audit_logs` (append-only): id, at, actor_member_id, action, entity_type, entity_id, before/after (jsonb, sensitive fields redacted), ip, user_agent, request_id.
- All tables: RLS enabled with **no** public policies (see SECURITY.md). Index FK columns and search fields (`members.full_name`, `email`).

## 5. Authentication [Owner: Google only] [Proposed details]
- Only Google Sign-In. No passwords, so no password-reset flow. Email verification = Google's `email_verified` claim. MFA = Google 2-Step Verification
  (cannot be enforced for accounts outside our control). Optional step-up TOTP for admin roles is a Phase 6 decision (see Open Decisions).
- Domain restriction [Owner]: allowlist in `allowed_email_domains`, editable by `super_admin` (this is the prototype's "Authentication Configuration" screen).
  Enforce **server-side** on the verified ID-token email. The Google `hd` parameter is only a UI hint and is NOT a security control. [Verify] Seed = ITERA domains only (**ADR-0005**).
- **Invite-only**: after the Google callback, the email must match an existing `active` member. Unknown email gives a generic denial + audit entry.
  Link `google_sub` on first login and prefer `sub` matching afterwards.
- Web: secure httpOnly cookie session. Mobile: system-browser OAuth with PKCE, tokens in `expo-secure-store`, short access token + rotating refresh token. **Library: Better Auth** — Google provider + `@better-auth/oauth-provider` (OIDC) + `@better-auth/expo`; verified 2026-10-15, see **ADR-0007**.
- Bootstrap: the first `super_admin` is created by a one-off seed command using an env-provided email (never hardcoded), recorded in audit.

## 6. SSO / integrations [Owner: follow recommendation] [Proposed]
- PI-CORE is an **OIDC provider**: Authorization Code + PKCE, discovery (`/.well-known/openid-configuration`), JWKS, scopes `openid profile email` + custom `pmk:access`.
- Subdomain apps (`*.pmkitera.web.id`) each register as an `integration`. Shared cookies across subdomains are NOT used; each app keeps its own session after OIDC login.
- The ID token stays small (`sub`, `email`, `name`). Authorization data comes from `GET /api/v1/access` (Bearer access token) returning active period, assignments, roles and permission keys.
  Consumers cache briefly and never trust client-supplied roles.
- **"Connected" status (owner did not know the meaning) [Proposed]:** `Connected` = integration enabled AND at least one successful authorization within a configurable window;
  `Not connected` = not registered, disabled, or never used. Detail view shows client id, redirect URIs, scopes, last authorized. Confirm with the owner when PI-NEXUS integration starts.

## 7. API conventions [Proposed]
`/api/v1/...` REST+JSON. zod request/response schemas shared via `packages/shared`. Uniform error body `{ error: { code, message, details?, requestId } }`.
Cursor pagination. Rate limits on auth and write endpoints. `requestId` propagated to logs and audit.

## 8. Cloudflare topology [Proposed] [Verify all]
- **One Worker deployment** (ADR-0013, spine **AD-17**): **static-first** — `apps/web` is built to a **static export** and served from Cloudflare **static assets** (0 CPU per page view); a thin **Hono** Worker (`apps/api`) serves `/api/v1/*`, hosts the `RealtimeHub` Durable Object and the OIDC endpoints, and reaches Postgres through the `HYPERDRIVE` binding. Other bindings: `AVATARS` (R2), rate-limiting binding or KV; secrets via `wrangler secret`.
- Environments: local (wrangler dev / next dev), **staging** (own Supabase project + own Hyperdrive), **production**.
- Custom domain `core.pmkitera.web.id` — **deferred (ADR-0003)**: `pmkitera.web.id` is not on Cloudflare DNS. Staging is served from a `*.workers.dev` subdomain.
- Workers **Free** is the ceiling (**ADR-0003**). Verified limits (2026-10-15): **10 ms CPU per request**, 100k requests/day, 128 MB memory, **3 MiB** compressed Worker, 50 subrequests, 6 concurrent outbound connections. **Measured 2026-10-15 (story 1.5):** Next.js/OpenNext on the Worker costs **14–303 ms CPU per request** — above the limit on every request (still returning 200 only via the runtime's undocumented flexibility). This is why rendering was moved off the Worker → **ADR-0013** (static-first + thin Hono API, spine AD-17). Bundle: **822.30 KiB gzip** (27% of the 3 MiB ceiling).
- CI: GitHub Actions runs typecheck/lint/test and deploys staging automatically. Production deploy and production migrations require explicit owner approval.
- Supabase is used as plain Postgres. **Data API disabled**; do not rely on Supabase Auth. Hyperdrive uses the **direct** connection string (Hyperdrive pools); drivers `pg` (≥8.13.0) / `postgres` (≥3.4.4) + Drizzle (`drizzle-orm/node-postgres` ≥0.26.2), `nodejs_compat`. Verified 2026-10-15 — see **ADR-0009**.

## 9. Quality bar
Unit tests for `can()` and period/assignment invariants. Integration tests per endpoint including **denied** cases. E2E for login -> dashboard -> assign member (web).
Mobile smoke tests. Seed/migration tests on an empty DB. A11y checks on key screens. Structured logs with request ids.

## 10. Owner decisions (resolved 2026-10-15 during PRD review)
1. `super_admin` = Kepala Divisi IT / Kepala Departemen CMIT + a backup; **all** Kepala Departemen & Kepala Biro also hold `organization_admin`. → **ADR-0002**
2. `pmkitera.web.id` mailboxes are **not** Google accounts → allowlist uses ITERA domains only. → **ADR-0005**
3. Student domain = the official ITERA domain (`student.itera.ac.id`); `itera.ac.id` alone does not match subdomains unless `allow_subdomains` is set.
4. `pmkitera.web.id` DNS is **not** on Cloudflare; **no paid Workers plan** → staging on `*.workers.dev`. → **ADR-0003**
5. Mobile: Android first; **iOS is a dev-only target** (no paid Apple Developer account). → **ADR-0004**
6. Optional admin step-up MFA (TOTP): **deferred to Phase 6**.
7. UI language: **Bahasa Indonesia default** (i18n-ready; English as a second locale). → **ADR-0006**
8. Extra member profile fields: **deferred** — MVP keeps the §4 fields.
9. Legacy member data import (CSV): still later, once data exists (unchanged).
