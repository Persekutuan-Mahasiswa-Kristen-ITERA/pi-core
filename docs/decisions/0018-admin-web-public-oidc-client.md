# ADR-0018 — Admin web as a public OIDC client (bearer token, no cookie)

- Status: accepted (owner decision, 2026-10-20)
- Date: 2026-10-20

## Context

The admin web (`pi-core-web-staging.pmkitera.workers.dev`) and the API (`pi-core-api-staging.pmkitera.workers.dev`) are two separate `*.workers.dev` sites. `workers.dev` is on the Public Suffix List, so the two hosts are **different sites**, not subdomains of one another. That breaks the assumed cookie model:

- Better Auth issues its session cookie with `SameSite=Lax` by default. A cross-site `fetch(..., { credentials: "include" })` from the web page does **not** send it, so every `/api/v1/*` call answered 401 in the browser.
- `advanced.crossSubDomainCookies` cannot help: it scopes a cookie to a registrable parent domain, and there is none shared by two `workers.dev` subdomains.
- Consequence observed before this decision: the Integrations panel — the only screen that called the API — could never load, and no admin screen could be wired to real data.

Three options were considered:

1. **Web as an OIDC client** (chosen): authorization code + PKCE, bearer access token on every API call.
2. Proxy `/api/*` through the web Worker and point `BETTER_AUTH_URL` at the web origin, so cookies become same-origin.
3. Custom domains under `pmkitera.web.id` (`app.` + `core.`) so the hosts are same-site.

## Decision

The admin web is a **public OIDC client** of PI-CORE's own provider.

- Client `pi-core-admin-web`, registered by `apps/api/scripts/register-web-client.ts`: `public: true`, `token_endpoint_auth_method: "none"`, `type: "user-agent-based"`, `require_pkce: true`, grant types `authorization_code` + `refresh_token`, redirect URIs `<web origin>/callback` and `http://localhost:3000/callback`.
- The browser runs Authorization Code + **PKCE S256**. No `client_secret` exists in the browser or the bundle.
- `resource` (RFC 8707) is sent on both the authorize and token requests; without it the provider mints an **opaque** token, which `/api/v1/*` cannot verify.
- `/api/v1/*` accepts `Authorization: Bearer <access token>` **in addition to** the session cookie. The bearer token is verified in-process against the `jwks` table (`apps/api/src/oauth/verify-access-token.ts`) — never by fetching the Worker's own `*.workers.dev` URL, which loopbacks with 404.
- Authorization still comes from the database: the token only identifies a subject. `resolveSessionAdmission` re-checks admission on every request, then `loadActor` resolves roles, scope and rank, so a token cannot carry privileges the member no longer has.
- The access token lives in memory; the refresh token is in `sessionStorage` so a reload can recover without persisting a long-lived credential in `localStorage`.

## Consequences

- No DNS work, no issuer change, no proxy hop, and no CPU added to the 10 ms Workers Free budget (ADR-0008): the browser calls the API Worker directly.
- The admin web now exercises the same contract as any future consumer (PI-NEXUS), which is what `docs/INTEGRATION-CONTRACT.md` documents — a UI that works this way proves the contract.
- Tokens in a browser are exposed to XSS. Mitigations: the access token is never persisted, `sessionStorage` is per-tab and cleared on sign-out, and CSP remains `default-src 'self'`. The current CSP sets `script-src 'self' 'unsafe-inline' 'unsafe-eval'`; removing `unsafe-inline` is a follow-up hardening item.
- A member deactivated mid-session keeps no access: admission runs per request, so the next call is refused even though the token has not expired.
- Cookie-based admin access remains available to same-origin callers (the `/sign-in` page and the mobile hand-off), so nothing that worked before is removed.
- Option 3 stays available later: if the project adopts `app.`/`core.pmkitera.web.id`, cookies become same-site and the bearer path can remain for native clients.
