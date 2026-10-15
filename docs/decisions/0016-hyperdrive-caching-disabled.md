# ADR-0016 — Hyperdrive query caching is disabled

- **Date:** 2026-10-16
- **Status:** accepted
- **Supersedes:** nothing. **Amends:** ADR-0009 (data access via Hyperdrive).

## Context

Hyperdrive was created with its query cache left at the default — **enabled**. `wrangler hyperdrive get`
reported `"caching": { "disabled": false }`.

Two anomalies were observed while verifying stories 3.1 and 3.3, both of the same shape: **a read issued
after a write returned the pre-write state.**

1. `syncGoogleIdentity` reads `members.google_sub` and writes it when null. Two `auth.identity_linked`
   audit rows appeared for the same member, 35 s apart, both recording `linkedGoogleSub: true` — i.e. the
   read saw `NULL` a second time even though the first call had already written the value.
2. `POST /api/v1/auth/mobile/sign-out` deleted the session row (confirmed: zero rows for that member when
   queried directly), yet `GET /api/auth/get-session` with the same bearer token **kept returning the
   deleted session for over 3.4 seconds**. The response carried `cache-control: no-store`, so this was not
   the edge cache; it was the database read.

Neither is cosmetic. The product re-checks admission on **every** request precisely so that deactivating a
member, suspending them, or removing a domain from the allowlist takes effect at once (FR-3, FR-5). A stale
read silently defeats that: a revoked member would keep being admitted, and a revoked token would keep
working, for as long as the cache held the row.

## Decision

**Disable Hyperdrive's SQL response cache** on the `pi-core-supabase` config:

```
wrangler hyperdrive update afcb66f59a424787b5117c596edd29dc --caching-disabled
```

Verified: the same mobile hand-off verification went from a **>3474 ms** read-after-write window to
**~82 ms** (one request, i.e. immediately correct), 16/16 assertions passing.

## Rationale

Hyperdrive's cache is a **latency** optimisation for read-heavy, tolerance-for-staleness workloads. This is
the opposite: an authorization system where a stale read is a security failure, and where the queries
behind it are already point lookups on indexed columns through a pooled connection — the cheap kind.

Cloudflare's own guidance is that the cache is not invalidated by writes to the underlying tables, which is
exactly the pattern that broke here: read-modify-write on one row inside one request.

## Consequences

- Every read now reflects committed state. Revocation and admission are immediate, as FR-3/FR-5 require.
- We give up the cache's latency benefit. Measured staging latency is unchanged in practice
  (`/api/v1/health` 19–95 ms, `get-session` ~80 ms) because the connection — not the result — is what
  Hyperdrive was mostly saving us.
- **Any future re-enablement must be justified against a read-after-write requirement, not just a
  benchmark.** If a specific endpoint is genuinely staleness-tolerant, prefer caching it at the edge with an
  explicit `Cache-Control`, where the invalidation is visible in code.
- Free-tier neutral: this is a configuration change, not a plan change (ADR-0014).

## How this was found

Not by review — by testing. The duplicate audit row surfaced because a verification script asserted the
*count* of audit rows, not just that one existed. The sign-out staleness surfaced because the script
re-read the session after revoking it instead of trusting the 200. Both are worth keeping: **assert the
state after the write, not the write's return code.**
