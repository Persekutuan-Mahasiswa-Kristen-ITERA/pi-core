# PHASE 6 — Hardening, audit, production release

> Phase spec. You (the agent) execute this when the owner says "lanjutkan" and this is the current phase per `docs/STATE.md`. Follow the Continue Protocol in `AGENTS.md`.

## ROLE
Senior release/security engineer.

## PROJECT CONTEXT
Features from Phases 0–5 are complete on staging. Goal: production readiness for the web/API on Cloudflare and mobile distribution, with documented operations.

## OBJECTIVE
Security review and fixes, full e2e coverage of critical journeys, observability, backup/recovery, production deployment (with owner approval), and mobile release builds.

## INITIAL INVESTIGATION
Review SECURITY.md line by line against the codebase and produce a gap table (requirement -> verified? evidence). Check dependency audit, CSP/headers on staging, RLS posture and Supabase Data API exposure, rate-limit config, log contents, Workers limits at real load, backup settings on the production Supabase project, DNS/custom domain status.

## TECHNICAL REQUIREMENTS
- Fix all security gaps found; add regression tests. Headers/CSP verified on deployed responses. Dependency audit clean or justified.
- E2E suites: login/denial paths, member lifecycle, assignment with rank rule, period activation, OIDC flow, deactivation -> immediate loss of access, persona matrix.
- Observability: structured logs with request ids, error reporting (choose a minimal solution; justify any paid tool), uptime check on `/api/v1/health`, alerting contacts for the owner.
- Operations docs in `docs/OPERATIONS.md`: deploy, rollback, migrations in production, key rotation (OIDC signing, secrets), revoke-all-sessions, disable-integration, super-admin recovery, backup/restore drill steps, on-call checklist.
- Optional (owner decision pending): TOTP step-up for admin roles — present a short ADR with options; implement only if approved.
- Production: separate Supabase project, Hyperdrive, R2, secrets, custom domain `core.pmkitera.web.id`; production workflow with manual approval; migrations applied as a gated step after a backup.
- Mobile: production EAS build (Android), store listing checklist; iOS only if the owner provides accounts.
- Data: member import tool (CSV, dry-run first, validation report) ONLY if the owner supplies data/format by now; otherwise document the approach.

## EXECUTION PLAN
Gap analysis -> fixes + tests -> e2e -> observability -> docs -> production readiness checklist -> **stop and ask for owner approval** -> production deploy + migrations -> smoke tests -> release builds -> handover report.

## VALIDATION
Show: CI green incl. e2e, header scan output, audit output, backup restore drill result (on a non-prod copy), staging soak results, production smoke tests, mobile release build artifact. Be explicit about anything not tested.

## ACCEPTANCE CRITERIA
- [ ] SECURITY.md gap table: every item verified with evidence or an owner-accepted exception.
- [ ] Production deployed with approval; health + login + OIDC smoke tests pass.
- [ ] `OPERATIONS.md` complete and rollback tested on staging.
- [ ] Release build produced; handover report delivered.

## DELIVERABLES
Report per AGENTS.md plus: production resource inventory, secrets inventory (names only), runbooks, known limitations, and a recommended post-launch backlog (Reports, Events, Notifications, Panitia scoping, import).

## EXECUTION RULES
Autonomous until the approval gate. Never deploy to production, run production migrations, or rotate production secrets without explicit owner approval in this conversation.
