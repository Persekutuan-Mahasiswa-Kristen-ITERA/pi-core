# BMAD INTEGRATION — how BMAD Method and this repo's docs work together

BMAD (Breakthrough Method of Agile AI-Driven Development) provides role-based skills/workflows (analyst, PM, UX, architect, scrum master, dev, QA/review) and a
planning chain (brief -> PRD -> architecture -> epics & stories -> readiness check -> sprint -> story dev loop). It is installed into the repo by its installer
(`npx bmad-method install`, Node 20+; BMAD v6.x lists a `hermes-agent` target). **BMAD's skill/workflow names and file layout change between versions.
After installation, read BMAD's own installed docs/help (`_bmad/`, its `bmad-help` skill if present, release notes) and use the names you actually find. Never rely on memory of command names.**

## Division of responsibility (hybrid)
| Concern | Owner of the truth |
|---|---|
| Hard rules, security, Hermes working agreement, Continue Protocol | `AGENTS.md`, `docs/SECURITY.md` (BMAD cannot override) |
| Owner decisions: org model, roles/matrix, Google-only auth, OIDC, Cloudflare/Expo/Supabase stack | `docs/ARCHITECTURE.md` §2,3,5,6 + `docs/DESIGN.md` (BMAD artifacts must conform; change only via ADR + owner approval) |
| Product requirements (PRD), epics, stories, acceptance criteria, sprint tracking | BMAD artifacts in `_bmad-output/` |
| Technical architecture detail | BMAD architecture artifact, **derived from and consistent with** `docs/ARCHITECTURE.md` (if they diverge, fix the BMAD artifact or write an ADR; never leave two conflicting truths) |
| "Where are we / what next" pointer | `docs/STATE.md` (points into BMAD sprint/story status) |

`docs/phases/phase-0..6` are no longer executed directly in BMAD mode. They are **epic seeds**: use them as input so the generated epics cover the same scope, order and acceptance criteria
(Epic 1 Foundation, 2 Data & RBAC, 3 Auth, 4 API & Admin Web, 5 Mobile, 6 OIDC & Integrations, 7 Hardening & Release). Stories must carry over each phase's validation and acceptance criteria.

## Stage 0 — Install (owner runs once, interactively; agent verifies)
Owner: in the repo root run `npx bmad-method install`, choose the Hermes target and the core/BMM (software development) module. Agent then verifies: `_bmad/` exists, BMAD skills are visible to Hermes,
no overwrite/collision with `.agents/skills/` (our skills must stay intact; BMAD skills are `bmad-*`). Record BMAD version and install config in STATE.md and `docs/decisions/` (ADR "Adopt BMAD").
If installation or Hermes visibility fails, set `Mode: PHASES` in STATE.md (fallback = execute `docs/phases/` directly per AGENTS.md) and report.

## Stage 1 — Planning chain (run in this order; each step is one "lanjutkan" unit; mark done in STATE.md)
Autonomy rule: BMAD workflows are interactive/elicitive. **Answer from the repo docs first** (ARCHITECTURE, DESIGN, SECURITY, phases, this README of decisions). Ask the owner only for genuine
gaps in business intent, collected in ONE batch (see Continue Protocol). Do not make the owner re-explain what the docs already state.
1. `project-context` (BMAD concept: persistent rules for all agents): generate it from AGENTS.md + SECURITY.md + stack/versions (verified). Keep it consistent; AGENTS.md remains authoritative.
2. Product brief / analysis (only if the BMAD version has it and it adds value): seed from `docs/ARCHITECTURE.md` §1, the Figma-derived screen inventory, and the owner's stated goals. Keep it short.
3. **PRD** (PM skill): functional + non-functional requirements for PI-CORE MVP (see Deferred list in ROADMAP). NFRs must include the security requirements in SECURITY.md.
4. **UX** (UX skill): reconcile `docs/DESIGN.md` with Figma via Figma MCP (see `figma-to-code`); output must keep DESIGN.md as the canonical design/deviation record (BMAD v6.9 recognizes `DESIGN.md`).
5. **Architecture** (architect skill): start from `docs/ARCHITECTURE.md`; challenge it constructively, verify Cloudflare/Hyperdrive/OpenNext/Expo/auth-library assumptions against current docs; record changes as ADRs; sync both documents.
6. **Epics & stories** (create-epics-and-stories): seeded by `docs/phases/`; each story small, testable, with acceptance criteria, dependencies, and which skills/docs to read. Security/authorization tests are part of each relevant story's Definition of Done.
7. **Implementation readiness check** (if available): resolve all gaps it reports before coding.
8. **Sprint planning**: produce the sprint/story status file. Record its real path in STATE.md.
Stop for **owner review** after steps 3 (PRD), 5 (architecture) and 6–8 (epics/stories ready). These are the plan approvals; "lanjutkan" afterwards = approved.

## Stage 2 — Delivery loop (repeat per story, in epic order)
create/prepare story -> implement (dev skill, following AGENTS.md hard rules + relevant `.agents/skills/*`) -> run all checks -> code review (BMAD review skill; fix findings) -> update story status + `docs/STATE.md` -> commit (conventional, one story per commit/PR) .
After the last story of an epic: run the retrospective workflow if available, update ROADMAP, set STATE to `awaiting owner review`, report. Epic boundary = default review checkpoint; "lanjutkan sampai selesai" chains epics but never crosses an approval gate.
Fresh context per workflow is good practice in BMAD: if Hermes supports clean sessions/delegation, use them; otherwise rely on STATE.md + story files for handoff. Never carry assumptions between stories without writing them down.

## Change management
New requirement or deviation from approved artifacts: use BMAD's change/correct-course workflow if present; otherwise write an ADR, update PRD/architecture/epics consistently, and ask the owner when it touches org model, permissions, auth, cost, or scope.

## Guardrails
- BMAD output is a proposal until it passes our hard rules; any story that would weaken SECURITY.md or the approved matrix is rejected and escalated.
- Do not let planning documents balloon: prefer lean artifacts; every artifact must be used by a later step.
- Report honestly which BMAD steps you ran, which you skipped (and why), and the BMAD version used.
