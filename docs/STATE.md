# STATE — handoff log (the agent MUST read this first and update it last)

Single source of truth for "where are we". Keep it short and factual. Never write results you did not verify.

## Current
- **Mode:** BMAD   <!-- BMAD | PHASES (fallback) -->
- **BMAD version / install status:** installed — **6.12.3** (core + bmm, built-in) + bmb v2.2.2, cis v0.3.2, tea v1.27.2 (external); installed 2026-10-14; `ides: [hermes, pi]`; output `_bmad-output/`
- **BMAD stage / current step:** Stage 1 — planning chain. Step 1 (project-context) **done**; step 2 (product brief) **done**; step 3 (**PRD**) **draft done — at owner-review gate**. Next after approval = step 4 (UX) → step 5 (architecture)
- **Current phase/epic:** 0 / Epic 1 (Foundation)
- **BMAD sprint/story status file path:** (set after sprint planning)
- **Status:** awaiting owner review   <!-- not started | in progress | blocked | awaiting owner review | done -->
- **Last updated:** 2026-10-15, by Hermes (implementation agent)

## Done (verified)
- **Stage 0 — BMAD install verified.** `_bmad/` present. `_bmad/_config/manifest.yaml` → `installation.version: 6.12.3`, `installDate 2026-10-14`, modules core+bmm (built-in) and bmb/cis/tea (external), `ides: [hermes, pi]`. 54 `bmad-*` skill dirs under `.agents/skills/`. Kit skills intact (no overwrite): `cloudflare-deploy`, `rbac-permissions`, `figma-to-code`, `db-migrations`, `mobile-expo`.
- **ADR-0001 "Adopt BMAD"** written → `docs/decisions/0001-adopt-bmad.md`.
- **Stage 1 step 1 — project-context (intent: adopt).** Added a BMAD-managed block to `AGENTS.md` (verified versions + command plan; `AGENTS.md` stays authoritative). Ledger: existing AGENTS.md sections are all `retain` — no relocation/deletion; the block only *adds* environment facts the file did not yet carry.
- **Stage 1 step 2 — product brief (lean).** → `_bmad-output/planning-artifacts/briefs/brief-PMK-CORE-2026-10-15/brief.md` (+ `.memlog.md`).
- **Stage 1 step 3 — PRD (draft).** → `_bmad-output/planning-artifacts/prds/prd-PMK-CORE-2026-10-15/prd.md` (54 FRs across 12 features; NFRs from `SECURITY.md`; 10 open questions; assumptions index). **Owner-review gate.**
- **Git repo initialized** (`git init -b main`); `.gitignore` added; commits made.

## Environment (verified 2026-10-15)
Node v26.7.0 · pnpm 10.20.0 · npm 11.19.0 · git 2.43.0 · wrangler 4.151.0 (via `npx`, not global) · uv 0.12.2 · Hermes Agent v0.21.6+667 · BMAD 6.12.3. Figma MCP connected (owner-enabled); project skills loaded (`[project]`).

## In progress / next concrete step
**Owner review of the PRD** (`_bmad-output/planning-artifacts/prds/prd-PMK-CORE-2026-10-15/prd.md`). After approval: Stage 1 step 4 (UX — reconcile `docs/DESIGN.md` with Figma via the Figma MCP), then step 5 (architecture). See `docs/BMAD-INTEGRATION.md` §Stage 1.

## Blockers needing the owner (collect here, ask in one batch)
1. **PRD review (gate).** Approve, or give fix requests. 10 open questions in PRD §12 (domain/DNS, student email domain, iOS, profile fields, UI language, `super_admin` holder, step-up MFA, "Connected" definition) — none blocks approving the draft, but answers sharpen steps 4–5.
2. ~~Figma MCP not connected~~ — **resolved** (owner enabled it; verified connected).
3. ~~Repo skills not registered natively~~ — **resolved** (project skills now visible as `[project]`).

## Decisions log (links to ADRs)
- ADR-0001 — Adopt BMAD 6.12.3 (Stage 0). → `docs/decisions/0001-adopt-bmad.md`

## Owner approvals received
- 2026-10-15: enabled the Figma MCP server and trusted the repo for project skills.

## Session notes (newest first)
- **2026-10-15 (Hermes), session 2:** Figma MCP + project skills confirmed active. Ran Stage 1 step 2 (lean brief) and step 3 (PRD draft) in Fast path, answering from the kit docs; both written under `_bmad-output/planning-artifacts/` with memlogs. Status → `awaiting owner review` at the PRD gate. Blockers 2–3 cleared.
- **2026-10-15 (Hermes), session 1:** Setup verified — BMAD 6.12.3 usable; 54 BMAD + 5 kit skills present, no collision; versions captured. Initialized git (`git init -b main`), added `.gitignore`, wrote ADR-0001, ran Stage 1 step 1 (project-context → AGENTS.md managed block), first commit.
