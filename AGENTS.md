# AGENTS.md — PI-CORE

PI-CORE = **PMK ITERA Centralized Organization & Role Engine**. It is the central identity, membership,
organization-structure, role/permission and SSO (OIDC provider) service for the PMK ITERA digital ecosystem.
Consumers (later): PI-NEXUS (separate repo), Finance, Notulensi, Panitia, Inventory.

Existing apps PI-LYNK, PI-INGRESS, PI-ARK and PI-NEXUS are OUT OF SCOPE. Never modify them.

## Read before any task
1. `docs/ARCHITECTURE.md` — org model, roles, permission matrix, data model, auth, Cloudflare topology
2. `docs/SECURITY.md` — non-negotiable security rules
3. `docs/DESIGN.md` — design tokens, screen inventory, Figma references, approved deviations
4. `docs/BMAD-INTEGRATION.md` (how BMAD is used here), `docs/STATE.md` (where we are) and `docs/ROADMAP.md` (phases; update when a phase finishes). Phase specs: `docs/phases/`
5. `docs/decisions/` — ADRs. Check before re-deciding anything; add a new ADR for every significant decision.
6. `.agents/skills/*/SKILL.md` — load the matching skill before doing that kind of work.

## CONTINUE PROTOCOL — what to do when the owner says "lanjutkan" (or "continue")
The owner will often send only that one word. It means: *keep building the project autonomously, correctly, from where it stands.* Do not ask what to do; work it out:

1. **Orient.** Read `docs/STATE.md`, `docs/ROADMAP.md`, `git log -10`, `git status`. Verify the claims in STATE.md against reality (run the commands/check the files); if reality differs, trust reality, fix STATE.md, and say so.
2. **Select work.** Read `Mode` in STATE.md.
   - **Mode: BMAD** (default once BMAD is installed): follow `docs/BMAD-INTEGRATION.md`. The next unit of work is the next unfinished BMAD planning step (Stage 1) or the next story (Stage 2), as recorded in STATE.md and the BMAD sprint/story status file. "Phase" below means "epic" in this mode.
   - **Mode: PHASES** (fallback, or before BMAD is installed): current phase = first phase in ROADMAP not marked `done`; open `docs/phases/phase-N-*.md`.
   In both modes load the relevant skills in `.agents/skills/` and resume the exact unfinished step recorded in STATE.md; do not restart finished work.
   If STATE.md says `Mode: BMAD` but BMAD is not installed, or nothing is installed yet and the owner has not run the installer, tell the owner the one command to run (`npx bmad-method install`, interactive) and meanwhile do nothing destructive; if they prefer to skip BMAD, switch to PHASES.
3. **Execute** the phase spec following the workflow below (Inspect -> Understand -> Plan -> Implement -> Validate -> Report), in small commits, running checks as you go.
4. **Handle blockers without stalling.** If you need something only the owner can give (account access, OAuth client, Supabase project, approvals, product decisions): record it under "Blockers" in STATE.md, continue every task that does not depend on it, and ask all blockers together in one concise message at the end — never one at a time, never mid-way for routine engineering choices.
5. **Stop conditions.** Stop and report when: (a) the phase/epic's acceptance criteria are all verified (or, in BMAD planning, a review-gated artifact such as PRD/architecture/epics is ready) -> set status `awaiting owner review`; (b) you hit an approval gate (see "Ask the owner BEFORE"); (c) you are blocked on everything remaining. Do not start the next phase until the owner says "lanjutkan" again after reviewing (this is the default review checkpoint).
   - If the owner says **"lanjutkan sampai selesai"** (or similar), you may chain phases without the review checkpoint, but still stop at every approval gate and at production deploy.
6. **Start of the next phase.** When the owner says "lanjutkan" and the phase is `awaiting owner review`: treat that as acceptance, mark it `done` (date), update ROADMAP, then begin the next phase. If they instead give feedback/fix requests, handle those first.
7. **Always finish by updating** `docs/STATE.md` (current phase, status, verified-done list, next step, blockers, approvals, a dated session note) and `docs/ROADMAP.md`, commit them, then give the final report (format below) in **Bahasa Indonesia** for the owner, keeping code, commands and technical terms in English. The report must end with exactly what the owner must do next (if anything) and what "lanjutkan" will do next.
8. If the owner's message contains anything besides "lanjutkan" (a question, a change, a bug report), handle that request first, then resume the protocol only if it makes sense.

## Status and honesty rules
- The repo may be empty or partially built. **Inspect before assuming.** Never invent files, schemas, APIs or test results.
- Separate in every report: **verified** (you ran/read it), **assumed**, **proposed**.
- Docs in `docs/` are a *proposal from the planning stage*; where they conflict with verified reality
  (official docs, actual tool behavior), stop, record an ADR, and report. Library/API details marked
  "verify" MUST be checked against current official documentation (use available docs/MCP/web tools).

## Target stack (preferences; deviate only with an ADR)
- Monorepo: pnpm workspaces + Turborepo. TypeScript strict everywhere.
- `apps/web`: Next.js (App Router) + Tailwind + shadcn/ui — admin website AND the HTTP API (`/api/v1/*`, route handlers),
  deployed to **Cloudflare Workers** via the OpenNext adapter (`@opennextjs/cloudflare`).
- `apps/mobile`: Expo (React Native) + Expo Router — native app (Android first; iOS pending decision).
- `packages/db`: Drizzle ORM + SQL migrations + seeds. PostgreSQL on Supabase, accessed from Workers via **Cloudflare Hyperdrive**.
- `packages/shared`: zod schemas, permission/role constants, API types, `can()` logic (pure, no I/O).
- `packages/config`: shared tsconfig/eslint/prettier.
- Cloudflare services: Workers, Hyperdrive, R2 (avatars/logo), Workers Rate Limiting or KV, optionally Cloudflare Access for staging.
- Auth: Google Sign-In only. Library choice (e.g. Better Auth with Google + OIDC-provider + Expo support) must be verified and recorded in an ADR.

## Commands
Verified on 2026-10-15 (Node 26 / pnpm 10.20.0). Run from the repo root.

| Task | Command | Notes |
|---|---|---|
| Install | `pnpm install` | Frozen in CI: `pnpm install --frozen-lockfile` |
| Typecheck | `pnpm -r typecheck` (or `pnpm typecheck` via Turbo) | |
| Lint | `pnpm -r lint` | Shared ESLint flat config from `@pi-core/config` |
| Test | `pnpm -r test` | No test suites yet (Epic 2 adds them) |
| Format | `pnpm format` / `pnpm format:check` | Prettier |
| Build (all) | `pnpm build` (Turbo) | |
| Build web (Next) | `pnpm --filter @pi-core/web build` | `next build` only |
| Build web (Worker) | `pnpm --filter @pi-core/web build:worker` | OpenNext → `.open-next/worker.js` |
| Dev web | `pnpm --filter @pi-core/web dev` | Next dev server on :3000 |
| Preview Worker locally | `pnpm --filter @pi-core/web preview` | Builds then `wrangler dev` |
| **Deploy staging** | `pnpm --filter @pi-core/web exec wrangler deploy --env staging` | Worker `pi-core-web-staging` |
| Tail staging logs | `pnpm --filter @pi-core/web exec wrangler tail --env staging` | Reports `cpuTime`/`wallTime` (ms) |
| Set a secret | `pnpm --filter @pi-core/web exec wrangler secret put <NAME> --env staging` | Never commit secrets; see `.env.example` |
| List secrets | `pnpm --filter @pi-core/web exec wrangler secret list --env staging` | |
| Worker types | `pnpm --filter @pi-core/web cf-typegen` | Generates `cloudflare-env.d.ts` |

Staging URL: **https://pi-core-web-staging.pmkitera.workers.dev** (Cloudflare account `biroitpmkitera@gmail.com`, `workers.dev` subdomain `pmkitera`).

Not yet applicable: `db:migrate` / `db:seed` (Epic 2), mobile dev `pnpm --filter @pi-core/mobile dev` (Epic 5 — `apps/mobile` does not exist yet).
Production deploy is approval-gated; there is no `deploy:production` script.

## Workflow: Inspect → Understand → Plan → Implement → Validate → Report
- Work autonomously inside the approved scope. Make small, reviewable commits (conventional commits), one concern each.
- For non-trivial work write a short plan first (in your reply or `docs/plans/<task>.md`), then execute.
- When something fails: read logs, find root cause, minimal targeted fix, re-verify, check for regressions. No speculative rewrites,
  no dependency reinstall / DB reset without evidence.

## Ask the owner BEFORE doing any of these
- Destructive or irreversible actions (dropping data/tables, force-push, deleting resources, rotating production secrets).
- Running migrations against **production**, or any production deploy.
- Creating paid Cloudflare/Supabase/Apple/Google resources or changing plan tiers.
- Changing the org model, permission matrix, or auth approach defined in `docs/ARCHITECTURE.md` (propose via ADR first).
- Touching anything outside this repo's scope.

## Hard rules
- Authorization is enforced **server-side on every endpoint**. UI hiding is cosmetic only.
- No secrets in git, logs, client bundles or prompts. Use `wrangler secret`, `.dev.vars` (gitignored), EAS secrets. Commit `.env.example` only.
- Validate all input with zod at the API boundary. Parameterized queries only (Drizzle).
- Every mutation of members/assignments/periods/roles/integrations/settings writes an `audit_logs` row.
- Do not implement UI that contradicts Figma without recording the deviation in `docs/DESIGN.md` ("Deviations") and reporting it.
- Do not add dependencies casually; justify each new one (maintained? size on Workers? works in Expo?).
- Keep Workers constraints in mind (no Node-only APIs unless supported via compat flags; bundle size; CPU time).

## Definition of done (every task)
Typecheck, lint, unit/integration tests pass; authorization boundaries tested (allowed AND denied cases); migrations apply cleanly
on an empty DB and on current state; app builds; UI matches Figma/DESIGN.md (responsive + a11y basics); docs/ADR/ROADMAP updated;
no unrelated changes in the diff.

## Final report format (write it in Bahasa Indonesia; keep code/commands/terms in English)
1. Summary of what changed and why. 2. Files changed (grouped). 3. How it was verified (commands + real results).
4. Deviations/assumptions. 5. Open issues, risks, and decisions needed from the owner. 6. Suggested next step.

## Skills in this repo
`cloudflare-deploy`, `rbac-permissions`, `figma-to-code`, `db-migrations`, `mobile-expo`.

<!-- bmad:context -->
<!-- Verified 2026-10-15 against 59a3eb9. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## Project context (BMAD-managed)

The authoritative agent rules for this repo are the hand-authored sections above and `docs/SECURITY.md`. This block only adds verified environment facts and the command plan for BMAD workflows; where it differs, the sections above win.

### Running and verifying

- Toolchain (decided, see "Target stack" above): pnpm workspaces + Turborepo, TypeScript strict. Runtime Node >= 20 (BMAD requires 20+); pin the exact version in `.nvmrc` / `package.json` `engines` during Phase 0.
- Observed on the dev machine (2026-10-15; not yet enforced by any repo file): Node v26.7.0, pnpm 10.20.0, git 2.43.0, wrangler 4.151.0 (fetched on demand — `wrangler` is not installed globally here).
- Project commands are TODO — the monorepo does not exist yet. When Phase 0 creates them, record each *verified* invocation in "## Commands" above (install, dev, lint, typecheck, test, build, db:migrate, db:seed, deploy:staging, mobile dev). Never guess an invocation.
- BMAD 6.12.3 is installed (`_bmad/`; modules core, bmm, bmb, cis, tea; IDEs hermes + pi). Planning artifacts go to `_bmad-output/`; phase specs (epic seeds) live in `docs/phases/`. Read BMAD's own installed docs/`_bmad` for skill names — never rely on memory.

### Known pitfalls

- Repo skills (`.agents/skills/<name>/SKILL.md`) are not in Hermes's native skill index until the repo is trusted (`hermes skills trust`, then restart the session); read `SKILL.md` directly instead of relying on `skill_view`/`skills_list`.

<!-- /bmad:context -->
