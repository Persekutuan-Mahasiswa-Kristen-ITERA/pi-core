# SECURITY — PI-CORE (non-negotiable rules)

PI-CORE is the identity root for all PMK ITERA apps. A flaw here compromises every consumer. Treat these as hard requirements.

## Authentication
- Google Sign-In only. Validate the ID token server-side (signature, `iss`, `aud`, `exp`, nonce/PKCE state). Require `email_verified = true`.
- Domain allowlist from `allowed_email_domains`, checked server-side on the verified email. `hd` is a hint only.
- Invite-only: no active member row = no session. Return one generic error for all denial reasons (no account enumeration). Audit every denial.
- Sessions: httpOnly + Secure + SameSite cookies on web; SecureStore on mobile. Rotating refresh tokens; revoke on deactivation/role removal.
- Deactivating a member or removing their access must invalidate their sessions and tokens promptly.

## Authorization
- Deny by default. Single `can()` function. Every route handler calls it before touching data; add a test that fails if a route lacks an authorization check.
- Enforce scope (O/U/S) in the **query** (filter by unit subtree), not only after fetching.
- No privilege escalation: users cannot assign roles/positions above their rank, edit their own assignments, or remove the last `super_admin`.
- Only the active period's assignments grant access. Period activation is audited and requires `period:activate`.

## Data protection
- Personal data (NIM, phone, email) is sensitive: return only to holders of `member:read_sensitive`; redact in logs and audit `before/after`.
- Minimize collected fields; define retention. Soft-delete members; provide an anonymization path for deletion requests.
- Supabase: enable RLS on every table with no public policies; disable or restrict the Data API for this project; never expose the service-role key to clients.
- R2: private bucket; serve avatars via signed URLs or an authorized route; validate type/size; strip metadata; random object keys.

## Web/API hardening
- zod validation on all inputs; reject unknown fields on writes. Parameterized queries only.
- CSRF protection for cookie-authenticated mutations; strict CORS allowlist (no wildcard with credentials).
- Security headers: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors none.
- Rate limiting on login/callback/token/write endpoints; request size limits.
- OIDC provider: exact-match redirect URIs, PKCE required, short-lived auth codes, no implicit flow, key rotation plan for JWKS, audience-restricted tokens.

## Secrets and supply chain
- No secrets in git, logs, client bundles, screenshots or prompts. `.env.example` only; secrets via wrangler/EAS/GitHub secrets. Separate secrets per environment.
- Commit the lockfile; pin versions; run `pnpm audit` (or equivalent) in CI; review every new dependency; enable Dependabot.
- GitHub: branch protection on `main`, required CI, required review for production deploy workflow.

## Observability and incident readiness
- Structured logs with `requestId`; never log tokens, cookies, or sensitive fields. Audit log is append-only (no update/delete grants).
- Document break-glass: how to revoke all sessions, rotate OIDC signing keys, disable an integration, and recover the `super_admin`.

## Mobile
- Tokens only in SecureStore; no tokens in logs/analytics. Use system browser (not embedded WebView) for Google login. Validate deep-link/redirect schemes.
- Release builds: no debug endpoints, source maps handled deliberately, EAS secrets for build-time config.
