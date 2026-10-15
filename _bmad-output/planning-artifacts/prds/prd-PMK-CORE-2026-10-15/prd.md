---
title: PI-CORE
status: draft
created: 2026-10-15
updated: 2026-10-15
---

# PRD: PI-CORE (PMK ITERA Centralized Organization & Role Engine)
*Working title — confirm.*

## 0. Document Purpose

This PRD is for the owner (PMK ITERA), the implementation agent, and the downstream BMAD workflows (UX, architecture, epics & stories). It is **derived from and must stay consistent with** the kit's authoritative docs: `docs/ARCHITECTURE.md` (org model, roles, permission matrix, data model, auth, Cloudflare topology), `docs/SECURITY.md` (non-negotiable security rules), and `docs/DESIGN.md` (design tokens, screen inventory, approved deviations D1–D5). Where this PRD and those docs diverge, the docs win and the divergence is a defect to fix; the companion product brief is `_bmad-output/planning-artifacts/briefs/brief-PMK-CORE-2026-10-15/brief.md`. Vocabulary is Glossary-anchored (§3); features are grouped with globally numbered FRs; inferences are tagged `[ASSUMPTION: …]` and indexed in §13.

## 1. Vision

PI-CORE is the central identity, membership, organization-structure, role/permission and SSO service for the PMK ITERA digital ecosystem. It owns one authoritative answer to *"who is this person, what may they do, and in which unit and period?"* — and it serves that answer to every other PMK ITERA application.

Members and pengurus use it through a native mobile app (per the Figma prototype) and a desktop admin website. Other apps consume it through a shared HTTP API and an OIDC provider, so they can delegate login and authorization to PI-CORE instead of rebuilding both.

The design bet is **periods as first-class**: access is derived from the *active period's* assignments, so the yearly kepengurusan handover becomes a data operation rather than a code change. Combined with a single server-side `can()` and an append-only audit log, PI-CORE becomes the trust root of the ecosystem.

## 2. Target User

### 2.1 Jobs To Be Done

- *As a pengurus,* I want the organization's structure, positions and who-holds-what to live in one place, so I stop re-explaining it to every app and every year.
- *As a BPH admin,* I want to create a period, activate it, and assign members to positions, so handover is a few clicks and access follows automatically.
- *As an app builder (PI-NEXUS, Finance, …),* I want users to log in through PI-CORE and receive their roles/permissions from it, so I never implement auth or roles myself.
- *As an anggota,* I want a trustworthy directory and a profile I control, so I can find people and keep my data correct.
- *As a super_admin,* I want to grant/revoke access and see an audit trail, so I can prove and reverse any change.
- *As a privacy-conscious org,* I want sensitive fields (NIM, phone) restricted and deactivation to revoke access promptly.

### 2.2 Non-Users (v1)

- Non-PMK apps and external identity providers (Google is the only IdP).
- Public/anonymous visitors — there is no public surface; everything is invite-only.
- Event-scoped roles (Panitia) — deferred with Events.
- iOS users — pending the owner's platform decision (see §12).

### 2.3 Key User Journeys

- **UJ-1. Ruth signs in for the first time and lands on the dashboard.**
  - **Persona + context:** Ruth, a new Staff in the IT division, was added to the directory by a BPH admin and told to install the app.
  - **Entry state:** unauthenticated, on the mobile app Login screen.
  - **Path:** taps "Continue with Google" → Google account chooser (system browser) → picks her `@student.itera.ac.id` account → PI-CORE validates the ID token, checks `email_verified`, checks the domain allowlist, and matches her to an existing `active` member → links `google_sub` → issues a session.
  - **Climax:** the dashboard greets her — "Shalom, Ruth!" — with the active period and her assignments visible.
  - **Resolution:** authenticated; subsequent app opens reuse the session until it expires.
  - **Edge case:** her email is not an active member → she sees one generic denial (no enumeration) and the attempt is audited.

- **UJ-2. Daniel (Kepala Divisi IT) onboards a new member.**
  - **Persona + context:** Daniel is a super_admin; a new student has joined.
  - **Entry state:** authenticated on the admin website, active period set.
  - **Path:** Members → "Create Member" → fills name, email, NIM, faculty, study program, cohort year → saves → then Assignments → selects member, unit (IT), position (Staff), period → saves.
  - **Climax:** the member appears in the directory with role/period, and now can sign in (UJ-1).
  - **Resolution:** both the member creation and the assignment are written to the audit log.

- **UJ-3. Sarah (Kepala Departemen CMIT) checks a subordinate assignment she is allowed to manage.**
  - **Persona + context:** Sarah manages the CMIT subtree; she must not touch anything outside it, nor assign anyone above her own rank.
  - **Entry state:** authenticated, scope = her department subtree.
  - **Path:** Assignments → create → the unit picker only offers her subtree; the position picker only offers positions strictly junior to her highest rank in that subtree → she assigns a Staff to the IT division → saves.
  - **Climax:** the assignment saves; an attempt to assign a *more senior* position (or a unit outside CMIT) is refused server-side and audited.
  - **Resolution:** the new assignment grants the staff member access for the active period only.

- **UJ-4. PI-NEXUS authenticates a user through PI-CORE OIDC.**
  - **Persona + context:** PI-NEXUS is a registered integration; its operator wants SSO.
  - **Entry state:** a user clicks "Sign in with PMK" on PI-NEXUS.
  - **Path:** PI-NEXUS redirects to PI-CORE's authorization endpoint (Authorization Code + PKCE, exact-match redirect URI) → the user authenticates at PI-CORE → PI-CORE returns a short-lived code → PI-NEXUS exchanges it for a small ID token (`sub`, `email`, `name`) → PI-NEXUS calls `GET /api/v1/access` with the Bearer access token.
  - **Climax:** PI-NEXUS receives the user's active period, assignments, roles and permission keys, and never trusts client-supplied roles.
  - **Resolution:** PI-NEXUS caches briefly; the user is signed in.

- **UJ-5. BPH activates next year's period.**
  - **Persona + context:** the kepengurusan rotates; the incoming BPH must take over.
  - **Entry state:** authenticated as an org admin.
  - **Path:** Periods → "Create Period" (label `2027/2028`) → build the structure/assignments for it → "Set Active".
  - **Climax:** activation happens in one transaction; exactly one period is active; access across the whole system now derives from the new period's assignments.
  - **Resolution:** the activation is audited; the previous period remains queryable.

## 3. Glossary

- **Member (Anggota)** — a person in the directory. *Anggota* (baseline) = all Christian students of ITERA; baseline membership needs no assignment. Members are invite-only.
- **Org Unit** — a node in the organization tree: `organization` → `bph` | `department` | `bureau`; a `department` → `division`s. Editable and soft-deletable.
- **BPH** — Badan Pengurus Harian; the top governing unit (type `bph`), no divisions.
- **Department** — one of 7 top units of type `department`; each has divisions.
- **Bureau** — the 1 top unit of type `bureau` (Biro Kewirausahaan); no divisions.
- **Division** — a unit of type `division` under a department.
- **Period** — a kepengurusan term (e.g. `2026/2027`) with start/end dates. **At most one Active Period** exists.
- **Active Period** — the single period whose assignments grant access system-wide.
- **Position** — a title in a unit type that a person *is* (e.g. Kepala Divisi); seeded, with a `rank` (lower = more senior) and a `unit_type`.
- **Role** — a bundle of permissions that a person *may do* (e.g. `kepala_divisi`). System roles are immutable; custom roles are created by a `super_admin`.
- **Permission** — a named capability (e.g. `member:read`) with a **Scope**.
- **Scope** — where a permission applies: **O** = organization-wide, **U** = only the holder's own unit subtree, **S** = self only.
- **Assignment** — member × org_unit × position × period; a member may hold several in one period. Effective roles = union of `position_roles` for the active-period assignments + explicit system grants + implicit `anggota`.
- **System Role** — a fixed role (`super_admin`, `organization_admin`, `bph`, `bendahara`, `kepala_departemen`, `sekretaris`, `kepala_divisi`, `staff`, `panitia`, `anggota`) that cannot be edited or deleted.
- **super_admin** — the technical role; granted explicitly, not tied to a position or period; the last one cannot be removed.
- **organization_admin** — the "org admin" role held by Ketua Umum, Sekjen and Sekum; cannot edit `super_admin` grants, roles, or integrations.
- **Integration** — an OIDC client (e.g. `nexus`) that authenticates its users through PI-CORE.
- **OIDC Provider** — PI-CORE's role as an OpenID Connect issuer (discovery, JWKS, Authorization Code + PKCE).
- **Invite-only** — no active member row ⇒ no session.
- **Domain Allowlist** — `allowed_email_domains`; checked server-side on the verified email.
- **Audit Log** — append-only record of every mutation.
- **ID Token / Access Token** — OIDC artifacts; the ID token stays small, the access token authorizes `GET /api/v1/access`.

## 4. Features

### 4.1 Authentication & Session

**Description.** Google Sign-In only (owner decision; DESIGN deviation **D1**). PI-CORE validates the Google ID token server-side, checks the domain allowlist, and admits only emails matching an existing `active` member (invite-only). Web uses a secure httpOnly cookie session; mobile uses system-browser OAuth with PKCE and SecureStore tokens. Deactivating a member or removing access revokes sessions/tokens promptly. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Sign in with Google (web)
A member can sign in on the admin website using their Google account. Realizes UJ-1.
**Consequences (testable):**
- The ID token is validated server-side (signature, `iss`, `aud`, `exp`, nonce/PKCE state); invalid tokens are rejected.
- `email_verified = true` is required; otherwise sign-in is refused.
- No email/password fields exist anywhere (D1); the only login affordance is "Continue with Google".

#### FR-2: Sign in with Google (mobile)
A member can sign in on the mobile app using the system browser (not an embedded WebView), Authorization Code + PKCE.
**Consequences (testable):**
- Tokens are stored only in `expo-secure-store`; no token appears in logs or analytics.
- Redirect/deep-link schemes are validated.

#### FR-3: Domain allowlist enforcement
The system refuses sign-in when the verified email's domain is not in `allowed_email_domains`. Realizes UJ-1 (edge case).
**Consequences (testable):**
- Enforcement is server-side on the verified email; the Google `hd` parameter is never used as a control.
- Subdomain matching honours the domain's `allow_subdomains` flag.

#### FR-4: Invite-only admission
Only emails matching an existing `active` Member may obtain a session.
**Consequences (testable):**
- An unknown or inactive email receives one generic denial (no account enumeration) and produces an audit entry.
- `google_sub` is linked on first login and preferred for subsequent matching.

#### FR-5: Session lifecycle
Sessions are httpOnly + Secure + SameSite cookies on web; rotating refresh tokens on mobile.
**Consequences (testable):**
- Refresh tokens rotate on use; a reused/old refresh token is rejected.
- Deactivating a member, or removing their roles, invalidates their sessions and tokens within the documented window.

#### FR-6: Bootstrap first super_admin
The first `super_admin` is created by a one-off seed command using an env-provided email.
**Consequences (testable):**
- The email is never hardcoded; the creation is recorded in the audit log.

#### FR-7: Denial auditing
Every denied authentication attempt is audited.
**Consequences (testable):**
- A denial writes an audit row with actor (if known), reason class, IP and user-agent.

### 4.2 Member Directory

**Description.** The directory of all Members with search and filters (role, period), matching the prototype's Members screen. Create/edit uses a form that does not exist in the prototype (DESIGN notes "Create/Edit Member — Not in prototype") and must be designed from tokens (see §12 OQ-6). Realizes UJ-2.

**Functional Requirements:**

#### FR-8: List and search members
An actor with `member:read` can list and search members (by `full_name`, `email`).
**Consequences (testable):**
- Results are scoped in the query: O scope sees all; U scope sees only their unit subtree; no-scope sees none.
- Pagination is cursor-based.

#### FR-9: View member detail
An actor with `member:read` can open a member's profile (name, email, avatar, unit, position).
**Consequences (testable):**
- Sensitive fields (NIM, phone) are returned only to holders of `member:read_sensitive`; otherwise they are omitted.

#### FR-10: Create member
An actor with `member:create` can create a member (name, email, NIM, faculty, study program, cohort year, phone, photo).
**Consequences (testable):**
- Input is validated with zod; unknown fields are rejected.
- The mutation writes an audit row.

#### FR-11: Update member
An actor with `member:update` (S scope) can update member data; field-level rules apply per the permission matrix.
**Consequences (testable):**
- A member can update their own profile (`profile:update_own`) but not fields outside that permission.
- The mutation writes an audit row.

#### FR-12: Deactivate member (soft)
An actor with `member:deactivate` can deactivate a member.
**Consequences (testable):**
- Deactivation is a soft delete (`status = inactive`, `deleted_at` set); the row is never hard-deleted while referenced.
- Deactivation revokes the member's sessions/tokens (FR-5) and writes an audit row.

#### FR-13: Sensitive-field protection
NIM, phone and email are treated as sensitive.
**Consequences (testable):**
- They are redacted in logs and in audit `before/after`.
- An anonymization path exists for deletion requests.

#### FR-14: Avatar upload
An actor can set a member avatar, stored in a private R2 bucket.
**Consequences (testable):**
- Avatars are served via signed URLs or an authorized route; object keys are random; type/size are validated; metadata is stripped.

### 4.3 Organization Units

**Description.** The organization tree (`organization` → `bph`/`department`/`bureau` → `division`) per `docs/ARCHITECTURE.md` §2. Structure is editable and changes between periods. Realizes UJ-2, UJ-3.

**Functional Requirements:**

#### FR-15: Read organization tree
Any authenticated member can read the org tree and period metadata.
**Consequences (testable):**
- `orgunit:read` and `period:read` are O-scoped (available to all members).

#### FR-16: Manage organization units
An actor with `orgunit:manage` can create/rename/reorder/move units.
**Consequences (testable):**
- `slug` is unique within a parent; `org_unit.type` must match any position assigned to it.
- Units referenced by assignments are soft-deleted, never hard-deleted; mutations are audited.

#### FR-17: Seed the initial structure
The initial tree (BPH; 7 departments; 1 bureau; 16 divisions) is seeded idempotently.
**Consequences (testable):**
- Re-running the seed does not duplicate units; official spellings are confirmed with the owner before seeding (OQ-3).

#### FR-18: Subtree scoping
Subtree queries (for U scope) are served efficiently.
**Consequences (testable):**
- The unit hierarchy is stored as a `path`/closure so subtree filtering happens in the query, not after fetching.

### 4.4 Periods

**Description.** Kepengurusan terms with dates; at most one Active Period. Realizes UJ-5.

**Functional Requirements:**

#### FR-19: Create/edit period
An actor with `period:manage` can create and edit periods (label, start/end dates).
**Consequences (testable):**
- Input validated; mutations audited.

#### FR-20: Single active period invariant
At most one period has `is_active = true`.
**Consequences (testable):**
- Enforced by a partial unique index; activating a period deactivates the previous one in a single transaction.

#### FR-21: Activate period
An actor with `period:activate` can activate a period. Realizes UJ-5.
**Consequences (testable):**
- Activation is audited; after activation, all access derives from the new period's assignments.
- A user without `period:activate` is refused.

#### FR-22: Period-scoped filtering
Members and assignments can be filtered by period (prototype's Period filter).
**Consequences (testable):**
- "Total Members" for a role = distinct members holding it in the selected period.

### 4.5 Roles & Permissions

**Description.** Roles are permission bundles; permissions carry a scope (O/U/S). A single server-side `can()` enforces the matrix in `docs/ARCHITECTURE.md` §3. System roles are immutable (DESIGN deviation **D3**); custom roles are created by `super_admin` from the fixed permission catalog.

**Functional Requirements:**

#### FR-23: Read roles and permission matrix
An actor with `role:read` can view roles and their permissions.
**Consequences (testable):**
- System roles are shown read-only with a lock (D3).

#### FR-24: Create/edit custom roles
An actor with `role:manage` can create/edit custom roles from the fixed permission catalog.
**Consequences (testable):**
- System roles cannot be edited or deleted; a user can never grant themselves permissions.

#### FR-25: Single authorization function
Every route handler calls one `can(actor, permission, target?)` before touching data.
**Consequences (testable):**
- A test fails if a route lacks an authorization check.
- Deny-by-default: an unlisted permission is denied.

#### FR-26: Scope enforced in the query
Scope (O/U/S) is enforced in the database query, not after fetching.
**Consequences (testable):**
- A U-scoped actor's list query is filtered by unit subtree at the SQL level.

#### FR-27: Rank-based escalation guard
A U-scoped manager may only create/modify assignments whose position `rank` is strictly junior to their own highest rank in that subtree, and only inside that subtree. Realizes UJ-3.
**Consequences (testable):**
- Assigning a more senior position, or a unit outside the subtree, is refused and audited.
- No user can edit their own assignments.

#### FR-28: Last super_admin protection
The last `super_admin` cannot be removed.
**Consequences (testable):**
- An attempt to remove the final `super_admin` grant is refused; every grant change is audited.

### 4.6 Assignments

**Description.** Assignments connect member × unit × position × period, with constraints. Assignment form uses Member, **Unit** (required), Position, Period; Role is derived read-only from Position (DESIGN deviation **D2**). Realizes UJ-2, UJ-3, UJ-5.

**Functional Requirements:**

#### FR-29: Read assignments
An actor with `assignment:read` can list assignments within their scope.
**Consequences (testable):**
- U scope sees only their subtree; `staff` and `anggota` have no `assignment:read`.

#### FR-30: Manage assignments
An actor with `assignment:manage` can create/update/end assignments within scope and rank limits. Realizes UJ-2, UJ-3.
**Consequences (testable):**
- Constraints hold: unique (member, unit, position, period); unique `is_unique_per_unit` position per (unit, period); `org_unit.type` matches `position.unit_type`.
- Mutations are audited.

#### FR-31: Effective roles derivation
Effective roles = union of `position_roles` for active-period assignments + explicit system grants + implicit `anggota`.
**Consequences (testable):**
- Only active-period assignments grant access; past/future periods do not.

#### FR-32: Role shown read-only in assignment UI
The assignment form derives Role from Position and shows it read-only (D2).
**Consequences (testable):**
- The user cannot pick a Role freely.

#### FR-33: Assignment end/transfer
An assignment can be ended (set `ends_on`) or transferred.
**Consequences (testable):**
- Ending an assignment removes the derived access for the active period and is audited.

### 4.7 Integrations & OIDC Provider

**Description.** PI-CORE is an OIDC provider; other PMK apps register as integrations (clients). Realizes UJ-4.

**Functional Requirements:**

#### FR-34: Register/manage integrations
An actor with `integration:manage` can register and edit integrations (key, name, client id, redirect URIs, allowed scopes, status).
**Consequences (testable):**
- No plaintext client secret is stored (hash, or public client + PKCE).
- `integration:read` (org admins) is read-only; mutations are audited.

#### FR-35: OIDC discovery and JWKS
PI-CORE exposes `/.well-known/openid-configuration` and a JWKS endpoint.
**Consequences (testable):**
- Scopes include `openid profile email` + custom `pmk:access`; a key-rotation plan exists for JWKS.

#### FR-36: Authorization Code + PKCE flow
Consumers authenticate users via Authorization Code + PKCE. Realizes UJ-4.
**Consequences (testable):**
- Redirect URIs are exact-matched; auth codes are short-lived; implicit flow is not supported; tokens are audience-restricted.

#### FR-37: Access endpoint
`GET /api/v1/access` (Bearer access token) returns the active period, assignments, roles and permission keys. Realizes UJ-4.
**Consequences (testable):**
- The ID token stays small (`sub`, `email`, `name`); authorization data comes only from `/api/v1/access`.
- Consumers never trust client-supplied roles.

#### FR-38: Integration connection status
The Integrations screen shows Connected / Not Connected.
**Consequences (testable):**
- `Connected` = enabled AND ≥1 successful authorization within a configurable window; `Not connected` = not registered, disabled, or never used (definition to confirm with the owner when PI-NEXUS integration starts — OQ-5).
- Detail view shows client id, redirect URIs, scopes, last authorized.

#### FR-39: No cross-subdomain cookie sharing
Each consumer app keeps its own session after OIDC login.
**Consequences (testable):**
- Shared cookies across `*.pmkitera.web.id` are not used.

### 4.8 Settings & Authentication Configuration

**Description.** The Settings screen (logo + org name) and "Authentication Configuration" (DESIGN deviation **D1**: Google Sign-In always on + editable Allowed email domains; no email/password toggle).

**Functional Requirements:**

#### FR-40: View/edit allowed email domains
An actor with `settings:manage` (super_admin) can view/edit `allowed_email_domains`.
**Consequences (testable):**
- Changes take effect for subsequent sign-ins; mutations are audited.

#### FR-41: Organization profile settings
A super_admin can set the org name and logo (logo from R2).
**Consequences (testable):**
- The logo is exported from Figma (not recreated) and served from a private bucket.

#### FR-42: Settings access control
`settings:read` / `settings:manage` are restricted to `super_admin`.
**Consequences (testable):**
- `organization_admin` cannot read or change settings.

### 4.9 Audit Log

**Description.** Append-only record of every mutation.

**Functional Requirements:**

#### FR-43: Audit every mutation
Every mutation of members/assignments/periods/roles/integrations/settings writes an `audit_logs` row.
**Consequences (testable):**
- Fields: at, actor, action, entity type/id, before/after (jsonb, sensitive fields redacted), ip, user_agent, request_id.
- The audit table has no update/delete grants.

#### FR-44: Read audit log
An actor with `audit:read` (super_admin, organization_admin) can browse the audit log.
**Consequences (testable):**
- Non-holders are refused.

### 4.10 Admin Website

**Description.** Desktop admin website for the management surface (no Figma exists — DESIGN §"Desktop admin website" design rule: derive from mobile tokens/patterns; persistent left sidebar; tables; side sheets).

**Functional Requirements:**

#### FR-45: Admin surfaces
The website provides Dashboard, Members, Roles, Periods, Assignments, Integrations, Settings, and Audit Log.
**Consequences (testable):**
- Screens are responsive (mobile web < 768 falls back to the bottom-nav layout; tablet collapses the sidebar; desktop expands it).

#### FR-46: Required screen states
Every screen implements loading (skeleton), empty, error (with retry), forbidden, and success/confirm toasts; destructive actions confirm.
**Consequences (testable):**
- A forbidden screen renders for actors without permission.

#### FR-47: Accessibility (web)
The website meets WCAG AA contrast, 44px targets, visible focus rings, and keyboard navigation.
**Consequences (testable):**
- Automated a11y checks pass on key screens.

### 4.11 Mobile App

**Description.** Native Expo app per the Figma prototype (mobile-only prototype). Android first; iOS pending (OQ-4).

**Functional Requirements:**

#### FR-48: Mobile screens
The app implements the prototype's screen inventory: Login, Dashboard, Members, Create/Edit Member (not in prototype — must be designed, OQ-6), Roles, Periods, Assignments, Integrations, Settings, plus basic Profile.
**Consequences (testable):**
- Layout patterns match DESIGN.md (top bar, 4-tab bottom nav, gold drawer, Directory tabs Members|Roles|Periods).
- Deviations D1–D5 are applied deliberately; no other deviations without recording them in DESIGN.md.

#### FR-49: Offline and states (mobile)
Mobile screens handle loading, empty, error, forbidden and offline states.
**Consequences (testable):**
- An offline state is shown when connectivity is lost.

#### FR-50: Design tokens
Tokens are implemented once (CSS variables + Tailwind theme on web; a TS token object on mobile); no hardcoded hex in components.
**Consequences (testable):**
- Exact token values are read from Figma via the Figma MCP and replace the *(approx.)* values in DESIGN.md.

### 4.12 HTTP API

**Description.** REST+JSON API under `/api/v1/*`, zod-validated, consumed by the web app and by integrations.

**Functional Requirements:**

#### FR-51: Uniform conventions
All endpoints follow the conventions in `docs/ARCHITECTURE.md` §7.
**Consequences (testable):**
- Uniform error body `{ error: { code, message, details?, requestId } }`; cursor pagination; `requestId` propagated to logs and audit.

#### FR-52: Input validation
All input is validated with zod at the API boundary; unknown fields on writes are rejected.
**Consequences (testable):**
- Parameterized queries only (Drizzle); no string-built SQL.

#### FR-53: Rate limiting
Auth, token and write endpoints are rate-limited.
**Consequences (testable):**
- Exceeding a limit returns the documented error; request-size limits apply.

#### FR-54: CORS and CSRF
Strict CORS allowlist (no wildcard with credentials) and CSRF protection for cookie-authenticated mutations.
**Consequences (testable):**
- Cross-origin credentialed requests from non-allowlisted origins are refused.

**Cross-cutting NFRs:** see §8.

## 5. Non-Goals (Explicit)

- PI-CORE is **not** an events, finance, minutes, inventory or recruitment system — those belong to other apps (PI-NEXUS, Finance, Notulensi, Panitia, Inventory).
- PI-CORE will **not** be a public identity provider for non-PMK users.
- PI-CORE will **not** support password or magic-link login, nor non-Google IdPs.
- PI-CORE will **not** implement event-scoped roles (Panitia) in MVP.
- PI-CORE will **not** modify or depend on the internals of PI-LYNK, PI-INGRESS, PI-ARK or PI-NEXUS (out of scope, never touched).
- PI-CORE will **not** store OIDC client secrets in plaintext.

## 6. MVP Scope

### 6.1 In Scope

- Google-only auth: domain allowlist, invite-only, web + mobile sessions, bootstrap super_admin.
- Member directory: list/search/filter, detail, create, update, deactivate, sensitive-field protection, avatar.
- Organization units: tree, manage, seed, subtree scoping.
- Periods: CRUD, single-active invariant, activation, period filtering.
- Roles & permissions: catalog, matrix, custom roles, single `can()`, scope-in-query, rank guard, last-super_admin guard.
- Assignments: read/manage, constraints, effective-roles derivation, end/transfer.
- Integrations & OIDC provider: register/manage, discovery, JWKS, Auth Code + PKCE, `/api/v1/access`, connection status.
- Settings & authentication configuration: allowed domains, org profile.
- Audit log: write on every mutation, read for admins.
- Admin website (desktop) + native mobile app (Android) + shared HTTP API.

### 6.2 Out of Scope for MVP

- Reports tab — deferred (no screen in prototype).
- Events and event-scoped Panitia role — deferred; Panitia position is reserved but unused.
- Notifications — deferred (icon exists, no screen).
- Legacy member data import (CSV) — deferred until data exists.
- Optional admin step-up MFA (TOTP) on top of Google — Phase 6 decision.
- iOS build — pending owner decision (needs a paid Apple Developer account).
- `report:read` permission — reserved only.

## 7. Success Metrics

**Primary**
- **SM-1**: 100% of mutation endpoints write an `audit_logs` row. Validates FR-43.
- **SM-2**: 0 endpoints without a server-side `can()` check (enforced by a failing test). Validates FR-25.
- **SM-3**: ≥1 consumer app (PI-NEXUS) authenticates users end-to-end through PI-CORE OIDC. Validates FR-36, FR-37.
- **SM-4**: A full period handover (create period → assign → activate) is completed by an org admin with no code changes. Validates FR-20, FR-21, FR-30.

**Secondary**
- **SM-5**: Mobile screens match the Figma prototype (with deviations D1–D5) on fidelity review. Validates FR-48, FR-50.
- **SM-6**: Denied authorization cases are covered by tests for every feature area. Validates FR-25, FR-26, FR-27.

**Counter-metrics (do not optimize)**
- **SM-C1**: Do **not** optimize for member-record volume or sign-in counts — PI-CORE is an internal trust service, not a growth product; chasing volume risks loosening invite-only/allowlist controls (counterbalances SM-3).
- **SM-C2**: Do **not** optimize for fewer audit rows or leaner logging — completeness of the audit trail outranks storage (counterbalances SM-1).

## 8. Cross-Cutting Non-Functional Requirements

**Security (from `docs/SECURITY.md`, non-negotiable):**
- NFR-1: ID tokens validated server-side (signature, `iss`, `aud`, `exp`, nonce/PKCE); `email_verified = true` required.
- NFR-2: Domain allowlist checked server-side; `hd` is a hint only.
- NFR-3: Invite-only with one generic denial; no account enumeration; every denial audited.
- NFR-4: Deny-by-default; single `can()`; scope enforced in the query; no privilege escalation; last `super_admin` protected.
- NFR-5: Only the active period's assignments grant access; activation audited and requires `period:activate`.
- NFR-6: Sensitive fields restricted to `member:read_sensitive`; redacted in logs/audit; soft-delete + anonymization path.
- NFR-7: RLS enabled on every table with no public policies; Data API restricted; service-role key never exposed to clients.
- NFR-8: R2 private bucket; signed URLs/authorized route; type/size validation; metadata stripped; random keys.
- NFR-9: zod on all inputs; parameterized queries; CSRF for cookie mutations; strict CORS.
- NFR-10: Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors none).
- NFR-11: Rate limiting on login/callback/token/write; request-size limits.
- NFR-12: OIDC: exact-match redirect URIs, PKCE required, short-lived codes, no implicit flow, JWKS key-rotation plan, audience-restricted tokens.
- NFR-13: No secrets in git/logs/client bundles; `.env.example` only; separate secrets per environment; lockfile committed; pinned versions; `pnpm audit` in CI; Dependabot; branch protection on `main`.
- NFR-14: Structured logs with `requestId`; never log tokens/cookies/sensitive fields; audit log append-only.
- NFR-15: Documented break-glass (revoke all sessions, rotate OIDC keys, disable an integration, recover `super_admin`).
- NFR-16: Mobile tokens only in SecureStore; system browser for Google login; validated deep-link schemes; no debug endpoints in release.

**Performance / platform:**
- NFR-17: Stay within Cloudflare Workers constraints (bundle size, CPU time) or report before enabling a paid plan; PostgreSQL accessed via Cloudflare Hyperdrive.
- NFR-18: Lists use cursor pagination; subtree/scope filtering happens in the query.

**Accessibility:**
- NFR-19: WCAG AA contrast (check brown/gold/cream combos), 44px touch targets, focus rings, labels for icon-only buttons, screen-reader names, dynamic text sizes (mobile), keyboard navigation (web).

**Observability:**
- NFR-20: Structured logs with `requestId` propagated to logs and audit.

## 9. Constraints and Guardrails

- **Privacy:** collect the minimum fields; define retention; soft-delete; anonymization path for deletion requests (NFR-6).
- **Cost:** Workers Free limits may be insufficient for Next.js via OpenNext — verify before enabling any paid plan (owner approval required). Supabase/Hyperdrive/R2 stay on free/staging tiers until the owner approves otherwise.
- **Tech constraints:** monorepo (pnpm workspaces + Turborepo), TypeScript strict; Next.js App Router on Cloudflare Workers via OpenNext; Drizzle + SQL migrations; Expo for mobile.
- **Governance:** changes to the org model, permission matrix or auth approach require an ADR + owner approval (`AGENTS.md`).

## 10. Integration and Dependencies

- **Consumers (later):** PI-NEXUS (separate repo), Finance, Notulensi, Panitia, Inventory — each registers as an Integration.
- **Out of scope, never touched:** PI-LYNK, PI-INGRESS, PI-ARK, PI-NEXUS internals.
- **External services:** Google OAuth client; Supabase (Postgres); Cloudflare (Workers, Hyperdrive, R2, rate limiting/KV, optional Access for staging); GitHub Actions for CI.
- **Domain/DNS:** custom domain `core.pmkitera.web.id` requires the zone on Cloudflare DNS (owner confirmation — OQ-1).

## 11. Rollout and Change Management

- Environments: local, **staging** (own Supabase project + own Hyperdrive), production.
- CI runs typecheck/lint/test and deploys staging automatically; production deploy and production migrations require explicit owner approval.
- Phased delivery follows the BMAD epics (seeded from `docs/phases/`): Foundation → Data & RBAC → Auth → API & Admin Web → Mobile → OIDC & Integrations → Hardening & Release.

## 12. Open Questions

1. **OQ-1** — Is `pmkitera.web.id` DNS managed in Cloudflare? Is a paid Workers plan acceptable? (`ARCHITECTURE.md` §10.4)
2. **OQ-2** — Do `pmkitera.web.id` mailboxes exist as Google accounts (Google Workspace)? If not, those users cannot use Google Sign-In. (§10.2)
3. **OQ-3** — Confirm the official spelling of the org structure and which email domain(s) are the student domain (`student.itera.ac.id`?). The allowlist must include it. (§10.3)
4. **OQ-4** — Mobile targets: Android first only, or iOS too (needs a paid Apple Developer account)? (§10.5)
5. **OQ-5** — Confirm the "Connected" definition for Integrations when PI-NEXUS integration starts. (§10.6 / FR-38)
6. **OQ-6** — Create/Edit Member screen is missing from the prototype and must be designed from tokens; confirm the fields and layout. (§10.8 / FR-48)
7. **OQ-7** — UI language: English labels (Figma default) with i18n-ready strings, or Bahasa Indonesia default? (§10.7 / D5)
8. **OQ-8** — Extra member profile fields beyond name, email, NIM, faculty, study program, cohort year, phone, photo. (§10.8)
9. **OQ-9** — Optional admin step-up MFA (TOTP) on top of Google — adopt in Phase 6? (§10.6)
10. **OQ-10** — Who holds `super_admin` (suggestion: Kepala Divisi IT / Kepala Departemen CMIT, plus a backup)? (§10.1)

## 13. Assumptions Index

- `[ASSUMPTION]` The student email domain is `student.itera.ac.id` and staff/org mailboxes use `pmkitera.web.id` — **unconfirmed** (OQ-2, OQ-3); the allowlist seeds `pmkitera.web.id`, `itera.ac.id` and likely `student.itera.ac.id` with `allow_subdomains` set where needed.
- `[ASSUMPTION]` English labels remain the default with i18n-ready strings (D5), pending OQ-7.
- `[ASSUMPTION]` Android is the first mobile target; iOS is deferred pending OQ-4.
- `[ASSUMPTION]` The MVP member profile uses exactly the fields in `ARCHITECTURE.md` §4; extra fields are deferred pending OQ-8.
- `[ASSUMPTION]` The initial org structure (BPH; 7 departments; 1 bureau; 16 divisions) is correct and names are confirmed at seed time (OQ-3).
- `[ASSUMPTION]` Workers Free limits are sufficient for staging; a paid plan is only considered if verified insufficient (NFR-17) — owner approval required.
- `[ASSUMPTION]` Panitia (event-scoped) and Reports/Events/Notifications stay deferred for MVP, matching `docs/ROADMAP.md`.
