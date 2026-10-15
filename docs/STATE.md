# STATE — handoff log (the agent MUST read this first and update it last)

Single source of truth for "where are we". Keep it short and factual. Never write results you did not verify.

## Current
- **Mode:** BMAD   <!-- BMAD | PHASES (fallback) -->
- **BMAD version / install status:** installed — **6.12.3** (core + bmm, built-in) + bmb v2.2.2, cis v0.3.2, tea v1.27.2 (external); installed 2026-10-14; `ides: [hermes, pi]`; output `_bmad-output/`
- **BMAD stage / current step:** Stage 1 (planning) **complete**; **Stage 2 (delivery)** — **Epic 1 (Foundation) complete**, at the Epic 1 review gate
- **Current phase/epic:** Epic 2 (Data & RBAC) — **in progress** (story 2-1 partially done)
- **BMAD sprint/story status file path:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (8 epics / 46 stories; `epic-1` done; `epic-2` in-progress, story 2-1 in-progress)
- **Status:** awaiting owner review   <!-- not started | in progress | blocked | awaiting owner review | done -->
- **Last updated:** 2026-10-15, by Hermes (implementation agent)

## Done (verified)
- **Stage 0 — BMAD install verified.** `_bmad/_config/manifest.yaml` → `installation.version: 6.12.3`, `installDate 2026-10-14`, modules core+bmm (built-in) and bmb/cis/tea (external), `ides: [hermes, pi]`. 54 `bmad-*` skill dirs + 5 kit skills, no overwrite.
- **ADR-0001 "Adopt BMAD"** → `docs/decisions/0001-adopt-bmad.md`.
- **Stage 1 step 1 — project-context (adopt).** BMAD-managed block in `AGENTS.md` (verified versions + command plan; `AGENTS.md` stays authoritative).
- **Stage 1 step 2 — product brief (lean).** → `_bmad-output/planning-artifacts/briefs/brief-PMK-CORE-2026-10-15/brief.md` (+ `.memlog.md`).
- **Stage 1 step 3 — PRD (approved).** → `_bmad-output/planning-artifacts/prds/prd-PMK-CORE-2026-10-15/prd.md` (`status: final`). Owner answered the 10 open questions (2026-10-15) and approved; answers folded into the PRD.
- **Owner decisions recorded as ADRs:** ADR-0002 (roles/access: dept & bureau heads → `organization_admin`), ADR-0003 (staging on `*.workers.dev`, no paid Workers/DNS), ADR-0004 (iOS dev-only, no paid Apple account), ADR-0005 (email allowlist = ITERA domains only), ADR-0006 (default UI language Bahasa Indonesia).
- **Docs synced** to the ADRs: `docs/ARCHITECTURE.md` (§3, §4, §5, §8, §10), `docs/DESIGN.md` (D5, Create/Edit Member).
- **Stage 1 step 4 — UX (Figma reconciliation).** Read the Figma file via the MCP (page `0:1`, file `18T2e8GH2l2zTzn7vkP1ax`); replaced *(approx.)* tokens in `docs/DESIGN.md` with **exact** values (palette, Manrope/Poppins/Inter, radii, shadows, spacing); mapped all 12 frames to screens with node IDs; designed the missing Create/Edit Member screen from tokens. The file has no Figma variables/styles (raw values).
- **Stage 1 step 5 — architecture (spine + verified assumptions).** → `_bmad-output/planning-artifacts/architecture/architecture-PMK-CORE-2026-10-15/ARCHITECTURE-SPINE.md` (invariants AD-1…AD-15). Verified against current official docs (2026-10-15): OpenNext supports Next.js 16 (`nodejs_compat`, 3 MiB Free worker); Workers Free limits; Hyperdrive↔Supabase (direct connection; `pg`/Drizzle); Better Auth (Google + `@better-auth/oauth-provider` + Expo plugin); Expo SDK 57 (`expo-auth-session`, `expo-secure-store`); R2 presigned URLs; Supabase Data API disable + RLS. New ADRs: **0007** (Better Auth), **0008** (Workers Free 10 ms CPU risk), **0009** (Hyperdrive/Supabase data access). `docs/ARCHITECTURE.md` §5/§8 synced.
- **Stage 1 step 6 — epics & stories.** → `_bmad-output/planning-artifacts/epics.md` (**7 epics, 42 stories**; FR-1…FR-54 all covered; NFRs, AD-1…AD-15 and UX-DR1…8 folded in; each access-touching story carries denied-case tests in its DoD). **Owner-review gate.** ADR-0010 (Workers Free CPU mitigations: static-first UI → Hono API split → paid plan) recorded; spine AD-11 updated.
- **Stage 1 steps 7–8 — readiness gate (PASS) + sprint planning.** Sprint status → `_bmad-output/implementation-artifacts/sprint-status.yaml` (7 epics, 42 stories, all `backlog`; retrospectives `optional`). Generator emitted 2 benign warnings (unparsed "Epic-like" headings = the doc title and "Epic List"); all 7 epics/42 stories parsed correctly.
- **Change request — real-time (2026-10-15).** Owner asked the app + website to run **real-time from every aspect**. Recorded as **ADR-0011** (Durable Object `RealtimeHub` + WebSocket **Hibernation**; SSE fallback; notification-only channel so scope stays enforced by `can()`); added PRD **FR-55…FR-57** + **NFR-21**, spine **AD-16** (+ stack/capability rows), and a new **Epic 8: Real-time Updates** (4 stories). Sprint file regenerated → **8 epics / 46 stories**.
- **Stage 2 story 1.1 — monorepo scaffold (done).** pnpm workspaces + Turborepo + TypeScript strict; `packages/config` (base tsconfig, ESLint flat config, Prettier). Verified: `pnpm install` (112 pkgs), `pnpm -r typecheck` ✓, `pnpm -r lint` ✓, `pnpm -r test` ✓, `pnpm typecheck` (turbo) ✓.
- **Stage 2 story 1.2 — Next.js + OpenNext + Wrangler (done).** `apps/web`: Next.js 16.4.1 (App Router, Turbopack) + `@opennextjs/cloudflare` 1.20.11 + `wrangler.jsonc` (`nodejs_compat`, `ASSETS` binding, observability). Verified: `opennextjs-cloudflare build` → **`.open-next/worker.js`**; `wrangler deploy --dry-run` → **Total 4043.67 KiB / gzip 841.33 KiB** (well under the 3 MiB Free limit); `typecheck` ✓ and `lint` ✓ (workspace-wide). Home page is static-first (ADR-0010).
- **Stage 2 story 1.3 — CI pipeline (done).** Repo dibuat di organisasi GitHub **public** `Persekutuan-Mahasiswa-Kristen-ITERA/pi-core` (plan org Free → branch protection hanya tersedia untuk repo public). `.github/workflows/ci.yml` (pnpm install --frozen-lockfile → typecheck / lint / test / `pnpm audit --audit-level high`) + `.github/dependabot.yml`. Terverifikasi: run **CI = success** (semua step hijau); branch protection `main` = required check `typecheck · lint · test · audit`, `strict`, force-push & delete diblokir; Dependabot aktif (sudah membuka PR, lalu ditutup karena versi action sudah di-bump manual). Override `glob ≥10.5.0` (GHSA-5j98-mcp5-4vw2) → `pnpm audit` bersih.
- **Stage 2 story 1.4 — Cloudflare staging deploy (done).** Worker **`pi-core-web-staging`** live di **https://pi-core-web-staging.pmkitera.workers.dev** (HTTP 200, `<title>PI-CORE</title>`; static asset 200). Akun Cloudflare `biroitpmkitera@gmail.com`; subdomain `workers.dev` akun = **`pmkitera`** (didaftarkan saat deploy). `wrangler.jsonc` punya blok `env.staging` (name + var `ENVIRONMENT=staging`); `.env.example` di-commit; `wrangler secret list --env staging` → `[]` (hello deploy belum butuh rahasia; mekanisme siap). Scan bundle: tidak ada rahasia. Upload 3983.07 KiB / gzip **822.30 KiB**; startup 18 ms. **Fix penting:** Next dipin ke **16.3.8** (ADR-0012).
- **Stage 2 story 1.5 — baseline measurements + verified commands (done).** CPU and bundle size measured on the live staging Worker and recorded (see *Baseline measurements* above); the verified command table now lives in `AGENTS.md` → `## Commands`. ⚠️ Every request exceeds the Workers Free 10 ms CPU limit while still returning 200 — the account's Workers plan must be confirmed (Blockers #5). **Epic 1 (Foundation) complete.**
- **Stage 2 story 2.1 — `packages/db` + first migration (Supabase applied, 2026-10-15).** Drizzle schema for `members` + `org_units` (enums, `citext` email, partial unique indexes, restrictive FK), migration `packages/db/migrations/0000_init.sql`, and the Hyperdrive-ready client (`createDb` / `getDb`, one pool per instance). **Verified twice:** on a throwaway Postgres 17 (Docker) *and* on the real **Supabase** project (`db.jegddvztnjfvtbbyyutb.supabase.co`, reached via the session pooler) — `drizzle-kit migrate` applied cleanly; catalog asserts `members`/`org_units` present with **RLS enabled and 0 policies**, 12 indexes, both enums, `citext` installed; `db:smoke` **7/7 PASS** against Supabase (insert+returning; citext case-insensitive lookup *and* uniqueness; root-slug + per-parent-slug uniqueness; same slug allowed under a different parent; restrictive FK). Workspace typecheck/lint/test green. **Remaining:** a Hyperdrive config + a query issued from a Worker (`apps/api`) — Blockers #7.
- **Git repo initialized** (`git init -b main`); commits made.

## Environment (verified 2026-10-15)
Node v26.7.0 · pnpm 10.20.0 · npm 11.19.0 · git 2.43.0 · wrangler 4.151.0 (via `npx`) · uv 0.12.2 · Hermes Agent v0.21.6+667 · BMAD 6.12.3. Figma MCP: server enabled + OAuth tokens present (`~/.hermes/mcp-tokens/figma.*`); project skills loaded (`[project]`).

## Baseline measurements (story 1.5 — measured 2026-10-15)

Measured against the deployed staging Worker `pi-core-web-staging` using
`wrangler tail --env staging --format json`. `cpuTime`/`wallTime` are **milliseconds** (Cloudflare
Workers Trace Events documents the field as `CPUTimeMs`).

| Metric | Measured | Limit (Workers Free) |
|---|---|---|
| Compressed Worker size | **822.30 KiB gzip** (3983.07 KiB raw) | 3 MiB → **27% used** ✅ |
| Worker startup time | 18 ms | 1 s ✅ |
| CPU/request — burst of 30 to `/` (n=28) | min **14 ms**, avg **55.4 ms**, max **303 ms** | **10 ms** ⚠️ |
| CPU/request — 5 cold requests | min 132 ms, avg 158.6 ms, max 197 ms | **10 ms** ⚠️ |
| Cold-start CPU (first of a burst) | ~120–300 ms | — |
| Warm CPU (rest of a burst) | ~14–40 ms | — |
| HTTP result | 50/50 requests → **200**; no error 1102 (`exceededCpu`) | — |

⚠️ **Open risk — confirmed on Workers Free.** The owner's dashboard screenshot (2026-10-15) shows the
account is on **Workers Free ($0, "Current plan")**, where the documented CPU limit is **10 ms per
request**. Our measured CPU (warm **14–40 ms**, cold **120–300 ms**) is **above that limit on every
request**, yet **150+ requests across two bursts all returned 200** — no `exceededCpu` outcome, no
error 1102. We are therefore living inside the runtime's per-isolate "built-in flexibility" allowance,
which Cloudflare documents as applying only while overages stay *infrequent*.
**Conclusion: the app runs today, but the Next.js/OpenNext server has no documented CPU headroom on
Workers Free.** Before Epic 4 builds the UI on this, we need a decision (see *In progress / next*):
(A) accept + monitor, (B) go static-first and move data to a thin Hono API Worker (keeps Free), or
(C) move to Workers Paid ($5/mo). **Decided 2026-10-15 → option B: static-first + thin Hono API Worker (ADR-0013, spine AD-17).**

## In progress / next concrete step
**Epic 2 (Data & RBAC) — in progress.** Story 2.1: `packages/db` + migration are done and verified **against the real Supabase** (RLS on, 0 policies, smoke 7/7). Last piece = a **Hyperdrive config** (owner, Blockers #7) plus the Worker that issues the query. Next unit: scaffold **`apps/api`** — the thin Hono Worker from ADR-0013 (`/api/v1/health` doing `select 1` through `HYPERDRIVE`) — then deploy staging and close story 2.1, then continue Epic 2 (seeds, periods/positions, `can()`). Production deploy and paid resources stay approval-gated.

## Blockers needing the owner (collect here, ask in one batch)
1. ~~Figma MCP not authorised~~ — **resolved 2026-10-15**: owner completed `hermes mcp login figma`; `hermes mcp test figma` → **✓ Connected, 42 tools**; the session registered **46 `mcp__figma__*` tools** (`logs/agent.log`). Step 4 (UX) is now done.
2. ~~Confirm ADR-0002 interpretation~~ — **confirmed by the owner 2026-10-15**: all Kepala Departemen + Kepala Biro hold `organization_admin` (O-scope, org-wide).
3. ~~Epics & stories review (gate)~~ — **accepted by the owner 2026-10-15**, then extended with the real-time requirement; plan is now **8 epics / 46 stories** (`epics.md`). Architecture **approved 2026-10-15** (ADR-0010 = Workers Free CPU mitigations).
4. ~~Authenticate `wrangler` with Cloudflare~~ — **resolved 2026-10-15**: owner ran `wrangler login` (`biroitpmkitera@gmail.com`). Account-level `workers.dev` subdomain = **`pmkitera`** (registered during the first deploy).
5. ~~Confirm the Cloudflare Workers plan~~ — **resolved 2026-10-15**: owner's screenshot shows **Workers Free ($0, "Current plan")** — limit **10 ms CPU/request**. Measured CPU is **14–303 ms**, above the limit, yet **150+ requests all returned 200** with no `exceededCpu`. The Worker *works* today but has **no documented CPU headroom** → decision needed (see *Baseline measurements* and *In progress / next*).
6. ~~DECISION (owner): Free-tier rendering strategy~~ — **decided 2026-10-15: option B**, static-first + thin Hono API Worker (stays Free). Recorded as **ADR-0013** + spine **AD-17**; `epics.md` carries a plan-impact note. **No owner action pending.**
7. **Hyperdrive config (last piece of story 2.1).** Supabase credentials are in place and the migration is applied + verified. What remains is a **Hyperdrive config** on the Cloudflare account pointing at Supabase's **Direct connection** string (`db.jegddvztnjfvtbbyyutb.supabase.co:5432` — IPv6-only; Hyperdrive reaches it, this machine cannot). **I will not put the DB password on a command line**, so please either (a) create it in the dashboard — `dash.cloudflare.com` → **Hyperdrive** → *Create Configuration* — or (b) run it yourself:
   `pnpm --filter @pi-core/web exec wrangler hyperdrive create pi-core-supabase --connection-string="<DIRECT_CONNECTION_URL from Supabase>"`.
   Then tell me the **config id** (not a secret) — I bind it as `HYPERDRIVE` in `apps/api`'s Wrangler config. Note: the Supabase docs also suggest a dedicated role instead of `postgres`; we connect as the owner on purpose so `can()` is the enforcing guard and RLS stays defence-in-depth (ADR-0009).

## Decisions log (links to ADRs)
- ADR-0001 — Adopt BMAD 6.12.3 → `docs/decisions/0001-adopt-bmad.md`
- ADR-0002 — Organization admin scope (dept/bureau heads) → `docs/decisions/0002-organization-admin-scope.md`
- ADR-0003 — Staging on `*.workers.dev`, no paid Cloudflare → `docs/decisions/0003-staging-workers-dev-free-tier.md`
- ADR-0004 — iOS dev-only, no paid Apple account → `docs/decisions/0004-ios-dev-only-no-paid-apple.md`
- ADR-0005 — Email allowlist = ITERA domains only → `docs/decisions/0005-email-allowlist-itera-only.md`
- ADR-0006 — Default UI language Bahasa Indonesia → `docs/decisions/0006-default-ui-language-id.md`
- ADR-0007 — Auth library = Better Auth → `docs/decisions/0007-auth-library-better-auth.md`
- ADR-0008 — Workers Free 10 ms CPU budget risk → `docs/decisions/0008-workers-free-cpu-budget-risk.md`
- ADR-0009 — Data access (Hyperdrive direct + Data API off + RLS) → `docs/decisions/0009-data-access-hyperdrive-supabase.md`
- ADR-0010 — Workers Free CPU mitigations → `docs/decisions/0010-workers-free-cpu-mitigations.md`
- ADR-0011 — Real-time updates → `docs/decisions/0011-realtime-updates.md`
- ADR-0012 — Pin Next.js 16.3.8 (OpenNext/Workers compat) → `docs/decisions/0012-pin-nextjs-16-3-8.md`
- ADR-0013 — Static-first rendering + thin API Worker → `docs/decisions/0013-static-first-thin-api-worker.md`

## Owner approvals received
- 2026-10-15: enabled the Figma MCP server and trusted the repo for project skills.
- 2026-10-15: **approved the PRD** (with answers to the 10 open questions).
- 2026-10-15: **confirmed ADR-0002** — all Kepala Departemen + Kepala Biro hold `organization_admin` (O-scope).
- 2026-10-15: **approved the architecture** (spine + ADR-0007…0009) and asked for CPU-risk alternatives (→ ADR-0010).
- 2026-10-15: accepted the plan and **added the real-time requirement** (→ ADR-0011, Epic 8).

## Session notes (newest first)
- **2026-10-15 (Hermes), session 18:** Checked the owner's `packages/db/.env` (gitignored ✓) — keys are Supabase's own (`DATABASE_URL` = transaction pooler :6543, `DIRECT_URL` = session pooler :5432); adapted `drizzle.config.ts` + `db:smoke` to accept them. **Applied migration `0000_init.sql` to the real Supabase project** (empty DB → applied cleanly) and asserted the catalog: `members` + `org_units`, **RLS enabled with 0 policies**, 12 indexes, both enums, `citext` installed. **`db:smoke` 7/7 PASS against Supabase.** Learned: Supabase's *direct* host is IPv6-only (unreachable here) and Cloudflare's docs require the **direct** connection for Hyperdrive (not the poolers) → recorded as the remaining step, with the Hyperdrive creation left to the owner because I must not handle the DB password. Next: `apps/api` (Hono) + Hyperdrive + Worker query.
- **2026-10-15 (Hermes), session 17:** Story **2.1 (part 1)** — `packages/db` created: Drizzle schema for `members` + `org_units`, migration `0000_init.sql` (extension `citext` + tables + partial unique indexes + **RLS enabled, no policies**), Hyperdrive-ready client, `db:smoke` script. Verified on a throwaway Postgres 17 (Docker): migrate applies cleanly, RLS on with 0 policies, **smoke 7/7**, workspace typecheck/lint/test green. Story left **in-progress** — the Supabase + Hyperdrive half needs credentials (**Blockers #7**) and `apps/api`. Next: `apps/api` scaffold (ADR-0013 follow-up) + `can()` core.
- **2026-10-15 (Hermes), session 16:** Owner chose **option B** for the Workers Free CPU risk → **ADR-0013**: static-first rendering (`apps/web` as a build-time static export on static assets, 0 Worker CPU per page view) + a thin **Hono API Worker** (`apps/api`) owning `/api/v1`, the `RealtimeHub` DO, OIDC and DB access — one Worker deployment. Spine gained **AD-17**; `docs/ARCHITECTURE.md` §8 and `epics.md` (plan-impact note) updated. Blocker #6 closed; no owner action pending. Next: Epic 2 (Data & RBAC).
- **2026-10-15 (Hermes), session 15:** Owner's screenshot confirmed the account is on **Workers Free** (limit 10 ms CPU/request). Stress-tested staging with **100 consecutive requests → 100/100 HTTP 200**, no `exceededCpu`, no error 1102. Verified from independent sources (workers-go, workerd `worker-interface.capnp`, error-1102 guides) that tail `cpuTime` is in **milliseconds**. Conclusion: we run on the runtime's "built-in flexibility" with **no documented CPU headroom** on Free → recorded as **Blocker #6 (owner decision)**. Epic 1 remains complete; Epic 2 not blocked.
- **2026-10-15 (Hermes), session 14:** Story **1.5 (baseline measurements)** done → **Epic 1 (Foundation) complete**. Measured on staging: gzip **822.30 KiB** (27% of the 3 MiB Free limit), startup **18 ms**, CPU **min 14 / avg 55.4 / max 303 ms** (n=28) — **all above the Free 10 ms limit**, yet 50/50 requests returned **200** (no error 1102). Recorded in STATE; verified commands filled into `AGENTS.md` → `## Commands`. **Blocked on owner:** confirm the Cloudflare Workers plan. Next: Epic 1 review → Epic 2.
- **2026-10-15 (Hermes), session 13:** Story **1.4 (staging deploy)** done. Worker `pi-core-web-staging` live di https://pi-core-web-staging.pmkitera.workers.dev (**200 OK**). Ditemukan bug adapter↔Next 16.4 (`Unexpected loadManifest(preview-props.json)` → Cloudflare error 1101) dan diperbaiki dengan mem-pin Next ke **16.3.8** → **ADR-0012**. Sprint: `1-4: done`. Next: story 1.5 (baseline CPU/bundle measurements).
- **2026-10-15 (Hermes), session 12:** Story **1.3 (CI pipeline)** implemented and verified. Repo public dibuat di organisasi `Persekutuan-Mahasiswa-Kristen-ITERA/pi-core` (owner memilih public karena plan org Free — branch protection hanya gratis untuk repo public). CI GitHub Actions hijau; branch protection + required check aktif; Dependabot aktif. `pnpm audit` bersih setelah override `glob ≥10.5.0`. **Blocker baru:** `wrangler` belum login → story 1.4 menunggu autentikasi owner. Sprint: `1-3: done`. Next: story 1.4.
- **2026-10-15 (Hermes), session 11:** Story **1.2 (Next.js + OpenNext + Wrangler)** implemented and verified: `opennextjs-cloudflare build` produces `.open-next/worker.js`; `wrangler deploy --dry-run` reports **gzip 841.33 KiB** (under 3 MiB Free); typecheck + lint pass workspace-wide. Fixed: pnpm 10 build-script allowlist (`onlyBuiltDependencies` in `pnpm-workspace.yaml`), Turbopack tsconfig `extends` (relative path), and `@pi-core/config` as an explicit dependency. Sprint: `1-2: done`. Next: story 1.3 (CI).
- **2026-10-15 (Hermes), session 10:** Stage 2 started. Story **1.1 (monorepo scaffold)** implemented and verified: pnpm workspaces + Turborepo + TS strict + `packages/config` (tsconfig/eslint/prettier); `pnpm install`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test` all pass. Sprint status: `epic-1: in-progress`, `1-1: done`. Next: story 1.2.
- **2026-10-15 (Hermes), session 9:** Owner added a **real-time requirement** ("app + website real-time from every aspect"). Verified Cloudflare options (Durable Objects on Free, SQLite-backed; WebSocket Hibernation = zero idle cost; SSE 100 s idle timeout) → **ADR-0011**; updated PRD (FR-55…57, NFR-21), spine (AD-16 + stack/capability), and epics (**Epic 8: Real-time Updates**, 4 stories); regenerated sprint file → **8 epics / 46 stories**.
- **2026-10-15 (Hermes), session 8:** Owner accepted the epics ("lanjutkan") → `epics.md` set `final`. Ran Stage 1 steps 7–8: readiness gate **PASS**; generated `_bmad-output/implementation-artifacts/sprint-status.yaml` (7 epics / 42 stories). Stage 1 planning **complete**. Status → `awaiting owner review`; next is Stage 2 (story `1-1`).
- **2026-10-15 (Hermes), session 7:** Owner approved the architecture and asked for CPU-risk alternatives → wrote ADR-0010 (static-first UI → Hono API split → paid plan) and updated spine AD-11. Ran Stage 1 step 6 (epics & stories): `_bmad-output/planning-artifacts/epics.md` (7 epics, 42 stories). Status → `awaiting owner review` at the epics gate.
- **2026-10-15 (Hermes), session 6:** Ran Stage 1 step 5 (architecture). Wrote the spine (AD-1…AD-15) and verified the stack against current official docs; wrote ADR-0007…0009 and synced `docs/ARCHITECTURE.md`. Recorded the Workers Free **10 ms CPU** risk (ADR-0008). Status → `awaiting owner review` at the architecture gate.
- **2026-10-15 (Hermes), session 5:** Figma MCP confirmed connected (`✓ Connected, 42 tools`). Ran Stage 1 step 4 (UX): read the Figma file via MCP, replaced the *(approx.)* tokens in `docs/DESIGN.md` with exact values, mapped all 12 frames (node IDs) to screens, and designed the missing Create/Edit Member screen. Next: step 5 (architecture, review gate).
- **2026-10-15 (Hermes), session 4:** Owner confirmed ADR-0002 (org-wide admin) and restarted the session. Diagnosed the Figma MCP root cause: the server is registered but **not authorised** (only DCR client + metadata cached, no access token) → parked, 0 tools. Step 4 (UX) stays blocked pending `hermes mcp login figma`.
- **2026-10-15 (Hermes), session 3:** Owner approved the PRD and answered all 10 open questions. Folded answers into `prd.md` (`status: final`), wrote ADR-0002…ADR-0006, synced `ARCHITECTURE.md`/`DESIGN.md`. Blocker: Figma MCP tools not reachable from this session → step 4 (UX) pending.
- **2026-10-15 (Hermes), session 2:** Figma MCP + project skills confirmed active. Ran Stage 1 step 2 (lean brief) and step 3 (PRD draft) in Fast path, answering from the kit docs; both written under `_bmad-output/planning-artifacts/` with memlogs. Status → `awaiting owner review` at the PRD gate. Blockers cleared.
- **2026-10-15 (Hermes), session 1:** Setup verified — BMAD 6.12.3 usable; 54 BMAD + 5 kit skills present, no collision; versions captured. Initialized git (`git init -b main`), added `.gitignore`, wrote ADR-0001, ran Stage 1 step 1 (project-context → AGENTS.md managed block), first commit.
