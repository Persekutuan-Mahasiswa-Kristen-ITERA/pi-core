# STATE — handoff log (the agent MUST read this first and update it last)

Single source of truth for "where are we". Keep it short and factual. Never write results you did not verify.

## Current
- **Mode:** BMAD   <!-- BMAD | PHASES (fallback) -->
- **BMAD version / install status:** installed — **6.12.3** (core + bmm, built-in) + bmb v2.2.2, cis v0.3.2, tea v1.27.2 (external); installed 2026-10-14; `ides: [hermes, pi]`; output `_bmad-output/`
- **BMAD stage / current step:** Stage 1 — planning chain. Step 1 (project-context) **done**. Next = step 2 (product brief, optional) → step 3 (**PRD**, owner-review gate)
- **Current phase/epic:** 0 / Epic 1 (Foundation)
- **BMAD sprint/story status file path:** (set after sprint planning)
- **Status:** in progress   <!-- not started | in progress | blocked | awaiting owner review | done -->
- **Last updated:** 2026-10-15, by Hermes (implementation agent)

## Done (verified)
- **Stage 0 — BMAD install verified.** `_bmad/` present. `_bmad/_config/manifest.yaml` → `installation.version: 6.12.3`, `installDate 2026-10-14`, modules core+bmm (built-in) and bmb/cis/tea (external), `ides: [hermes, pi]`. 54 `bmad-*` skill dirs under `.agents/skills/`. Kit skills intact (no overwrite): `cloudflare-deploy`, `rbac-permissions`, `figma-to-code`, `db-migrations`, `mobile-expo`.
- **ADR-0001 "Adopt BMAD"** written → `docs/decisions/0001-adopt-bmad.md`.
- **Stage 1 step 1 — project-context (intent: adopt).** Added a BMAD-managed block to `AGENTS.md` (verified versions + command plan; `AGENTS.md` stays authoritative). Ledger: existing AGENTS.md sections are all `retain` — no relocation/deletion; the block only *adds* environment facts the file did not yet carry.
- **Git repo initialized** (`git init -b main`); `.gitignore` added; first commit created.

## Environment (verified 2026-10-15)
Node v26.7.0 · pnpm 10.20.0 · npm 11.19.0 · git 2.43.0 · wrangler 4.151.0 (via `npx`, not global) · Hermes Agent v0.21.6+667 · BMAD 6.12.3.

## In progress / next concrete step
Stage 1 step 2 (product brief — optional, skip if it adds nothing) then step 3 (**PRD**). See `docs/BMAD-INTEGRATION.md` §Stage 1. In BMAD mode the next "lanjutkan" unit is the next unfinished planning step.

## Blockers needing the owner (collect here, ask in one batch)
1. **Figma MCP is NOT connected to Hermes.** Verified: `hermes mcp list` → "No MCP servers configured"; no Figma tools in the toolset; Figma is only configured in VS Code's `~/.config/Code/User/mcp.json` (not used by Hermes). Blocks Stage 1 step 4 (UX / `figma-to-code`) and all UI work. Fix: `hermes mcp add figma --url https://mcp.figma.com/mcp --auth oauth` → `hermes mcp login figma` → restart the session.
2. **Repo skills not registered natively in Hermes.** Verified: `hermes skills list` shows neither the 5 kit skills nor the `bmad-*` skills. Cause: the repo was not a git checkout (now fixed) **and** is not trusted. Fix: from the repo root run `hermes skills trust`, then restart the session. Workaround meanwhile (works now): read `.agents/skills/<name>/SKILL.md` directly.

## Decisions log (links to ADRs)
- ADR-0001 — Adopt BMAD 6.12.3 (Stage 0). → `docs/decisions/0001-adopt-bmad.md`

## Owner approvals received
(none yet) <!-- e.g. "2026-xx-xx: approved creating staging Hyperdrive + R2" -->

## Session notes (newest first)
- **2026-10-15 (Hermes):** Setup verified — BMAD 6.12.3 usable; 54 BMAD + 5 kit skills present, no collision; versions captured. Initialized git (`git init -b main`), added `.gitignore`, wrote ADR-0001, ran Stage 1 step 1 (project-context → AGENTS.md managed block), first commit. Two owner actions outstanding (Figma MCP, repo trust); **neither blocks Stage 1 steps 2–3**.
