# PHASE 5 — OIDC provider, Integrations, PI-NEXUS contract

> Phase spec. You (the agent) execute this when the owner says "lanjutkan" and this is the current phase per `docs/STATE.md`. Follow the Continue Protocol in `AGENTS.md`.

## ROLE
Senior identity/SSO engineer.

## PROJECT CONTEXT
Phases 0–4 done. PI-CORE must let other PMK apps (PI-NEXUS first; later Finance, Notulensi, Panitia, Inventory), hosted on `*.pmkitera.web.id` subdomains, authenticate users and fetch authorization data. The owner chose OIDC. The meaning of "Connected" is defined in ARCHITECTURE §6 and must be confirmed with the owner. Read ARCHITECTURE §5–6, SECURITY.

## OBJECTIVE
Implement PI-CORE as a standards-compliant OIDC provider (Authorization Code + PKCE), the integration registry + management UI/API, the `/api/v1/access` authorization endpoint, and a written integration contract + reference client snippet for PI-NEXUS. Do **not** modify PI-NEXUS or other apps.

## INITIAL INVESTIGATION
Re-check ADR-0004: does the chosen library's OIDC-provider capability meet the needs on Workers? Verify current docs for discovery, JWKS/key rotation, consent behavior (first-party apps may skip consent: confirm and decide), token lifetimes, refresh tokens, RP-initiated logout. Inspect the existing Integrations screen/API stubs.

## TECHNICAL REQUIREMENTS
- Endpoints: discovery, authorize, token, userinfo, JWKS, end-session/logout. Scopes: `openid profile email pmk:access`. PKCE required; exact-match redirect URIs; no implicit flow; short-lived codes; audience-restricted tokens; signing key stored as a secret with documented rotation.
- Integration registry (`integrations`): create/enable/disable/rotate credentials, redirect URI management, allowed scopes; seed the five known apps in "not registered" state. Status computation per ARCHITECTURE §6. Permissions: `integration:read/manage`. Audited.
- `GET /api/v1/access` (Bearer): returns active period, assignments (unit, position), roles, permission keys, and a short cache hint. Scope-checked, rate-limited, audience-aware.
- UI (web + mobile): Integrations list with Connected/Not connected, detail (client id, redirect URIs, scopes, last authorized), enable/disable, rotate secret (shown once).
- Back-channel considerations: how consumers learn about revocation (short token TTL + introspection or version stamp). Document the chosen approach.
- Docs: `docs/INTEGRATION-CONTRACT.md` (flows, endpoints, claims, error handling, caching rules, security requirements for consumers, sample code for Next.js consumers such as PI-NEXUS).

## EXECUTION PLAN
Plan/ADR -> provider endpoints -> registry + seeds -> access endpoint -> admin UI/mobile screens -> contract doc -> conformance tests using a throwaway test client app (in `tests/`, not a product app) -> staging verification.

## SECURITY & QUALITY
Follow SECURITY.md (OIDC section). Negative tests: wrong redirect URI, missing/invalid PKCE verifier, reused code, expired token, wrong audience, disabled integration, deactivated member, user without access. Use an OIDC conformance/validator tool if available; otherwise a documented manual spec checklist.

## VALIDATION
Throwaway client completes the full flow on staging; discovery doc validates; tokens verify against JWKS; access endpoint reflects period switches and deactivation; all negative tests pass; status shows Connected only after a real authorization.

## ACCEPTANCE CRITERIA
- [ ] End-to-end OIDC flow works with a test client on staging.
- [ ] Integration management works in web (and mobile read/status).
- [ ] `INTEGRATION-CONTRACT.md` is complete enough for the PI-NEXUS team/agent to implement without further questions.
- [ ] Security negative tests pass; key rotation documented.

## DELIVERABLES
Report per AGENTS.md plus the contract doc and a short "how to onboard a new app" checklist.

## EXECUTION RULES
Autonomous. Ask before: changing the "Connected" definition, issuing production client credentials, enabling cross-subdomain cookie sharing, any change in other repos.
