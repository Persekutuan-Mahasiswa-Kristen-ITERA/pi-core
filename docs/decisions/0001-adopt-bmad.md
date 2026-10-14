# ADR-0001: Adopt BMAD Method (6.12.3) for planning & delivery
- Status: accepted
- Date: 2026-10-15
- Deciders: agent (proposal, per planning kit) / owner (kit mandates it)

## Context
The PI-CORE planning kit (`AGENTS.md`, `docs/BMAD-INTEGRATION.md`) makes BMAD Method the default operating mode
(`Mode: BMAD`) and requires it to be installed once, interactively, by the owner (`npx bmad-method install`).
BMAD provides the role-based planning chain (brief → PRD → architecture → epics & stories → readiness → sprint)
and the per-story delivery loop. `docs/BMAD-INTEGRATION.md` defines a strict division of responsibility:
`AGENTS.md`/`docs/SECURITY.md` remain authoritative; BMAD artifacts own PRD/epics/stories; `docs/ARCHITECTURE.md`
owns org model/roles/auth/stack; `docs/STATE.md` owns "where are we".

## Options considered (verified)
1. **Adopt BMAD** (installed) — verified in `_bmad/_config/manifest.yaml`: version **6.12.3** (core + bmm, built-in),
   plus external modules bmb v2.2.2, cis v0.3.2, tea v1.27.2; `ides: [hermes, pi]`; install date 2026-10-14.
   Source: `_bmad/_config/manifest.yaml` (read 2026-10-15).
2. **Fallback `Mode: PHASES`** — execute `docs/phases/phase-0..6` directly. Not needed: BMAD installed and usable.

## Decision
Adopt BMAD 6.12.3 as the planning/delivery engine (`Mode: BMAD` in `docs/STATE.md`). The 7 `docs/phases/*` files
become **epic seeds**, not direct execution units. Our kit skills in `.agents/skills/` stay untouched; BMAD skills
are added alongside them under the `bmad-*` namespace. The 5 kit skills (`cloudflare-deploy`, `rbac-permissions`,
`figma-to-code`, `db-migrations`, `mobile-expo`) are verified intact — no overwrite/collision.

## Consequences
- Positive: role-based artifacts (PRD/architecture/epics/stories), per-story review loop, traceable sprint status.
- Positive: install is reproducible; version and config recorded here and in `docs/STATE.md`.
- Negative/risk: BMAD skill/workflow names change between versions — always read `_bmad/` and its installed docs,
  never rely on memory of command names (`docs/BMAD-INTEGRATION.md`). BMAD output is a *proposal* until it passes
  `AGENTS.md` hard rules; any story weakening `docs/SECURITY.md` is rejected and escalated.
- Note: BMAD project-local skills are only registered in Hermes once the repo is trusted (`hermes skills trust`);
  until then they are loaded by reading `.agents/skills/<name>/SKILL.md` directly.

## Verification (how we know it works)
- `_bmad/` exists; `_bmad/_config/manifest.yaml` → `installation.version: 6.12.3`, `ides: [hermes, pi]`.
- `_bmad/config.toml` present; `_bmad/_config/bmad-help.csv` catalog lists the planning chain
  (`bmad-project-context`, `bmad-prd`, `bmad-ux`, `bmad-architecture`, `bmad-create-epics-and-stories`,
  `bmad-sprint-planning`, `bmad-build`, …).
- 54 `bmad-*` skill directories present under `.agents/skills/`; the 5 kit skills present and non-empty.
