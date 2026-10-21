# ROADMAP — PI-CORE

> In BMAD mode, phases below are **epic seeds** (see `docs/BMAD-INTEGRATION.md`); the authoritative backlog becomes the BMAD epics/stories. Keep this table as the high-level status view.

Update the Status column when a phase completes (with date and PR/commit). Each phase has a prompt in `docs/phases/`.

> **BMAD Stage 1 (planning) COMPLETE** — 2026-10-15: Stage 0 verified (BMAD 6.12.3); steps 1–8 done (project-context, brief, **PRD approved**, UX, **architecture approved**, **epics & stories**, readiness **PASS**, sprint plan). Plan extended with **Epic 8: Real-time Updates** (ADR-0011). Next: **Stage 2 delivery** (story 1-1). No phase is `done` yet; the table below stays `not started` until a phase's epics/stories are delivered.

| Phase | Goal                                                                                             | Prompt                                     | Status                                                                  |
| ----- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------- |
| 0     | Foundation: repo, monorepo tooling, CI, Cloudflare staging "hello", ADRs, verified commands      | `docs/phases/phase-0-foundation.md`        | done — Epic 1 verified 2026-10-15                                       |
| 1     | Database, org model seed, permission catalog, `can()` + tests                                    | `docs/phases/phase-1-data-and-rbac.md`     | done — Epic 2 verified 2026-10-15                                       |
| 2     | Google auth, domain allowlist, invite-only, sessions (web + mobile-ready), bootstrap super admin | `docs/phases/phase-2-auth.md`              | done — Epic 3 verified 2026-10-16                                       |
| 3     | Core API + admin website (Dashboard, Members, Periods, Roles, Assignments, Settings)             | `docs/phases/phase-3-api-and-admin-web.md` | done — Epic 4 verified 2026-10-16                                       |
| 4     | Native mobile app (Expo) per Figma                                                               | `docs/phases/phase-4-mobile-app.md`        | awaiting owner review — Epic 5 stories 5.1–5.4 verified 2026-10-17      |
| 5     | OIDC provider + Integrations screen + PI-NEXUS contract                                          | `docs/phases/phase-5-oidc-integrations.md` | done — Epic 6 stories 6.1–6.4 verified end-to-end on staging 2026-10-18 |
| 6     | Hardening, audit UI, e2e, production deploy, store builds                                        | `docs/phases/phase-6-hardening-release.md` | done — Epic 7 stories 7.1–7.5 verified 2026-10-18. Store builds, corrected 2026-10-21: EAS profiles were only *configured* on 2026-10-18; a real Android release APK now builds locally (`expo prebuild` + `gradlew assembleRelease`), installs and runs on an emulator. Play Store upload and any iOS binary are **not** done (iOS distribution needs a paid Apple account, ADR-0004). Production deploy approval gate still open. |
| 7     | Real-time Updates: Durable Object `RealtimeHub` (WebSocket Hibernation + SSE fallback), Web & Mobile live sync, scope-safe fan-out | `docs/phases/phase-7-realtime-updates.md` | done — Epic 8 stories 8.1–8.4 verified 2026-10-18 |

Deferred (not in MVP): Reports tab, Events, Notifications, Panitia (event-scoped), legacy data import, optional TOTP step-up.
