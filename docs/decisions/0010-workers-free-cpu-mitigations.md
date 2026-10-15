# ADR-0010: Mitigating the Workers Free CPU limit — static-first UI, thin API, split as fallback
- Status: accepted
- Date: 2026-10-15
- Deciders: owner (asked for alternatives) / agent (proposal, verified)

## Context
ADR-0008 records that Workers Free allows only **10 ms CPU/request**, below what auth + SSR typically cost, and ADR-0003 forbids a paid plan for now. The owner asked for alternatives.

## Options considered (verified 2026-10-15)
1. **Static-first, client-heavy admin UI + thin API handlers** — chosen as primary. Workers serve static assets, and with `assets_navigation_prefers_asset_serving` (compatibility date ≥ 2025-04-01) **navigation requests do not invoke the Worker script**; only API/data calls do, so SSR CPU leaves the hot path. Source: `developers.cloudflare.com/workers/static-assets/routing/single-page-application`.
2. **Split the API into a lean Worker (Hono) separate from the Next.js UI** — fallback. Hono is < 14 kB with zero dependencies and an ultrafast router; Cloudflare recommends splitting functionality across Workers (Service bindings) to cut size/CPU. Sources: `hono.dev/docs`, `developers.cloudflare.com/workers/platform/limits`.
3. **Offload heavy computation to Durable Objects** (Cloudflare's guidance) — not needed at MVP scale; keep in reserve.
4. **Paid Workers plan** (30M CPU-ms/month included) — rejected for now (ADR-0003); an approval gate.

## Decision
Design for the Free budget first: keep the admin UI **static-first** (SSG/CSR — the Worker serves assets on navigation, not SSR), keep route handlers **thin** (validate → `can()` → Drizzle → JSON; heavy work in SQL), and measure CPU + compressed bundle in Phase 0. If the Next.js Worker still exceeds the budget, **fall back to a split**: static/SPA UI + a lean **Hono** API Worker. Only if both fail, ask the owner to approve a paid plan.

## Consequences
- Positive: stays free and fast; static-first + thin handlers are good design regardless.
- Negative/risk: static-first constrains server-rendered personalization; some screens fetch client-side (acceptable for an internal admin app). The split fallback is a real design change, deferred until Phase 0 evidence.
- Spine AD-11 updated with this mitigation order.

## Verification
- Phase 0 measures CPU/bundle for a representative flow (login → dashboard → list members) and records the numbers; the go/no-go on Next.js-on-Workers — and whether the Hono split is needed — is decided from that evidence.
