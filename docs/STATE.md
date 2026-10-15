# STATE — handoff log (the agent MUST read this first and update it last)

Single source of truth for "where are we". Keep it short and factual. Never write results you did not verify.

## Current
- **Mode:** BMAD   <!-- BMAD | PHASES (fallback) -->
- **BMAD version / install status:** installed — **6.12.3** (core + bmm, built-in) + bmb v2.2.2, cis v0.3.2, tea v1.27.2 (external); installed 2026-10-14; `ides: [hermes, pi]`; output `_bmad-output/`
- **BMAD stage / current step:** Stage 1 — planning chain. Steps 1–4 **done**; step 5 (**architecture**) **done — at owner-review gate**. Next after approval = step 6 (epics & stories)
- **Current phase/epic:** 0 / Epic 1 (Foundation)
- **BMAD sprint/story status file path:** (set after sprint planning)
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
- **Git repo initialized** (`git init -b main`); commits made.

## Environment (verified 2026-10-15)
Node v26.7.0 · pnpm 10.20.0 · npm 11.19.0 · git 2.43.0 · wrangler 4.151.0 (via `npx`) · uv 0.12.2 · Hermes Agent v0.21.6+667 · BMAD 6.12.3. Figma MCP: server enabled + OAuth tokens present (`~/.hermes/mcp-tokens/figma.*`); project skills loaded (`[project]`).

## In progress / next concrete step
**Owner review of the architecture spine** (`_bmad-output/planning-artifacts/architecture/architecture-PMK-CORE-2026-10-15/ARCHITECTURE-SPINE.md`) + ADR-0007…0009. After approval: Stage 1 step 6 (**epics & stories**, seeded by `docs/phases/`), then step 7 (readiness) and step 8 (sprint planning). See `docs/BMAD-INTEGRATION.md` §Stage 1.

## Blockers needing the owner (collect here, ask in one batch)
1. ~~Figma MCP not authorised~~ — **resolved 2026-10-15**: owner completed `hermes mcp login figma`; `hermes mcp test figma` → **✓ Connected, 42 tools**; the session registered **46 `mcp__figma__*` tools** (`logs/agent.log`). Step 4 (UX) is now done.
2. ~~Confirm ADR-0002 interpretation~~ — **confirmed by the owner 2026-10-15**: all Kepala Departemen + Kepala Biro hold `organization_admin` (O-scope, org-wide).
3. **Architecture review (gate).** Approve the spine + ADR-0007…0009, or give fixes. Note the recorded risk **ADR-0008**: Workers **Free** = **10 ms CPU/request**, below what auth + SSR typically cost; if Phase 0 measures it exceeded, the choice is re-scope (stay free) or approve a paid plan. No action needed now.

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

## Owner approvals received
- 2026-10-15: enabled the Figma MCP server and trusted the repo for project skills.
- 2026-10-15: **approved the PRD** (with answers to the 10 open questions).
- 2026-10-15: **confirmed ADR-0002** — all Kepala Departemen + Kepala Biro hold `organization_admin` (O-scope).

## Session notes (newest first)
- **2026-10-15 (Hermes), session 6:** Ran Stage 1 step 5 (architecture). Wrote the spine (AD-1…AD-15) and verified the stack against current official docs; wrote ADR-0007…0009 and synced `docs/ARCHITECTURE.md`. Recorded the Workers Free **10 ms CPU** risk (ADR-0008). Status → `awaiting owner review` at the architecture gate.
- **2026-10-15 (Hermes), session 5:** Figma MCP confirmed connected (`✓ Connected, 42 tools`). Ran Stage 1 step 4 (UX): read the Figma file via MCP, replaced the *(approx.)* tokens in `docs/DESIGN.md` with exact values, mapped all 12 frames (node IDs) to screens, and designed the missing Create/Edit Member screen. Next: step 5 (architecture, review gate).
- **2026-10-15 (Hermes), session 4:** Owner confirmed ADR-0002 (org-wide admin) and restarted the session. Diagnosed the Figma MCP root cause: the server is registered but **not authorised** (only DCR client + metadata cached, no access token) → parked, 0 tools. Step 4 (UX) stays blocked pending `hermes mcp login figma`.
- **2026-10-15 (Hermes), session 3:** Owner approved the PRD and answered all 10 open questions. Folded answers into `prd.md` (`status: final`), wrote ADR-0002…ADR-0006, synced `ARCHITECTURE.md`/`DESIGN.md`. Blocker: Figma MCP tools not reachable from this session → step 4 (UX) pending.
- **2026-10-15 (Hermes), session 2:** Figma MCP + project skills confirmed active. Ran Stage 1 step 2 (lean brief) and step 3 (PRD draft) in Fast path, answering from the kit docs; both written under `_bmad-output/planning-artifacts/` with memlogs. Status → `awaiting owner review` at the PRD gate. Blockers cleared.
- **2026-10-15 (Hermes), session 1:** Setup verified — BMAD 6.12.3 usable; 54 BMAD + 5 kit skills present, no collision; versions captured. Initialized git (`git init -b main`), added `.gitignore`, wrote ADR-0001, ran Stage 1 step 1 (project-context → AGENTS.md managed block), first commit.
