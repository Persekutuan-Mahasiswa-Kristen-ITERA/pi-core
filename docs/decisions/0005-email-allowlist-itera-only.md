# ADR-0005: Email allowlist uses ITERA domains only
- Status: accepted
- Date: 2026-10-15
- Deciders: owner

## Context
`docs/ARCHITECTURE.md` §4 seeded `allowed_email_domains` with `pmkitera.web.id`, `itera.ac.id` and likely `student.itera.ac.id`. OQ-2 asked whether `pmkitera.web.id` mailboxes exist as Google accounts. Owner: "not yet / none." OQ-3: the student domain is the official ITERA domain.

## Options considered
1. Include `pmkitera.web.id` — rejected: those mailboxes are not Google accounts, so those users cannot sign in with Google.
2. **Allowlist = ITERA domains only** (`itera.ac.id`, `student.itera.ac.id`, with `allow_subdomains` set appropriately) (chosen).

## Decision
- `allowed_email_domains` seeds the ITERA domains only; `pmkitera.web.id` is not seeded.
- Domain enforcement stays server-side on the verified email (`docs/SECURITY.md`).

## Consequences
- Positive: no dead allowlist entry; sign-in works for real ITERA accounts.
- Negative/risk: if PMK later obtains Google Workspace mailboxes, a new allowlist entry is added via `settings:manage` — no code change needed.

## Verification
- Phase 2 (auth) tests sign-in for an allowed ITERA domain and refuses a non-allowed domain; the seed reflects this ADR.
