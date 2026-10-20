# PI-CORE Integration Contract

Status: draft for owner review

This document defines how consumer applications such as PI-NEXUS integrate with PI-CORE. It does not change any consumer repository.

## Issuer and discovery

Issuer:

- Staging: `https://pi-core-api-staging.pmkitera.workers.dev`
- Production: configured only after owner approval

Consumers must read the issuer's `/.well-known/openid-configuration` instead of hardcoding protocol endpoint paths. The provider exposes Authorization Code + PKCE, JWKS, UserInfo, token revocation, introspection and RP-initiated logout.

Supported scopes:

- `openid`
- `profile`
- `email`
- `pmk:access`

Only `authorization_code` and `refresh_token` grants are supported. Implicit flow is not supported. PKCE with `S256` is mandatory. Redirect URIs must match the registered URI exactly.

## Client registration

A PI-CORE administrator registers a client through the protected API:

- `GET /api/v1/integrations` requires `integration:read`.
- `POST /api/v1/integrations` requires `integration:manage`.
- `PATCH /api/v1/integrations/:clientId` requires `integration:manage`.
- Secret rotation and enable/disable also require `integration:manage`.

Client secrets are generated and hashed by Better Auth. A plaintext secret is returned only once during create/rotate and must be stored in the consumer's secret manager. Never commit it, log it, or send it through browser analytics.

## Authorization Code + PKCE flow

1. Consumer creates a cryptographically random `state`, `code_verifier`, and `code_challenge = BASE64URL(SHA-256(code_verifier))`.
2. Consumer redirects the browser to the discovered authorization endpoint with `response_type=code`, exact `client_id`, exact `redirect_uri`, `scope`, `state`, `code_challenge`, and `code_challenge_method=S256`.
3. PI-CORE authenticates the member with Google and applies invite-only admission and the ITERA email allowlist.
4. The browser returns one authorization code to the exact registered redirect URI.
5. Consumer verifies `state`, then exchanges the code server-to-server at the discovered token endpoint with the original `redirect_uri` and `code_verifier`.
6. Consumer validates the ID token against the discovered issuer, JWKS, audience and nonce. The ID token is intentionally small: subject, email and name.
7. Consumer stores tokens in its own secure, server-side session. Do not share cross-subdomain cookies with PI-CORE.

Example token exchange shape:

```ts
const tokenResponse = await fetch(discovery.token_endpoint, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    resource: apiOrigin, // RFC 8707: the token's `aud` is this value verbatim — use the API origin, not the issuer
  }),
});
```

The example intentionally omits credential values and must run only on the consumer server.

`resource` must be the **API origin** (`https://pi-core-api-staging.pmkitera.workers.dev`), not the issuer. The provider copies the value straight into the token's `aud`, and `/api/v1/*` verifies `aud` against its own origin, so a token requested against the issuer is refused with 401 even though it is otherwise valid. The same value must be sent on both the authorize and the token request.

## Authorization snapshot

Call `GET /api/v1/access` with the OAuth access token:

```http
Authorization: Bearer [ACCESS_TOKEN]
```

The response contains the current database-backed member, active period, assignments, roles and permission keys. Consumer applications must not authorize from ID-token roles or client-supplied claims.

The endpoint validates the access token's signature, issuer, audience, expiry and `pmk:access` scope before querying authorization data. Responses are `Cache-Control: private, no-store`; consumers should not place them in a shared cache. If a consumer needs a local short-lived copy, key it to its own authenticated server session and discard it on token revocation, sign-out, member deactivation or period switch.

An invalid, expired, revoked, disabled-client or audience-mismatched token must be treated as unauthenticated. A member deactivated after token issuance is refused by the database admission check.

## Connection status

The registry reports:

- `disabled`: client registration exists but is disabled.
- `connected`: client is enabled and at least one access token was issued within the rolling 30-day window.
- `not_connected`: client is enabled but has never completed authorization in that window.

Token issuance is used as the durable evidence of successful authorization. A client registration alone never makes an integration connected.

## Logout and revocation

Consumers must destroy their own session after logout and may call the discovered revocation endpoint. They must not assume that deleting a local cookie revokes the PI-CORE token. Use short token lifetimes, refresh-token rotation supplied by the provider, and re-fetch `/api/v1/access` when the local session is refreshed or authorization-sensitive data changes.

## Security checklist for consumer teams

- Use Authorization Code + PKCE `S256`; never implicit flow.
- Validate `state`, nonce, issuer, audience, signature and expiry.
- Use exact registered redirect URIs and HTTPS outside local development.
- Keep client secret and tokens server-side; never put them in a mobile bundle or logs.
- Do not trust roles or permissions from ID tokens, browser state or query parameters.
- Call `/api/v1/access` with a Bearer access token and handle 401/403 without retry loops.
- Do not use cross-subdomain cookies.
- Redact authorization headers and token responses from logs and error reporting.

## Onboarding checklist

1. Request the application name, type, exact redirect URI(s), post-logout URI(s), and required scopes.
2. An authorized PI-CORE administrator registers the client.
3. Store the one-time secret in the consumer secret manager, if the client is confidential.
4. Implement discovery and the PKCE flow.
5. Run negative tests: wrong redirect URI, missing/wrong PKCE verifier, reused code, expired token, wrong audience, disabled client, deactivated member and member without current access.
6. Verify the consumer calls `/api/v1/access` and does not trust client claims.
7. Complete a staging authorization and confirm the registry changes to `connected`.

Production client credentials, production deployment, DNS and cross-subdomain cookie changes require explicit owner approval.
