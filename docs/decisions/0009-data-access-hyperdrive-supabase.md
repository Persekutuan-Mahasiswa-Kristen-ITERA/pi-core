# ADR-0009: Data access — Hyperdrive direct connection; Supabase Data API disabled; RLS on
- Status: accepted
- Date: 2026-10-15
- Deciders: agent (verified)

## Context
`docs/ARCHITECTURE.md` §8 and `docs/SECURITY.md` require Supabase to be used as plain Postgres, with the Data API restricted and RLS on every table; the connection type for Hyperdrive was **[Verify]**.

## Options considered (verified 2026-10-15)
1. Supabase JS client / Data API — rejected by `SECURITY.md` and Cloudflare's guidance (*"use a driver like node-postgres or Postgres.js to connect directly, instead of the Supabase JavaScript client"*).
2. **Hyperdrive → Supabase via the direct connection string; drivers `pg` (≥ 8.13.0) or `postgres` (≥ 3.4.4); Drizzle `drizzle-orm/node-postgres` (≥ 0.26.2)** (chosen). Requires `compatibility_flags = ["nodejs_compat"]`.
   Sources: `developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/.../supabase`, `/workers/databases/connect-to-postgres`, `/hyperdrive/.../drizzle-orm` (read 2026-10-15).
3. Supavisor pooler in front of Hyperdrive — rejected: Hyperdrive already pools; the docs say use the **direct** connection string.

## Decision
- Hyperdrive connects to Supabase with the **direct** connection string; Hyperdrive performs pooling.
- The Supabase **Data API is disabled**; the database is reached only through Hyperdrive (AD-1).
- **RLS is enabled on every table with no public policies** (`SECURITY.md`). RLS still applies to the connecting role, so Phase 1 decides whether policies key on a per-request claims GUC or RLS is defense-in-depth behind `can()`.
- `drizzle-kit` uses a direct `DATABASE_URL` (never a Worker secret) for migrations.

## Consequences
- Positive: lowest-latency server-side DB access; no Supabase SDK in the bundle; one pooling layer.
- Negative/risk: the Worker must create a fresh client per request (Hyperdrive keeps the pool) — do not cache clients across requests; watch the 6 concurrent-connection limit (AD-11).

## Verification
- Phase 1 proves a Hyperdrive→Supabase connection from a Worker with Drizzle, migrations apply on an empty DB and on current state, and every table has RLS enabled with no public policies.
