# PHASE 1 — Data model, org seed, RBAC core

> Phase spec. You (the agent) execute this when the owner says "lanjutkan" and this is the current phase per `docs/STATE.md`. Follow the Continue Protocol in `AGENTS.md`.

## ROLE
Senior backend/data engineer with strong authorization-design experience.

## PROJECT CONTEXT
Phase 0 is complete (see `docs/ROADMAP.md`). PI-CORE models PMK ITERA's structure: BPH, 7 departments (16 divisions in total), 1 bureau; positions, roles, permissions and per-period assignments. The full design is in `docs/ARCHITECTURE.md` sections 2–4. Read it plus the `db-migrations` and `rbac-permissions` skills.

## OBJECTIVE
Implement the database schema, idempotent seeds (structure, positions, roles, permission catalog, role-permission scopes, position-role mapping), and the pure `can()` authorization engine with a comprehensive test suite, all matching the architecture matrix. No UI, no auth yet.

## INITIAL INVESTIGATION
Inspect the current `packages/db` and `packages/shared`, migration history, and which DB (local/staging) you target. Re-read ARCHITECTURE §3 and §4. Check whether `ltree`/closure-table/path is best for subtree queries on Postgres via Hyperdrive and record it in an ADR. Note any inconsistency in the docs before coding (e.g., positions vs unit types) and resolve it via ADR rather than silently.

## TECHNICAL REQUIREMENTS
- Drizzle schema + SQL migrations for all tables in ARCHITECTURE §4, with DB-level constraints (single active period partial unique index; unique `is_unique_per_unit` positions per unit+period; unit-type/position-type check; FKs; soft delete) and appropriate indexes. RLS enabled, no public policies. Append-only `audit_logs`.
- Seeds (idempotent upserts by stable keys): org units exactly as ARCHITECTURE §2; positions + ranks; roles; permissions; role_permissions with scopes; position_roles; `allowed_email_domains` (pmkitera.web.id, itera.ac.id, student.itera.ac.id flagged "to confirm"); a dev-only fixture set (fake members/assignments) clearly separated and never run in production.
- `packages/shared`: permission catalog (typed constants), `Actor` type, `can(actor, permission, target?)` pure function, `buildActor` input/output contracts, rank rule for U-scoped assignment management, subtree helper contracts.
- DB access layer: `getActorContext(memberId)` (active period assignments + system grants -> roles -> permissions), subtree-scoped query helpers.
- Audit helper `writeAudit(...)` used by future mutations; sensitive-field redaction utility with tests.

## EXECUTION PLAN
1. Plan + ADR(s). 2. Schema + migrations. 3. Seeds. 4. `can()` + catalog. 5. Actor/context + scoped query helpers. 6. Tests. 7. Verify migrations on empty DB and current state; seed twice. 8. Update docs/ROADMAP.

## SECURITY & QUALITY
Deny by default. No raw SQL string concatenation. Constraints enforced in DB. Tests must include denied cases and escalation attempts (see `rbac-permissions`). Do not store personal data in seeds.

## VALIDATION
Real outputs for: migrate empty DB, migrate staging copy, seed x2 (second run no-op), unit tests for `can()` across the whole matrix (table-driven from the architecture matrix), integration tests for constraints (two active periods rejected, duplicate Kepala Divisi in same unit+period rejected, wrong unit type rejected), subtree query correctness, period-switch behavior.

## ACCEPTANCE CRITERIA
- [ ] Schema + seeds produce exactly: 1 BPH, 7 departments, 1 bureau, 16 divisions; positions/roles/permissions per ARCHITECTURE.
- [ ] Matrix in code == matrix in docs (a test asserts it).
- [ ] All invariants enforced by DB and covered by tests; seeds idempotent.
- [ ] `can()` coverage: every permission x role x scope (allowed + denied).
- [ ] ADRs written; docs updated; no unrelated changes.

## DELIVERABLES
Report per AGENTS.md; include the final ERD (mermaid in `docs/`), test summary, and any doc/matrix corrections proposed.

## EXECUTION RULES
Autonomous within scope. Ask before: changing the matrix/org model, running anything on production, destructive DB operations.
