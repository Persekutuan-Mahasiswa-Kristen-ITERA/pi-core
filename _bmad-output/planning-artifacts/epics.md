---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-PMK-CORE-2026-10-15/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-PMK-CORE-2026-10-15/ARCHITECTURE-SPINE.md
  - docs/ARCHITECTURE.md
  - docs/SECURITY.md
  - docs/DESIGN.md
  - docs/ROADMAP.md
  - docs/phases/phase-0..6
---

# PI-CORE - Epic Breakdown

## Overview

This document decomposes the PRD, the architecture spine and `docs/DESIGN.md` into implementable epics and stories for **PI-CORE**. Epics are seeded from `docs/phases/phase-0..6` (Epic 1 Foundation … Epic 7 Hardening & Release) as `docs/BMAD-INTEGRATION.md` mandates. Every story is sized for one dev agent, has testable acceptance criteria, and (where it touches access) carries authorization **denied-case** tests in its Definition of Done. `status: draft` — this is the owner-review gate.

## Requirements Inventory

### Functional Requirements

FR-1: Sign in with Google (web). · FR-2: Sign in with Google (mobile, system browser + PKCE). · FR-3: Domain allowlist enforced server-side. · FR-4: Invite-only admission (generic denial, no enumeration). · FR-5: Session lifecycle (rotating refresh; revoke on deactivation). · FR-6: Bootstrap first `super_admin` (env email). · FR-7: Audit every denied authentication. · FR-8: List/search members (cursor pagination, scope in query). · FR-9: View member detail (sensitive fields gated). · FR-10: Create member. · FR-11: Update member (field rules per matrix). · FR-12: Deactivate member (soft). · FR-13: Sensitive-field protection (redaction, anonymization path). · FR-14: Avatar upload (private R2). · FR-15: Read organization tree. · FR-16: Manage organization units. · FR-17: Seed initial structure (idempotent). · FR-18: Subtree scoping in query. · FR-19: Create/edit period. · FR-20: Single active period invariant. · FR-21: Activate period (audited). · FR-22: Period-scoped filtering. · FR-23: Read roles and permission matrix. · FR-24: Create/edit custom roles. · FR-25: Single `can()` on every endpoint. · FR-26: Scope enforced in the query. · FR-27: Rank-based escalation guard. · FR-28: Last `super_admin` protection. · FR-29: Read assignments (scoped). · FR-30: Manage assignments. · FR-31: Effective-roles derivation (active period only). · FR-32: Role shown read-only in the assignment UI. · FR-33: Assignment end/transfer. · FR-34: Register/manage integrations. · FR-35: OIDC discovery + JWKS. · FR-36: Authorization Code + PKCE flow. · FR-37: `/api/v1/access` endpoint. · FR-38: Integration connection status. · FR-39: No cross-subdomain cookie sharing. · FR-40: View/edit allowed email domains. · FR-41: Organization profile settings. · FR-42: Settings access control. · FR-43: Audit every mutation. · FR-44: Read audit log. · FR-45: Admin surfaces. · FR-46: Required screen states. · FR-47: Accessibility (web). · FR-48: Mobile screens. · FR-49: Offline/states (mobile). · FR-50: Design tokens. · FR-51: Uniform API conventions. · FR-52: Input validation. · FR-53: Rate limiting. · FR-54: CORS and CSRF.

### NonFunctional Requirements

NFR-1: Validate ID tokens server-side; require `email_verified`. · NFR-2: Domain allowlist server-side; `hd` is a hint only. · NFR-3: One generic denial; no enumeration; denials audited. · NFR-4: Deny-by-default; single `can()`; scope in query; no privilege escalation; last `super_admin` protected. · NFR-5: Only active-period assignments grant access; activation audited. · NFR-6: Sensitive fields gated + redacted; soft-delete + anonymization. · NFR-7: RLS on every table, no public policies; Data API disabled. · NFR-8: R2 private; signed access; validate/strip/random keys. · NFR-9: zod on all inputs; parameterized queries; CSRF; strict CORS. · NFR-10: Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors none). · NFR-11: Rate limit auth/token/write; request-size limits. · NFR-12: OIDC exact redirect URIs, PKCE, short codes, no implicit, JWKS rotation, audience-restricted. · NFR-13: No secrets in git/logs/bundles; `.env.example` only; per-env secrets; lockfile; pinned; `pnpm audit` in CI; Dependabot; branch protection. · NFR-14: Structured logs with `requestId`; audit append-only. · NFR-15: Documented break-glass. · NFR-16: Mobile tokens only in SecureStore; system browser; validated deep links; no debug in release. · NFR-17: Fit Workers Free (10 ms CPU, 3 MiB, 100k req/day) or re-scope. · NFR-18: Cursor pagination; scope filtering in query. · NFR-19: WCAG AA, 44px targets, focus rings, labels, dynamic text, keyboard nav. · NFR-20: `requestId` propagated to logs and audit.

### Additional Requirements

- Monorepo: pnpm workspaces + Turborepo; TypeScript strict everywhere.
- `apps/web` = Next.js 16 (App Router) + Tailwind + shadcn/ui, deployed via `@opennextjs/cloudflare` (Node runtime, `nodejs_compat`), **static-first** to fit Workers Free (ADR-0010).
- `apps/mobile` = Expo SDK 57 + Expo Router (`expo-auth-session`, `expo-secure-store`).
- `packages/db` = Drizzle ORM (`drizzle-orm/node-postgres`, `pg` ≥8.13.0) + SQL migrations + seeds; Postgres on Supabase via **Hyperdrive direct connection**; Data API disabled; RLS on every table (ADR-0009).
- `packages/shared` = zod schemas, permission/role constants, API types, pure `can()`.
- Auth = **Better Auth** (Google) + `@better-auth/oauth-provider` (OIDC) + `@better-auth/expo` (ADR-0007).
- Cloudflare: Workers Free, Hyperdrive, R2 (avatars/logo); staging on `*.workers.dev`; custom domain deferred (ADR-0003).
- Invariants AD-1…AD-15 from the architecture spine are binding.
- CI: GitHub Actions typecheck/lint/test + staging deploy; production deploy/migrations require owner approval.
- Secrets via `wrangler secret` / EAS / GitHub secrets; `.env.example` only.
- Phase 0 must measure CPU + compressed bundle (ADR-0008) before committing to the Next.js-on-Workers shape.

### UX Design Requirements

UX-DR1: Implement the **exact** token set once (colors, Manrope/Poppins/Inter, radii, shadows, spacing) as CSS variables + Tailwind theme (web) and a TS token object (mobile); no hardcoded hex. · UX-DR2: Shared components: TopBar, BottomNav, Drawer (gold `#E6C65C`), Card, ListRow, StatCard, Button, Input, Tabs, Dialog, Toast, EmptyState. · UX-DR3: Every screen implements loading/empty/error/forbidden states (+ offline on mobile). · UX-DR4: Apply deviations D1–D5 deliberately (Google-only login; assignment form with Unit + derived read-only Role; system roles locked; dashboard stats; **Bahasa Indonesia default**). · UX-DR5: Design + build the missing **Create/Edit Member** screen from tokens. · UX-DR6: Desktop admin website derived from mobile tokens (sidebar, tables, side sheets); owner reviews before release. · UX-DR7: Accessibility — WCAG AA contrast, 44px targets, focus rings, labels for icon-only buttons, screen-reader names, dynamic text, keyboard nav. · UX-DR8: Per-screen fidelity check (screenshot vs Figma frame) with differences listed.

### FR Coverage Map

FR-1→E3 · FR-2→E3 · FR-3→E3 · FR-4→E3 · FR-5→E3 · FR-6→E3 · FR-7→E3 · FR-8→E4 · FR-9→E4 · FR-10→E4 · FR-11→E4 · FR-12→E4 · FR-13→E4 · FR-14→E4 · FR-15→E2 · FR-16→E2 · FR-17→E2 · FR-18→E2 · FR-19→E4 · FR-20→E4 · FR-21→E4 · FR-22→E4 · FR-23→E2 · FR-24→E2 · FR-25→E2 · FR-26→E2 · FR-27→E2 · FR-28→E2 · FR-29→E4 · FR-30→E4 · FR-31→E2 · FR-32→E4 · FR-33→E4 · FR-34→E6 · FR-35→E6 · FR-36→E6 · FR-37→E6 · FR-38→E6 · FR-39→E6 · FR-40→E4 · FR-41→E4 · FR-42→E4 · FR-43→E2 · FR-44→E2 · FR-45→E4 · FR-46→E4 · FR-47→E4 · FR-48→E5 · FR-49→E5 · FR-50→E4 · FR-51→E4 · FR-52→E4 · FR-53→E4 · FR-54→E4 · FR-55→E8 · FR-56→E8 · FR-57→E8

## Epic List

### Epic 1: Foundation
A working, deployable monorepo skeleton on Cloudflare staging with CI and verified commands — the ground everything else stands on.
**FRs covered:** (enabler — no direct FRs; NFR-13, NFR-17; AD-11, AD-12)

### Epic 2: Data & RBAC
The data model (members, org units, periods, positions, assignments, roles/permissions, audit) plus the pure `can()` authorization core, seeded and tested — so access can be decided before any UI exists.
**FRs covered:** FR-15, FR-16, FR-17, FR-18, FR-23, FR-24, FR-25, FR-26, FR-27, FR-28, FR-31, FR-43, FR-44

### Epic 3: Authentication
Google-only, invite-only sign-in for web and mobile, with sessions, revocation and a bootstrapped `super_admin` — so a real person can log in and be authorized.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7

### Epic 4: API & Admin Web
The `/api/v1` API and the desktop admin website: members, units, periods, roles, assignments, settings and audit — the management surface pengurus actually use.
**FRs covered:** FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-19, FR-20, FR-21, FR-22, FR-29, FR-30, FR-32, FR-33, FR-40, FR-41, FR-42, FR-45, FR-46, FR-47, FR-50, FR-51, FR-52, FR-53, FR-54

### Epic 5: Mobile App
The native Expo app for Android (and iOS dev builds) matching the Figma prototype — members and pengurus on their phones.
**FRs covered:** FR-48, FR-49

### Epic 6: OIDC & Integrations
PI-CORE as an OIDC provider and the Integrations screen — so PI-NEXUS and the other apps delegate login and authorization to PI-CORE.
**FRs covered:** FR-34, FR-35, FR-36, FR-37, FR-38, FR-39

### Epic 7: Hardening & Release
Security hardening, end-to-end tests, accessibility, observability and the release runbook — so the system can be trusted in production.
**FRs covered:** (cross-cutting NFRs; e2e/quality bar)

### Epic 8: Real-time Updates
Web and mobile reflect data changes live — members, assignments, periods, roles, integrations, settings and audit — through one hub, so nobody works on stale data. *(New requirement, ADR-0011. Delivered after Epic 4 (API) and alongside Epic 5 (Mobile).)*
**FRs covered:** FR-55, FR-56, FR-57

> **Plan impact — ADR-0013 (2026-10-15, owner-approved).** Staging measurements showed the Next.js/OpenNext server exceeds the Workers **Free** 10 ms CPU limit on every request (14–303 ms measured; 150+ requests still returned 200 only via the runtime's undocumented flexibility). The architecture is therefore **static-first + thin API Worker** (spine **AD-17**): `apps/web` becomes a **build-time static export** served from Cloudflare static assets (0 Worker CPU per page view), and a new **`apps/api`** — a thin **Hono** Worker — owns `/api/v1/*`, the `RealtimeHub` Durable Object, the OIDC endpoints and Hyperdrive DB access, all in one Worker deployment.
> **Affected stories:** **1.2** — the Next.js scaffold stands, but its OpenNext/Workers deployment is superseded; a follow-up story converts `apps/web` to static export and adds `apps/api`. **Epic 4 (UI)** — pages are client-rendered over the API instead of SSR. **Epic 6 (OIDC)** and **Epic 8 (real-time)** — served from `apps/api`. Detailed story rewrites land when each epic starts; the rest of the backlog is unchanged.

## Epic 1: Foundation

A working, deployable monorepo skeleton on Cloudflare staging with CI and verified commands.

### Story 1.1: Monorepo scaffold
As the implementation agent,
I want a pnpm-workspaces + Turborepo monorepo with TypeScript strict and a shared config package,
So that every app/package builds, lints and typechecks from one root.
**Acceptance Criteria:**
**Given** a clean checkout, **When** I run the install command, **Then** `apps/*` and `packages/*` are linked and `pnpm -r typecheck` passes.
**And** `packages/config` provides the shared tsconfig/eslint/prettier.
**And** the lockfile is committed.

### Story 1.2: Next.js app + OpenNext + Wrangler config
As the implementation agent,
I want `apps/web` as a Next.js 16 App Router app configured for `@opennextjs/cloudflare` with a Wrangler config (`nodejs_compat`, assets binding),
So that it can build and run on Cloudflare Workers.
**Acceptance Criteria:**
**Given** `apps/web`, **When** I run the build, **Then** `.open-next/worker.js` is produced and the compressed worker size is reported.
**And** `wrangler.jsonc` sets `compatibility_flags: ["nodejs_compat"]`, `assets`, and an observability flag.

### Story 1.3: CI pipeline
As the implementation agent,
I want GitHub Actions running typecheck, lint and test on every push,
So that regressions are caught before merge.
**Acceptance Criteria:**
**Given** a pull request, **When** CI runs, **Then** typecheck/lint/test execute and the check is required.
**And** `pnpm audit` runs in CI; Dependabot is enabled; `main` is branch-protected (NFR-13).

### Story 1.4: Cloudflare staging "hello" deploy
As the implementation agent,
I want a staging Worker deployed to a `*.workers.dev` subdomain serving a hello page,
So that the deploy path is proven end to end.
**Acceptance Criteria:**
**Given** the staging config, **When** I deploy, **Then** the Worker answers on `*.workers.dev` and no secret is in the repo or bundle.
**And** secrets are set via `wrangler secret`; `.env.example` is committed (NFR-13).

### Story 1.5: Baseline measurements + verified commands
As the owner,
I want the Workers Free budget measured and the real commands recorded,
So that we know the design fits before building on it.
**Acceptance Criteria:**
**Given** a representative flow, **When** I measure, **Then** CPU time and compressed Worker size are recorded in `docs/STATE.md`.
**And** the verified commands (install/dev/lint/typecheck/test/build/deploy:staging/mobile dev) are filled into `AGENTS.md` "## Commands" (ADR-0008/0010).

## Epic 2: Data & RBAC

The data model plus the pure `can()` core, seeded and tested.

### Story 2.1: DB package, Hyperdrive wiring, first migration
As the implementation agent,
I want `packages/db` with Drizzle over the `HYPERDRIVE` binding and a first SQL migration creating `members` and `org_units` (RLS enabled),
So that the app can read/write Postgres through Hyperdrive.
**Acceptance Criteria:**
**Given** the Hyperdrive binding, **When** a Worker runs a query, **Then** it succeeds against Supabase and the migration applies cleanly on an empty DB.
**And** `members` and `org_units` have RLS enabled with no public policies (NFR-7).

### Story 2.2: Seed the organization structure
As a BPH admin,
I want the initial org tree seeded idempotently,
So that units exist to assign people to.
**Acceptance Criteria:**
**Given** an empty DB, **When** I run the seed, **Then** BPH, 7 departments, 1 bureau and 16 divisions exist with unique slugs.
**And** re-running the seed creates no duplicates (FR-17).

### Story 2.3: Periods, positions and assignments schema
As a BPH admin,
I want periods, positions and assignments modeled with their constraints,
So that access can be derived from the active period.
**Acceptance Criteria:**
**Given** the schema, **When** I create two active periods, **Then** the partial unique index rejects the second (FR-20).
**And** `unique(member, unit, position, period)` and `org_unit.type = position.unit_type` hold (FR-30); assigning a unique-per-unit position twice in one unit/period is rejected.

### Story 2.4: Roles, permissions and position_roles seed
As a super_admin,
I want the permission catalog and system roles seeded, with `position_roles` mapping positions to default roles,
So that roles are data, not code.
**Acceptance Criteria:**
**Given** a seeded DB, **When** I read roles, **Then** the system roles exist and are marked immutable (FR-23, D3).
**And** `position_roles` reflects `docs/ARCHITECTURE.md` §3 (incl. ADR-0002: all Kepala Departemen/Biro → `organization_admin`).

### Story 2.5: The `can()` authorization core
As the implementation agent,
I want a pure `can(actor, permission, target?)` in `packages/shared` implementing the matrix and scope (O/U/S),
So that authorization is decided in one tested place.
**Acceptance Criteria:**
**Given** an actor with a permission, **When** `can()` is called, **Then** it returns true only for the allowed scope; unlisted permissions are denied (FR-25, NFR-4).
**And** unit tests cover every matrix cell, both allowed and denied.

### Story 2.6: Effective roles + audit log
As a super_admin,
I want effective roles derived from the active period and every mutation written to an append-only audit log,
So that access is correct and changes are provable.
**Acceptance Criteria:**
**Given** assignments in the active period, **When** I compute a member's roles, **Then** they are the union of `position_roles` + `system_grants` + implicit `anggota`, ignoring non-active periods (FR-31).
**And** `audit_logs` has no UPDATE/DELETE grants and every mutation writes one row (FR-43).

### Story 2.7: RBAC integration tests (denied cases)
As the implementation agent,
I want integration tests covering allowed AND denied cases, rank guard and last-`super_admin` protection,
So that the security rules are proven.
**Acceptance Criteria:**
**Given** a U-scoped manager, **When** they try to assign a more senior position or a unit outside their subtree, **Then** it is refused and audited (FR-27).
**And** removing the last `super_admin` is refused (FR-28); a route lacking an authorization check fails the test (FR-25).

## Epic 3: Authentication

Google-only, invite-only sign-in for web and mobile.

### Story 3.1: Google sign-in + member linking (web)
As an anggota,
I want to sign in with my Google account,
So that I can use PI-CORE without a password.
**Acceptance Criteria:**
**Given** an allowed, active member, **When** they complete Google sign-in, **Then** a secure httpOnly session is issued and `google_sub` is linked (FR-1).
**And** the ID token is validated server-side with `email_verified = true` required (NFR-1).

### Story 3.2: Domain allowlist + invite-only
As the org,
I want only allowlisted domains and existing active members admitted,
So that membership stays closed.
**Acceptance Criteria:**
**Given** a non-allowlisted or unknown email, **When** they attempt sign-in, **Then** they get one generic denial, no enumeration, and an audit row (FR-3, FR-4, FR-7, NFR-2/3).

### Story 3.3: Mobile sign-in (Expo)
As an anggota,
I want to sign in on the mobile app via the system browser,
So that I get a secure session on my phone.
**Acceptance Criteria:**
**Given** the Expo app, **When** the user signs in, **Then** OAuth uses the system browser with PKCE and tokens are stored only in `expo-secure-store` (FR-2, NFR-16).

### Story 3.4: Bootstrap first `super_admin`
As the owner,
I want a one-off seed that creates the first `super_admin` from an env email,
So that the system can be administered without hardcoding.
**Acceptance Criteria:**
**Given** an env email, **When** the seed runs, **Then** that member is granted `super_admin` and the grant is audited; no email is hardcoded (FR-6).

### Story 3.5: Session revocation
As a super_admin,
I want deactivation or role removal to invalidate sessions/tokens promptly,
So that access ends when it should.
**Acceptance Criteria:**
**Given** an active session, **When** the member is deactivated or loses a role, **Then** their sessions/tokens are revoked within the documented window (FR-5, NFR-5).

## Epic 4: API & Admin Web

The `/api/v1` API and the desktop admin website.

### Story 4.1: API foundation (conventions, errors, validation, limits)
As the implementation agent,
I want the API conventions in place (error envelope, `requestId`, zod validation, rate limiting, CORS/CSRF, security headers),
So that every endpoint behaves uniformly and safely.
**Acceptance Criteria:**
**Given** any endpoint, **When** input is invalid, **Then** it returns `{ error: { code, message, requestId } }` (FR-51, FR-52).
**And** write/auth endpoints are rate-limited (FR-53); credentialed cross-origin requests are restricted (FR-54); security headers are set (NFR-10).

### Story 4.2: Members list, search and detail
As a pengurus,
I want to search and open members within my scope,
So that I can find people.
**Acceptance Criteria:**
**Given** a U-scoped actor, **When** they list members, **Then** the query is filtered by their unit subtree (FR-8, FR-26).
**And** sensitive fields appear only for `member:read_sensitive` (FR-9).

### Story 4.3: Member create / update / deactivate
As a super_admin/org_admin,
I want to create, edit and deactivate members,
So that the directory stays correct.
**Acceptance Criteria:**
**Given** `member:create`, **When** a member is created, **Then** unknown fields are rejected and an audit row is written (FR-10, FR-43).
**And** deactivation is soft and revokes sessions (FR-12); a member can update their own profile only within `profile:update_own` (FR-11).

### Story 4.4: Avatar upload (R2)
As a member,
I want to upload a profile photo,
So that people can recognize me.
**Acceptance Criteria:**
**Given** the avatar route, **When** I upload, **Then** a presigned PUT is used with type/size validation, a random namespaced key, metadata stripped (FR-14, NFR-8).

### Story 4.5: Organization units read/manage
As a super_admin/org_admin,
I want to view and manage the unit tree,
So that structure changes are data changes.
**Acceptance Criteria:**
**Given** `orgunit:manage`, **When** I rename/move a unit, **Then** slug uniqueness and `type`/position consistency hold and the change is audited (FR-16); referenced units are soft-deleted only (FR-15, FR-18).

### Story 4.6: Periods CRUD, activation and filtering
As a BPH admin,
I want to create, edit and activate periods,
So that handover is a few clicks.
**Acceptance Criteria:**
**Given** `period:activate`, **When** I activate a period, **Then** it happens in one transaction, exactly one period is active, and it is audited (FR-19/20/21).
**And** members/assignments can be filtered by period (FR-22).

### Story 4.7: Roles read + custom roles
As a super_admin,
I want to view roles/permissions and create custom roles,
So that bundles fit the org.
**Acceptance Criteria:**
**Given** `role:read`, **When** I open a system role, **Then** it is read-only with a lock (FR-23, D3); with `role:manage` I can create a custom role from the fixed catalog (FR-24).

### Story 4.8: Assignments read/manage + derived role
As a pengurus,
I want to assign members to unit/position/period with the role derived,
So that access follows the structure.
**Acceptance Criteria:**
**Given** the assignment form, **When** I pick a position, **Then** the Role is derived and read-only (FR-32); the rank/subtree guards apply (FR-27).
**And** assignments can be ended/transferred (FR-33); only active-period assignments grant access (FR-31).

### Story 4.9: Settings — allowed domains + org profile
As a super_admin,
I want to manage allowed email domains and the org profile,
So that sign-in and branding are configurable.
**Acceptance Criteria:**
**Given** `settings:manage`, **When** I edit allowed domains, **Then** changes take effect for subsequent sign-ins and are audited (FR-40).
**And** `settings:read`/`manage` are super_admin-only (FR-42); the logo is served from R2 (FR-41).

### Story 4.10: Audit log UI
As an org admin,
I want to browse the audit log,
So that I can see who changed what.
**Acceptance Criteria:**
**Given** `audit:read`, **When** I open the audit view, **Then** entries show actor/action/entity/time with sensitive fields redacted (FR-44, FR-13); non-holders are refused.

### Story 4.11: Admin web shell, tokens, components, states
As a pengurus,
I want a desktop admin website consistent with the design tokens,
So that management is efficient on desktop.
**Acceptance Criteria:**
**Given** the web app, **When** it renders, **Then** the exact token set is applied via CSS variables + Tailwind (no hardcoded hex) and shared components are reused (FR-50, UX-DR1/2).
**And** every screen implements loading/empty/error/forbidden states (FR-46) and WCAG AA / keyboard nav (FR-47, UX-DR7); sidebar + tables + side sheets replace the mobile patterns (FR-45, UX-DR6).

### Story 4.12: Create/Edit Member screen
As a pengurus,
I want a Create/Edit Member screen,
So that I can onboard people.
**Acceptance Criteria:**
**Given** the screen (absent from the prototype), **When** I open it, **Then** it uses the token-styled inputs, validates per field, and renders a forbidden state without permission (UX-DR5, FR-10/11).

## Epic 5: Mobile App

The native Expo app matching the Figma prototype.

### Story 5.1: Mobile shell, tokens and components
As an anggota,
I want the app shell (top bar, gold drawer, bottom nav) built from the design tokens,
So that it matches the prototype.
**Acceptance Criteria:**
**Given** the Expo app, **When** it renders, **Then** the TS token object is used (no hardcoded hex) and the shared components exist (UX-DR1/2).
**And** the drawer is `#E6C65C` and the bottom nav has Home/Directory/Reports/Profile (FR-48).

### Story 5.2: Mobile auth screens
As an anggota,
I want the Login screen (Google-only) per D1,
So that I can sign in.
**Acceptance Criteria:**
**Given** the Login screen, **When** it renders, **Then** it shows the brown header + logo and only "Continue with Google" (no email/password) (D1, FR-2).

### Story 5.3: Mobile core screens
As a pengurus,
I want Dashboard, Members, Create/Edit Member, Roles, Periods, Assignments, Integrations and Settings on mobile,
So that I can manage on the go.
**Acceptance Criteria:**
**Given** the screens, **When** they render, **Then** they match the Figma frames (node IDs in `docs/DESIGN.md`) and apply D1–D5, Bahasa Indonesia default (FR-48, UX-DR4).

### Story 5.4: Mobile states, a11y and fidelity check
As an anggota,
I want loading/empty/error/forbidden/offline states and accessible controls,
So that the app is usable and robust.
**Acceptance Criteria:**
**Given** no connectivity, **When** a screen loads, **Then** an offline state shows (FR-49); 44px targets and screen-reader names are present (UX-DR7).
**And** each screen has a screenshot-vs-Figma fidelity note listing differences (UX-DR8).

## Epic 6: OIDC & Integrations

PI-CORE as an OIDC provider and the Integrations screen.

### Story 6.1: OIDC provider (discovery, JWKS, PKCE)
As a consumer app,
I want PI-CORE to be an OIDC issuer,
So that I can authenticate users through it.
**Acceptance Criteria:**
**Given** the provider, **When** a client fetches `/.well-known/openid-configuration` and the JWKS, **Then** they are served; Authorization Code + PKCE works and implicit flow is not supported (FR-35, FR-36, NFR-12).

### Story 6.2: Integrations management
As a super_admin,
I want to register and edit integrations (client id, redirect URIs, scopes, status),
So that apps can connect.
**Acceptance Criteria:**
**Given** `integration:manage`, **When** I register an integration, **Then** no plaintext client secret is stored (hash or public+PKCE) and the change is audited (FR-34).
**And** `integration:read` (org admins) is read-only.

### Story 6.3: `/api/v1/access` endpoint
As a consumer app,
I want an endpoint returning the user's active period, assignments, roles and permissions,
So that I can authorize without trusting the client.
**Acceptance Criteria:**
**Given** a Bearer access token, **When** I call `/api/v1/access`, **Then** I receive the active period, assignments, roles and permission keys; the ID token stays small (FR-37).

### Story 6.4: Integrations screen + connection status + PI-NEXUS contract
As a super_admin,
I want to see Connected / Not Connected per integration,
So that I know what is live.
**Acceptance Criteria:**
**Given** the Integrations screen, **When** it renders, **Then** status follows the accepted definition (enabled AND ≥1 successful authorization in a window) and shows client id/redirect URIs/scopes/last authorized (FR-38); no cross-subdomain cookies are used (FR-39).
**And** a test client completes the full OIDC flow end to end.

## Epic 7: Hardening & Release

Security hardening, e2e, accessibility, observability and release.

### Story 7.1: Security hardening pass
As the org,
I want the SECURITY.md rules verified across the system,
So that the trust root is sound.
**Acceptance Criteria:**
**Given** the system, **When** I run the hardening checklist, **Then** headers, rate limits, RLS, redaction and the break-glass runbook are verified (NFR-10/11/14/15).

### Story 7.2: End-to-end tests
As the implementation agent,
I want e2e tests for login → dashboard → assign member (web) plus denied cases,
So that the core flows are proven.
**Acceptance Criteria:**
**Given** a staging build, **When** e2e runs, **Then** the happy path passes and a denied case is asserted (quality bar §9).

### Story 7.3: Performance & a11y verification
As the owner,
I want CPU/bundle and accessibility verified against the budgets,
So that Workers Free still holds at release.
**Acceptance Criteria:**
**Given** the release build, **When** measured, **Then** CPU/bundle are within the Workers Free budget or the re-scope is reported (NFR-17, ADR-0008/0010); a11y checks pass on key screens (NFR-19).

### Story 7.4: Observability
As a super_admin,
I want structured logs with `requestId` and an append-only audit log,
So that incidents are diagnosable.
**Acceptance Criteria:**
**Given** a request, **When** it is logged, **Then** the log is structured with `requestId` and contains no secrets/sensitive fields (NFR-14, NFR-20).

### Story 7.5: Release runbook + store builds
As the owner,
I want a documented release (prod deploy, migrations) and Android build,
So that we can ship safely.
**Acceptance Criteria:**
**Given** owner approval, **When** we release, **Then** production deploy and migrations run per the runbook; the Android build is produced; iOS stays dev-only (ADR-0004). **Production deploy requires explicit owner approval.**

## Epic 8: Real-time Updates

Web and mobile reflect data changes live through one hub.

### Story 8.1: Real-time hub + event publishing
As the implementation agent,
I want a `RealtimeHub` Durable Object (WebSocket Hibernation) that every mutation publishes to,
So that clients can be notified of changes live.
**Acceptance Criteria:**
**Given** a mutation, **When** it commits, **Then** an event `{ topic, entity, id, action, at }` is published to the hub and the `audit_logs` row is written (FR-55, AD-16).
**Given** an idle WebSocket connection, **When** nothing happens, **Then** it uses the Hibernation API and accrues no duration cost; SSE is available as a fallback (ADR-0011).
**And** the DO uses a `new_sqlite_classes` migration (Free-plan requirement) and DO requests are counted against the Workers Free daily limit.

### Story 8.2: Admin website live updates
As a pengurus,
I want the website to update itself when others change data,
So that I never work on stale data.
**Acceptance Criteria:**
**Given** two logged-in users, **When** one changes a member/assignment/period/role/integration/setting within the other's scope, **Then** the other's view updates within ~2 s (FR-56, NFR-21).
**And** the audit view updates live for `audit:read` holders.

### Story 8.3: Mobile live updates
As an anggota/pengurus,
I want the mobile app to update live,
So that my phone shows the same state as the website.
**Acceptance Criteria:**
**Given** the Expo app, **When** it subscribes over the channel, **Then** affected screens update live; losing connectivity shows the offline state and resyncs on reconnect (FR-57, FR-49).

### Story 8.4: Scope-safe fan-out + real-time tests
As the org,
I want the real-time channel to never leak data beyond a client's scope,
So that live updates cannot bypass authorization.
**Acceptance Criteria:**
**Given** a U-scoped client, **When** an event for another subtree occurs, **Then** the client cannot obtain that data (the channel carries ids only and the re-fetch is scope-filtered) — a test asserts it (AD-16, NFR-21).
**And** subscriptions are authorized at connect time.
