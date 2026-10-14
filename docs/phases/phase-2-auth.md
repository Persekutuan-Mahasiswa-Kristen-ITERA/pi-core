# PHASE 2 — Authentication (Google only, invite-only)

> Phase spec. You (the agent) execute this when the owner says "lanjutkan" and this is the current phase per `docs/STATE.md`. Follow the Continue Protocol in `AGENTS.md`.

## ROLE
Senior security-minded full-stack engineer (OAuth/OIDC, sessions, mobile auth).

## PROJECT CONTEXT
Phases 0–1 done. Owner decisions: **Google Sign-In only**; emails restricted to allowed domains (pmkitera.web.id, itera.ac.id, and likely student.itera.ac.id); optional/admin MFA is delegated to Google 2-Step Verification. Read ARCHITECTURE §5 and SECURITY.md.

## OBJECTIVE
Working Google sign-in for the web (cookie session) and a mobile-ready token flow (PKCE), enforcing domain allowlist + invite-only membership server-side, with bootstrap of the first `super_admin`, sign-out, session revocation, and audit logging.

## INITIAL INVESTIGATION
1. Re-read ADR-0003 (auth library shortlist). Evaluate against REAL current docs: Google provider, Cloudflare Workers/OpenNext compatibility, Drizzle/Postgres adapter, Expo/mobile support, OIDC-provider capability (needed in Phase 5), session/token model. Choose, write ADR-0004, and state risks. If no library fits, propose a minimal custom approach and ask the owner.
2. Check Google Cloud: does an OAuth client exist? Which project owns it? (Ask the owner to create staging/prod OAuth clients and consent screen; never ask for secrets in chat — they go to wrangler/EAS secrets.)
3. Inspect existing middleware/session code, env handling, and how `getActorContext` will be fed.

## TECHNICAL REQUIREMENTS
- Flow: Google -> backend callback -> verify ID token (`iss`, `aud`, `exp`, `email_verified`) -> domain allowlist (from `allowed_email_domains`, subdomain rule respected) -> match an `active` member by email (case-insensitive), link `google_sub` on first login -> create session. Any failure -> the same generic error to the client; precise reason only in audit/logs.
- Do not use `hd` as a security control (hint only).
- Web: httpOnly/Secure/SameSite session cookie, CSRF protection for mutations, logout, session list/revoke for admins, forced invalidation when a member is deactivated.
- Mobile: PKCE flow through the system browser against the backend; access + rotating refresh tokens; token endpoints specified and tested (consumed by `apps/mobile` in Phase 4; you may add a minimal test harness, not full UI).
- Login page on web per DESIGN.md D1 (Google only, brand header). Minimal post-login landing page that shows the signed-in member and effective roles (temporary, for verification).
- Bootstrap command: create/activate the first `super_admin` from an env var email, idempotent, audited, refuses to run if a `super_admin` already exists unless `--force` with confirmation. Document the break-glass recovery in `docs/SECURITY.md`.
- Rate limiting on auth endpoints. Audit events: login success/denied(reason), logout, session revoke, bootstrap.
- Settings API (read-only for now) exposing the domain allowlist; editing arrives in Phase 3.

## EXECUTION PLAN
Plan -> ADR -> config/secrets scaffolding -> Google flow (web) -> membership gate -> sessions/revocation -> mobile token flow -> bootstrap -> rate limit/audit -> tests -> staging verification with real Google accounts (ask the owner to perform the interactive login if needed).

## SECURITY & QUALITY
Follow SECURITY.md strictly. State/nonce/PKCE verified. No tokens in logs. Cookie flags verified in the deployed response. Account-enumeration-safe messages. Constant-time comparisons where relevant.

## VALIDATION
Automated tests: allowed domain + active member -> success; allowed domain but unknown member -> denied; disallowed domain -> denied; unverified email -> denied; inactive member -> denied; tampered/expired/wrong-audience token -> denied; deactivated member's session stops working; refresh rotation + reuse detection. Manual staging check with a real Google login (report results honestly, including anything you could not test).

## ACCEPTANCE CRITERIA
- [ ] Real Google login works on staging for an allowed, pre-registered account; denied for others with the generic message.
- [ ] Server-side domain allowlist and invite-only gate proven by tests.
- [ ] Mobile PKCE/token flow implemented and tested at the API level.
- [ ] Bootstrap + break-glass documented and tested.
- [ ] ADR-0004; ROADMAP updated; no secrets in repo.

## DELIVERABLES
Report per AGENTS.md, plus: list of secrets/env vars needed per environment (names only), Google Cloud setup steps for the owner, and residual risks.

## EXECUTION RULES
Autonomous within scope. Ask before: choosing a non-shortlisted auth approach, any production OAuth/secrets action, changing the invite-only/domain rules.
