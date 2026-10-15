# ADR-0007: Auth library = Better Auth (Google + OIDC provider + Expo)
- Status: accepted
- Date: 2026-10-15
- Deciders: agent (proposal, verified) — owner may veto

## Context
`docs/ARCHITECTURE.md` §5 requires Google-only sign-in for web + mobile, and §6 requires PI-CORE to be an OIDC provider; the library choice was marked **[Verify]**. One library must cover: Google social login, web cookie sessions, Expo support, and an OIDC authorization-server (discovery, JWKS, Authorization Code + PKCE).

## Options considered (verified 2026-10-15)
1. **Better Auth** — `better-auth` (stable line **1.6.x**; latest tag 1.6.25) with:
   - Google social provider (accepts a `clientId` array for web/iOS/Android ID-token audiences);
   - **`@better-auth/oauth-provider`** — OAuth 2.1 / OIDC provider (discovery, JWKS via the JWT plugin, PKCE, DCR, introspection, revocation, RFC 9207 `iss`). The older `oidcProvider` plugin in `better-auth/plugins` was **removed** in 1.7.0-beta.6;
   - **`@better-auth/expo`** — Expo integration (social sign-in, deep links, idToken sign-in).
   Sources: better-auth.com/docs/plugins/oauth-provider, /docs/integrations/expo, /docs/authentication/google (read 2026-10-15).
2. Hand-rolled OAuth/OIDC — rejected: high risk for an identity root.
3. Auth.js/NextAuth + a separate OIDC provider — rejected: two moving parts, weaker OIDC-provider story.

## Decision
Use **Better Auth** for authentication (Google) and as the OIDC provider for consumers, with the Expo plugin for mobile. Pin to the latest **1.6.x** stable line and track security advisories (update **all** `@better-auth/*` packages, not only the top-level).

## Consequences
- Positive: one library for web + mobile + consumer OIDC; ID-token/audience handling and JWKS come from a maintained implementation; matches `SECURITY.md` (PKCE, exact redirect URIs, no implicit flow).
- Negative/risk: 1.7.0 is still RC/beta — stay on 1.6.x until stable; the OIDC-provider package name/API may change (re-verify at adoption).
- Risk: Better Auth runs inside the Worker — its CPU cost counts against the 10 ms Free budget (ADR-0008).

## Verification
- Phase 2 (auth) proves: Google sign-in on web and Expo, domain allowlist + invite-only enforcement, session/refresh rotation, and the OIDC discovery/JWKS + Authorization Code + PKCE flow against a test client.
