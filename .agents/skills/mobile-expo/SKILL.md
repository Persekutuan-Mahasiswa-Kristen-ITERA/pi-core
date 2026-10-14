---
name: mobile-expo
description: Use when building or changing the native mobile app (Expo / React Native) for PI-CORE, including navigation, Google login with PKCE, secure token storage, API client, builds (EAS) and device testing. Load before touching apps/mobile.
---

# Mobile (Expo) skill

## Procedure
1. Inspect `apps/mobile` (SDK version, Expo Router, styling approach, installed auth packages). Verify current Expo SDK/library docs; do not rely on memory.
2. Reuse `packages/shared` (zod schemas, permission constants, `can()` for UI affordances, API types). Duplicate nothing.
3. Navigation mirrors the prototype: bottom tabs (Home, Directory, Reports, Profile) + drawer; Directory top tabs (Members | Roles | Periods). Reports tab shows a clear "coming soon" empty state until built.
4. Auth: Google sign-in through the PI-CORE backend using the system browser + PKCE (`expo-auth-session` / `expo-web-browser`, or the auth library's Expo integration; verify). Tokens in `expo-secure-store` only.
   Handle refresh rotation, forced logout on 401/revoked, and deep-link redirect scheme validation.
5. API client: typed wrapper over `/api/v1`, request ids, retry with backoff for idempotent calls, uniform error mapping, offline detection.
6. UI: tokens from the shared theme; follow `figma-to-code`. Safe areas, keyboard avoidance, 44pt touch targets, dynamic type, loading/empty/error/forbidden states, optimistic UI only where safe.
7. Builds: EAS profiles `development`, `preview`, `production`; secrets via EAS. Android first. Creating iOS/Apple/Google Play accounts or submitting to stores requires owner approval.
8. Test: unit (logic), component tests for key screens, and a manual device checklist (login, logout, token expiry, offline, rotate, small screen). Report what was tested on which device/emulator.
