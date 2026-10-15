# ADR-0014 — Every provider stays on a free tier

- **Status:** Accepted
- **Date:** 2026-10-15
- **Related:** ADR-0003 (staging on `*.workers.dev`, no paid Cloudflare), ADR-0004 (iOS dev-only, no paid Apple), ADR-0008/ADR-0010 (Workers Free CPU), ADR-0013 (static-first to stay on Free)

## Context

The owner's standing instruction (2026-10-15): **run everything on free tiers for now.** ADR-0003
already fixed this for Cloudflare and ADR-0004 for Apple; this ADR makes it explicit for *every*
provider the project depends on, so no component silently drifts onto a paid plan, and so the
limits we must design within are written down in one place.

Free-tier limits that actually constrain this project (verified against each provider's docs,
2026-10-15):

| Provider | Plan | Limits that matter here |
|---|---|---|
| **Cloudflare Workers** | Free | 100,000 requests/day (account-wide, shared by every Worker incl. Durable Object requests), **10 ms CPU per request**, 128 MB memory, 3 MiB compressed Worker, 50 subrequests, 6 outbound connections. Durable Objects available (SQLite-backed classes only). |
| **Cloudflare Hyperdrive** | included on all Workers plans | — |
| **Supabase Postgres** | Free | **projects are paused after 7 days of low activity**, 500 MB database size per project, 5 GB egress (+5 GB cached), 1 GB file storage, 50,000 MAU, 2 million Realtime messages / 200 peak Realtime connections, 500,000 Edge Function invocations, **2 active projects** per owner/admin, **no automatic backups, no PITR** |
| **GitHub** (org `Persekutuan-Mahasiswa-Kristen-ITERA`) | Free | branch protection only on **public** repos (hence `pi-core` is public); Actions free for public repos |
| **Google Sign-In** | Free | OAuth client; no paid tier needed |
| **Expo / EAS** | Free | local builds; no paid Apple account (ADR-0004) |

## Decision

Keep every component on its **free tier**. Specifically:

1. **No plan upgrade, no paid resource, no add-on, and no overage** may be created without the
   owner's explicit approval — including Supabase Pro, Cloudflare Workers Paid, the Supabase IPv4
   add-on, GitHub Team, and paid Apple/Google accounts.
2. When a free-tier limit blocks a story, **stop and propose alternatives** (re-architect, batch,
   cache, or defer) rather than upgrading. Record the outcome as an ADR.
3. Design *within* the limits above — they are part of the architecture, not an afterthought.

## Consequences

- **Supabase Free pauses a project after ~7 days of low activity.** Staging would go dark between
  working sessions. Mitigation (still free): a **Cloudflare Cron Trigger** on `apps/api` that issues
  a tiny query (e.g. `select 1`) once a day — well inside the 100k/day request budget. Until that
  exists, expect to unpause the project manually in the Supabase dashboard. Production would be the
  **second** active project, which is exactly the Free-plan cap — a third project would need an
  upgrade, so keep staging + production as the only two.
- **No automatic backups / no PITR.** Before any destructive migration we take our own
  `pg_dump` (a free, local artefact). Migrations stay additive (expand → backfill → contract).
- **100k requests/day is account-wide**, shared by every Worker and every Durable Object request.
  The thin API (median 5.5 ms CPU, ADR-0013) keeps us far inside it for a student-org workload.
- **500 MB database** is ample for members, org units, assignments and audit rows, but the audit
  log must be pruned or archived on a schedule rather than kept forever.
- If a limit is ever hit, the answer is a design change or a deferred feature — **not** an upgrade.

## Alternatives considered

- **Pay as we go** (Supabase Pro $25/mo, Workers Paid $5/mo): removes every ceiling above, but the
  owner has ruled out paid resources for now.
- **Self-host Postgres** (e.g. on a free VM): adds an operations burden far beyond the cost saved,
  and the owner's requirement is a low-maintenance central service.
