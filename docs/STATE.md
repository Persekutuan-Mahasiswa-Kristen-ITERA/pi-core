# STATE — handoff log (the agent MUST read this first and update it last)

Single source of truth for "where are we". Keep it short and factual. Never write results you did not verify.

## Current
- **Mode:** BMAD   <!-- BMAD | PHASES (fallback) -->
- **BMAD version / install status:** installed — **6.12.3** (core + bmm, built-in) + bmb v2.2.2, cis v0.3.2, tea v1.27.2 (external); installed 2026-10-14; `ides: [hermes, pi]`; output `_bmad-output/`
- **BMAD stage / current step:** Stage 1 (planning) **complete**; **Stage 2 (delivery) in progress** — Epic 1 stories 1-1…1-3 done, story 1-4 blocked on Cloudflare auth (see Blockers)
- **Current phase/epic:** Epic 1 (Foundation) — **in progress** (stories 1-1, 1-2, 1-3 done)
- **BMAD sprint/story status file path:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (8 epics / 46 stories; `epic-1` in-progress, stories 1-1…1-3 done)
- **Status:** in progress   <!-- not started | in progress | blocked | awaiting owner review | done -->
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
- **Git repo initialized** (`git init -b main`); commits made.

## Environment (verified 2026-10-15)
Node v26.7.0 · pnpm 10.20.0 · npm 11.19.0 · git 2.43.0 · wrangler 4.151.0 (via `npx`) · uv 0.12.2 · Hermes Agent v0.21.6+667 · BMAD 6.12.3. Figma MCP: server enabled + OAuth tokens present (`~/.hermes/mcp-tokens/figma.*`); project skills loaded (`[project]`).

## In progress / next concrete step
**Stage 2 — delivery loop** (Epic 1: Foundation, in progress). Next story: **`1-4-cloudflare-staging-hello-deploy`** — deploy the staging Worker to `*.workers.dev` (secrets via `wrangler secret`; `.env.example` committed). **Blocked until the owner authenticates wrangler** (see Blockers). Then 1-5 (baseline CPU/bundle measurements → recorded in STATE). Stop at the **Epic 1 boundary** for owner review. Production deploy and paid resources stay approval-gated.

## Blockers needing the owner (collect here, ask in one batch)
1. ~~Figma MCP not authorised~~ — **resolved 2026-10-15**: owner completed `hermes mcp login figma`; `hermes mcp test figma` → **✓ Connected, 42 tools**; the session registered **46 `mcp__figma__*` tools** (`logs/agent.log`). Step 4 (UX) is now done.
2. ~~Confirm ADR-0002 interpretation~~ — **confirmed by the owner 2026-10-15**: all Kepala Departemen + Kepala Biro hold `organization_admin` (O-scope, org-wide).
3. ~~Epics & stories review (gate)~~ — **accepted by the owner 2026-10-15**, then extended with the real-time requirement; plan is now **8 epics / 46 stories** (`epics.md`). Architecture **approved 2026-10-15** (ADR-0010 = Workers Free CPU mitigations).
4. **Authenticate `wrangler` with Cloudflare — blocks story 1.4.** `wrangler whoami` reports *not authenticated*. The owner must run, in their own terminal: `cd ~/Documents/PMK-CORE && pnpm --filter @pi-core/web exec wrangler login` (opens a browser to authorise). Never paste a token/password in chat.

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

## Owner approvals received
- 2026-10-15: enabled the Figma MCP server and trusted the repo for project skills.
- 2026-10-15: **approved the PRD** (with answers to the 10 open questions).
- 2026-10-15: **confirmed ADR-0002** — all Kepala Departemen + Kepala Biro hold `organization_admin` (O-scope).
- 2026-10-15: **approved the architecture** (spine + ADR-0007…0009) and asked for CPU-risk alternatives (→ ADR-0010).
- 2026-10-15: accepted the plan and **added the real-time requirement** (→ ADR-0011, Epic 8).

## Session notes (newest first)
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
