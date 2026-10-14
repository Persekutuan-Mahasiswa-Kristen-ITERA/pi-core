# PHASE 0 — Foundation

> Phase spec. You (the agent) execute this when the owner says "lanjutkan" and this is the current phase per `docs/STATE.md`. Follow the Continue Protocol in `AGENTS.md`.

## ROLE
You are a senior full-stack/platform engineer bootstrapping a greenfield monorepo for PI-CORE, delivering a verified, deployable skeleton on Cloudflare.

## PROJECT CONTEXT
PI-CORE (PMK ITERA Centralized Organization & Role Engine) is the identity/membership/org-structure/RBAC/SSO service of the PMK ITERA ecosystem.
Deliverables: native mobile app (Expo), admin website (Next.js), shared API. The repo is empty or nearly empty. Planning docs were prepared by the architect and live (or must be placed) at:
`AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DESIGN.md`, `docs/ROADMAP.md`, `.agents/skills/*`. Read them first. Existing apps (PI-LYNK, PI-INGRESS, PI-ARK, PI-NEXUS) are out of scope.

## OBJECTIVE
A pnpm + Turborepo monorepo with `apps/web` (Next.js on Cloudflare Workers via OpenNext), `apps/mobile` (Expo), `packages/{db,shared,config}`, CI, and a **staging** deployment that serves a health endpoint backed by a real DB round-trip through Hyperdrive. No product features yet.

## INITIAL INVESTIGATION (do not skip; report findings)
1. OS, Node, pnpm, git, wrangler, Expo/EAS CLI availability and versions. Whether you are authenticated to Cloudflare, GitHub, Supabase (use available CLIs/MCPs; never print tokens).
2. Repo state: `git status`, existing files, remote. Confirm the planning docs and skills are present; if not, ask the owner to copy them in.
3. Which Cloudflare account/zone is available. Is `pmkitera.web.id` on Cloudflare DNS? (Only report; do NOT change DNS.)
4. MCP availability: Figma MCP (check by listing tools), Cloudflare docs/MCP if any. Skills visibility: confirm `.agents/skills/` skills are discoverable by Hermes (docs say Hermes reads project skills via `skills.external_dirs` including `.agents/skills/`; verify and tell the owner if config is needed).
5. Check current official docs for: OpenNext Cloudflare adapter requirements, Next.js compatibility, Hyperdrive + Postgres driver compatibility, Expo SDK in monorepos, Workers plan limits.

## TECHNICAL REQUIREMENTS
- Monorepo layout per AGENTS.md. TypeScript strict, shared tsconfig/eslint/prettier, path aliases, consistent scripts (`dev`, `lint`, `typecheck`, `test`, `build`).
- `apps/web`: Next.js App Router + Tailwind + shadcn/ui initialized; `/api/v1/health` returning `{status, version, db: "ok"|"error", requestId}`. Request-id middleware and structured logging helper.
- `apps/mobile`: Expo + Expo Router starter with TypeScript, builds locally, imports something from `packages/shared` to prove workspace wiring (verify Metro monorepo config).
- `packages/db`: Drizzle setup + migration tooling + one trivial migration; DB client factory suitable for Workers (per-request, Hyperdrive). `packages/shared`: zod, a placeholder permission-constants module.
- Cloudflare: wrangler config with `staging` and `production` environments, bindings declared (HYPERDRIVE, R2 `AVATARS`, rate limiting or KV), generated types committed. Create **staging** resources only, and only after listing exactly what will be created/cost and getting owner approval if anything is paid.
- Supabase: confirm a **staging** project exists (ask the owner to create it if not; do not use production). Provide `.env.example` / `.dev.vars.example`.
- CI (GitHub Actions): install with frozen lockfile, lint, typecheck, test, build; deploy staging on `main`; production workflow exists but is manual + approval-gated and disabled until Phase 6.
- Tooling hygiene: conventional commits, Husky/lint-staged optional (justify), Dependabot, `.gitignore` covering `.dev.vars`, `.env*`, build outputs.
- ADRs in `docs/decisions/` (use `0000-template.md`): ADR-0001 monorepo/tooling, ADR-0002 Cloudflare runtime + DB access (driver choice), ADR-0003 auth library shortlist with a recommendation (decision finalized in Phase 2).

## EXECUTION PLAN
1. Investigate and write a short plan (verified vs assumed). 2. Scaffold monorepo. 3. web app + health route. 4. mobile starter. 5. db/shared packages. 6. Cloudflare config + staging deploy. 7. CI. 8. ADRs, fill AGENTS.md "Commands" with verified commands, update ROADMAP. 9. Run the full validation list. 10. Report.

## SECURITY & QUALITY
No secrets committed (run a secret scan on the diff). Pin versions. No broad CORS. Least-privilege tokens for CI. Health endpoint must not leak internals (no connection strings, no stack traces).

## VALIDATION
Run and show real output for: install, lint, typecheck, test, build (web), mobile bundle/start check, local wrangler dev health call, deployed staging health call (DB "ok"), CI run green. Record bundle size and Workers limit headroom.

## ACCEPTANCE CRITERIA
- [ ] `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` succeed from a clean clone.
- [ ] Staging URL returns healthy with `db: "ok"` through Hyperdrive.
- [ ] Mobile app runs in Expo and imports from `packages/shared`.
- [ ] CI green; production deploy cannot run without approval.
- [ ] ADR-0001..0003 written; AGENTS.md "Commands" filled with verified commands; ROADMAP updated.
- [ ] No secrets in git; `.env.example` present.

## DELIVERABLES
Final report in the AGENTS.md format, plus: list of Cloudflare/Supabase resources created, plan-tier/cost findings, DNS/custom-domain findings, and the questions you need the owner to answer.

## EXECUTION RULES
Proceed autonomously within this phase. Ask before: creating paid resources, touching DNS, using any production resource, deleting anything, deviating from the stack. Do not implement product features.
