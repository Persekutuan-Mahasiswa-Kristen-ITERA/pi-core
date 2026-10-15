# ADR-0011: Real-time updates for the app and website
- Status: accepted
- Date: 2026-10-15
- Deciders: owner (new requirement) / agent (proposal, verified)

## Context
The owner requires the app and website to run **real-time from every aspect**: when data changes (members, assignments, periods, roles, integrations, settings, audit), connected clients must reflect it without a manual refresh. This is a new requirement added after the plan gate, so it is recorded here and propagated into the PRD, the architecture spine and the epics.

## Options considered (verified 2026-10-15)
1. **Cloudflare Durable Object hub + WebSocket (Hibernation API)** — chosen. Durable Objects are available on the **Workers Free** plan (SQLite-backed classes only, via a `new_sqlite_classes` migration); the **WebSocket Hibernation API** means idle connections accrue **zero duration cost**. Free limits: 100k requests/day, 13,000 GB-s/day, 5M SQLite row reads/day, 100k row writes/day, 5 GB stored. Sources: `developers.cloudflare.com/durable-objects/platform/pricing`, `/durable-objects/best-practices/websockets`.
2. **Server-Sent Events (SSE)** — supported; Workers have no fixed streaming cap, but Cloudflare's edge applies a **100 s idle timeout** on Free/Pro, so keep-alive comments are required. Simpler (one-way); used as the fallback transport.
3. **Polling / Supabase Realtime** — rejected: polling is not real-time; Supabase Realtime would re-introduce a Supabase service we deliberately disabled (ADR-0009).
4. **Cloudflare Queues / pub-sub** — not needed at this scale.

## Decision
- One **`RealtimeHub` Durable Object** (SQLite-backed) owns WebSocket connections via the Hibernation API and fans out domain events.
- Every mutation writes its `audit_logs` row **and** publishes a minimal event (`{ topic, entity, id, action, at }`) to the hub.
- The channel is a **notification channel, not a data channel**: events carry ids/action only; clients re-fetch through the authorized `/api/v1` API, so scope (O/U/S) is always enforced by `can()` in the query. Subscriptions are authorized at connect time.
- Clients: web (`apps/web`) and mobile (`apps/mobile`) subscribe and update live; **SSE is the fallback** transport.
- Real-time is cross-cutting: members, assignments, periods, roles, integrations, settings and the audit log.

## Consequences
- Positive: live UX across web and mobile; hibernation keeps Free cost near zero for idle connections; the notification-channel design means the real-time path cannot leak data beyond a client's scope.
- Negative/risk: DO requests count toward the same 100k/day Free limit (ADR-0008); a single hub DO is a fan-out bottleneck if the org grows (shard later); long-lived connections need `ctx.waitUntil` and keep-alive care.
- Note: the spine's AD-11 (Free envelope) now also covers Durable Objects.

## Verification
- Stories 8.1–8.3 prove: a mutation on one client appears on another within the latency target; an out-of-scope client cannot receive the event's data; idle WebSocket connections do not accrue duration charges (hibernation).
