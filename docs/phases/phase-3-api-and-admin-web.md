# PHASE 3 — Core API + admin website

> Phase spec. You (the agent) execute this when the owner says "lanjutkan" and this is the current phase per `docs/STATE.md`. Follow the Continue Protocol in `AGENTS.md`.

## ROLE
Senior full-stack engineer (Next.js, API design, authorization) and UI engineer who follows Figma precisely.

## PROJECT CONTEXT
Phases 0–2 done. The admin **website** is for desktop (and works on mobile web). The Figma prototype is mobile-only, so desktop layouts are derived per DESIGN.md "Desktop admin website". Read ARCHITECTURE (all), SECURITY, DESIGN, and skills `rbac-permissions`, `figma-to-code`, `db-migrations`.

## OBJECTIVE
Ship the versioned REST API (`/api/v1`) and the admin website for: Dashboard, Members, Periods, Org Units & Roles, Assignments, Settings (allowed domains), Audit Log (read-only), and Profile (own). Everything is permission-gated server-side and audited.

## INITIAL INVESTIGATION
1. Verify Figma MCP; fetch frames for Login, Dashboard, Members, Roles, Periods, Assignments, Settings; extract exact tokens into DESIGN.md (replace approx. values).
2. Inspect existing API/middleware, shared zod schemas, UI components. List what to reuse.
3. Note design gaps: Create/Edit Member form, desktop layouts, empty/error states. Propose them (screenshots) as part of the work; do not block.

## TECHNICAL REQUIREMENTS
API (all with zod validation, `can()` checks, scope filtering in SQL, audit on mutation, cursor pagination, uniform errors, rate limits):
- Members: list/search/filter (role, period, unit, status), get, create, update, deactivate/reactivate (soft), avatar upload to R2 (validated). Sensitive fields only with `member:read_sensitive`.
- Periods: list, create, edit, **activate** (single transaction, confirmation payload, audit). Exactly one active.
- Org units: list tree, create/edit/deactivate (guard against deactivating units with active assignments).
- Positions (read), Roles: list with member counts (active period), detail with members + positions; custom role create/edit/delete (never system roles); permission catalog read.
- Assignments: list/filter, create, end/update; enforce DB invariants + rank rule + subtree scope; role is derived from position.
- Settings: allowed email domains CRUD (`settings:manage`). `GET /me` (profile + effective access). `GET /api/v1/access` skeleton for Phase 5.
- Dashboard stats endpoint (total members, active period, available roles) with real data only.
- Audit log read with filters (`audit:read`).
Web UI:
- Auth-gated app shell: sidebar (desktop), top bar, responsive fallback to bottom-nav/drawer on small screens. Tokens from DESIGN.md.
- Screens above using TanStack-style data fetching (or the project's chosen approach), tables with sorting/filter/pagination, side sheets for create/edit, destructive confirmations, toasts, all required states (loading/empty/error/forbidden).
- Navigation items hidden when the user lacks permission (cosmetic only; server enforces).
- i18n-ready string layer (English default). Accessibility per DESIGN.md.

## EXECUTION PLAN
Plan; contracts first (shared zod schemas + OpenAPI if cheap) -> API by resource with tests -> app shell -> screens in this order: Dashboard, Periods, Members, Org/Roles, Assignments, Settings, Audit, Profile -> e2e -> fidelity review -> docs. Commit per resource/screen.

## SECURITY & QUALITY
Every route tested for allowed AND denied per role/scope (use the matrix as a table-driven test source). No N+1 queries on lists. Redact sensitive fields in audit. Optimistic concurrency (updatedAt/version) on edits to avoid silent overwrites.

## VALIDATION
Run lint/typecheck/unit/integration/e2e (Playwright or equivalent): sign in as seeded fixture personas (super admin, Ketum, Sekdep CMIT, Kadiv IT, Staff, Anggota) and verify what each can see/do; period switch changes access; U-scope cannot see other departments; assignment rank rule; two-active-period attempt fails. Screenshots of each screen vs Figma/DESIGN.md with a difference list.

## ACCEPTANCE CRITERIA
- [ ] All listed endpoints exist with tests (allowed + denied) and audit rows.
- [ ] All listed screens work end-to-end on staging with real data flow, responsive and accessible.
- [ ] Persona-based e2e passes; permissions match the architecture matrix.
- [ ] Deviations (D1–D5 and new ones) documented; fidelity report included.
- [ ] Docs/ROADMAP updated.

## DELIVERABLES
Report per AGENTS.md plus: endpoint inventory, screenshots/fidelity list, proposed designs for gaps (Create/Edit Member, desktop), performance notes.

## EXECUTION RULES
Autonomous. Ask before: changing the permission matrix, adding Reports/Events, production actions, or major visual redesign.
