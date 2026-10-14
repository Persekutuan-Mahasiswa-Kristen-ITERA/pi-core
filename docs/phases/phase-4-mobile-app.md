# PHASE 4 — Native mobile app (Expo)

> Phase spec. You (the agent) execute this when the owner says "lanjutkan" and this is the current phase per `docs/STATE.md`. Follow the Continue Protocol in `AGENTS.md`.

## ROLE
Senior React Native/Expo engineer who builds pixel-faithful, accessible apps from Figma.

## PROJECT CONTEXT
Phases 0–3 done. The mobile app is the primary experience in the Figma prototype. It uses the same `/api/v1` API and shared packages. Read DESIGN.md and skills `mobile-expo`, `figma-to-code`, `rbac-permissions`.

## OBJECTIVE
A native Android-first app (iOS-ready code) implementing the prototype's screens with Google login, role-aware features, and the approved deviations.

## INITIAL INVESTIGATION
Verify Figma MCP; fetch frames; confirm tokens in DESIGN.md are exact. Inspect `apps/mobile` state, Expo SDK/version, styling approach (decide in an ADR: NativeWind vs StyleSheet + token object; pick what reuses tokens best), auth endpoints from Phase 2, API client needs. Check device/emulator availability and EAS authentication.

## TECHNICAL REQUIREMENTS
- Navigation: bottom tabs (Home, Directory, Reports, Profile) + drawer (Dashboard, Members, Roles, Periods, Assignments, Integrations, Setting); Directory top tabs Members | Roles | Periods. Reports = "coming soon" empty state. Bell shows an empty notifications state (deferred).
- Screens: Login (Google only, D1), Dashboard, Members (search, filters, create/edit form, soft-delete confirm), Roles (+ detail), Periods (set active with confirmation), Assignments (D2 form), Integrations (read-only status until Phase 5), Settings (allowed domains for super admin), Profile (own info, sign out).
- Role-aware UI via shared `can()` (cosmetic) — server remains authoritative; handle 403 gracefully.
- Auth per `mobile-expo`: system-browser PKCE, SecureStore, refresh rotation, logout everywhere on revocation.
- States: loading skeletons, empty, error+retry, forbidden, offline banner. Accessibility labels, 44pt targets, dynamic type, safe areas, keyboard avoidance.
- EAS build profiles (development/preview/production), app icon/splash from the logo, app id/scheme decided via ADR, versioning strategy.

## EXECUTION PLAN
Plan -> theme/tokens + shared components -> navigation shell -> auth -> screens in the web phase order -> offline/error polish -> tests -> internal preview build -> fidelity review -> docs.

## SECURITY & QUALITY
Tokens only in SecureStore; no sensitive data in logs/analytics; redirect scheme validated; release build contains no debug code; sensitive fields hidden unless permitted.

## VALIDATION
Unit/component tests; manual device checklist executed on at least one real Android device or emulator (state which): login, wrong-domain denial, token expiry/refresh, logout, offline, role personas (Kadiv, Staff, Anggota), create/edit/delete member, set active period. Screenshots vs Figma with difference list. Build an EAS **preview** APK/AAB and report the result.

## ACCEPTANCE CRITERIA
- [ ] All prototype screens implemented (incl. deviations) and working against staging.
- [ ] Personas see only what they may; 403 handled.
- [ ] Preview build installs and passes the checklist.
- [ ] Fidelity report + ADRs + ROADMAP updated.

## DELIVERABLES
Report per AGENTS.md plus: install link/instructions for the preview build, checklist results, store-readiness gaps.

## EXECUTION RULES
Autonomous. Ask before: creating Apple/Google Play accounts or submitting to stores, changing app identifiers after the first build, production-backend usage in builds.
