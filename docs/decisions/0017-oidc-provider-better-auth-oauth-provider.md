# ADR-0017 — OIDC provider via Better Auth OAuth Provider plugin

- Status: accepted for Story 6.1
- Date: 2026-10-17

## Context

PI-CORE must act as an OIDC issuer for PI-NEXUS and later PMK applications. The API runs on Cloudflare Workers, so the implementation must use edge-compatible Web Crypto and must not introduce a second auth implementation beside Better Auth.

## Decision

Use `@better-auth/oauth-provider@~1.6.33` with the existing `better-auth@~1.6.33`, plus Better Auth's `jwt()` plugin. Configure OIDC scopes `openid`, `profile`, `email`, and `pmk:access`.

The plugin owns discovery, authorization code, token, UserInfo, JWKS, revocation, introspection, and RP-initiated logout endpoints. Authorization Code is the only user flow; PKCE is required by the pinned plugin defaults. Root issuer aliases forward `/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`, and `/jwks` to the Better Auth handler mounted under `/api/auth`.

OAuth provider tables and JWKS are separate Postgres tables, RLS-enabled with no public policies. Client secrets are stored using the plugin's hashed storage behavior; plaintext secrets are not written by PI-CORE. The existing `members` table remains the identity record.

## Consequences

- One protocol implementation reduces token and discovery drift.
- The plugin's schema must remain mapped to the Drizzle adapter and migrations must be applied before staging endpoints are enabled.
- Client registry permissions, integration audit records, `/api/v1/access`, and end-to-end staging flow remain Stories 6.2–6.4; Story 6.1 does not claim those are complete.
- Root aliases are intentionally public: discovery and JWKS expose protocol metadata/public keys only.
- Signing-key rotation is delegated to the plugin's JWKS persistence and must be documented and exercised in the release hardening pass.

## Verification

The resolved plugin version and official Better Auth v1.6 documentation were checked on 2026-10-17. Runtime inspection confirmed the auth instance registers `getOpenIdConfig`, `getJwks`, `oauth2Authorize`, `oauth2Token`, `oauth2UserInfo`, `oauth2Revoke`, `oauth2Introspect`, and `oauth2EndSession`. Unit coverage asserts these APIs and the absence of email/password sign-in.
