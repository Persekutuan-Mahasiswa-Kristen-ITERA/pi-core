# STATE — handoff log (the agent MUST read this first and update it last)

Single source of truth for "where are we". Keep it short and factual. Never write results you did not verify.

## Current
- **Mode:** BMAD   <!-- BMAD | PHASES (fallback) -->
- **BMAD version / install status:** installed — **6.12.3** (core + bmm, built-in) + bmb v2.2.2, cis v0.3.2, tea v1.27.2 (external); installed 2026-10-14; `ides: [hermes, pi]`; output `_bmad-output/`
- **BMAD stage / current step:** Stage 1 — planning chain. Step 1 (project-context) **done**; step 2 (brief) **done**; step 3 (**PRD**) **done — approved by owner 2026-10-15**. Next = step 4 (UX via Figma MCP) → step 5 (architecture, review gate)
- **Current phase/epic:** 0 / Epic 1 (Foundation)
- **BMAD sprint/story status file path:** (set after sprint planning)
- **Status:** blocked   <!-- not started | in progress | blocked | awaiting owner review | done -->
- **Last updated:** 2026-10-15, by Hermes (implementation agent)

## Done (verified)
- **Stage 0 — BMAD install verified.** `_bmad/_config/manifest.yaml` → `installation.version: 6.12.3`, `installDate 2026-10-14`, modules core+bmm (built-in) and bmb/cis/tea (external), `ides: [hermes, pi]`. 54 `bmad-*` skill dirs + 5 kit skills, no overwrite.
- **ADR-0001 "Adopt BMAD"** → `docs/decisions/0001-adopt-bmad.md`.
- **Stage 1 step 1 — project-context (adopt).** BMAD-managed block in `AGENTS.md` (verified versions + command plan; `AGENTS.md` stays authoritative).
- **Stage 1 step 2 — product brief (lean).** → `_bmad-output/planning-artifacts/briefs/brief-PMK-CORE-2026-10-15/brief.md` (+ `.memlog.md`).
- **Stage 1 step 3 — PRD (approved).** → `_bmad-output/planning-artifacts/prds/prd-PMK-CORE-2026-10-15/prd.md` (`status: final`). Owner answered the 10 open questions (2026-10-15) and approved; answers folded into the PRD.
- **Owner decisions recorded as ADRs:** ADR-0002 (roles/access: dept & bureau heads → `organization_admin`), ADR-0003 (staging on `*.workers.dev`, no paid Workers/DNS), ADR-0004 (iOS dev-only, no paid Apple account), ADR-0005 (email allowlist = ITERA domains only), ADR-0006 (default UI language Bahasa Indonesia).
- **Docs synced** to the ADRs: `docs/ARCHITECTURE.md` (§3, §4, §5, §8, §10), `docs/DESIGN.md` (D5, Create/Edit Member).
- **Git repo initialized** (`git init -b main`); commits made.

## Environment (verified 2026-10-15)
Node v26.7.0 · pnpm 10.20.0 · npm 11.19.0 · git 2.43.0 · wrangler 4.151.0 (via `npx`) · uv 0.12.2 · Hermes Agent v0.21.6+667 · BMAD 6.12.3. Figma MCP: server enabled + OAuth tokens present (`~/.hermes/mcp-tokens/figma.*`); project skills loaded (`[project]`).

## In progress / next concrete step
**Stage 1 step 4 — UX**: reconcile `docs/DESIGN.md` with the Figma file via the Figma MCP (skill `figma-to-code`), replace *(approx.)* tokens with exact values, and confirm the screen inventory. **Blocked**: the Figma MCP tools are not reachable from the agent session (see Blockers).

## Blockers needing the owner (collect here, ask in one batch)
1. **Figma MCP tools not reachable from the agent session.** Verified: `hermes mcp list` shows `figma ✓ enabled` and OAuth tokens exist (`~/.hermes/mcp-tokens/figma.*`), but `tool_call` on `mcp__figma__whoami` returns *"not available in this session"* and `tool_search` finds no `figma` tools. Likely the session toolset predates the MCP reload. **Fix:** start a fresh Hermes session in the repo (or re-run the MCP reload) so the 46 `mcp__figma__*` tools load; then step 4 can proceed.
2. **Confirm ADR-0002 interpretation (non-blocking).** "Make other departments also admin" was read literally as: all Kepala Departemen + Kepala Biro hold `organization_admin` (**O-scope, org-wide**). If department-scoped admin was meant, say so and the matrix will be narrowed.

## Decisions log (links to ADRs)
- ADR-0001 — Adopt BMAD 6.12.3 → `docs/decisions/0001-adopt-bmad.md`
- ADR-0002 — Organization admin scope (dept/bureau heads) → `docs/decisions/0002-organization-admin-scope.md`
- ADR-0003 — Staging on `*.workers.dev`, no paid Cloudflare → `docs/decisions/0003-staging-workers-dev-free-tier.md`
- ADR-0004 — iOS dev-only, no paid Apple account → `docs/decisions/0004-ios-dev-only-no-paid-apple.md`
- ADR-0005 — Email allowlist = ITERA domains only → `docs/decisions/0005-email-allowlist-itera-only.md`
- ADR-0006 — Default UI language Bahasa Indonesia → `docs/decisions/0006-default-ui-language-id.md`

## Owner approvals received
- 2026-10-15: enabled the Figma MCP server and trusted the repo for project skills.
- 2026-10-15: **approved the PRD** (with answers to the 10 open questions).

## Session notes (newest first)
- **2026-10-15 (Hermes), session 3:** Owner approved the PRD and answered all 10 open questions. Folded answers into `prd.md` (`status: final`), wrote ADR-0002…ADR-0006, synced `ARCHITECTURE.md`/`DESIGN.md`. Blocker: Figma MCP tools not reachable from this session → step 4 (UX) pending.
- **2026-10-15 (Hermes), session 2:** Figma MCP + project skills confirmed active. Ran Stage 1 step 2 (lean brief) and step 3 (PRD draft) in Fast path, answering from the kit docs; both written under `_bmad-output/planning-artifacts/` with memlogs. Status → `awaiting owner review` at the PRD gate. Blockers cleared.
- **2026-10-15 (Hermes), session 1:** Setup verified — BMAD 6.12.3 usable; 54 BMAD + 5 kit skills present, no collision; versions captured. Initialized git (`git init -b main`), added `.gitignore`, wrote ADR-0001, ran Stage 1 step 1 (project-context → AGENTS.md managed block), first commit.
