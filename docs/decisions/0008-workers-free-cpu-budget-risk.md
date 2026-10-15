# ADR-0008: Workers Free CPU budget (10 ms) is a binding constraint — measure before committing
- Status: accepted
- Date: 2026-10-15
- Deciders: owner (no paid plan) / agent (risk record)

## Context
ADR-0003 fixed Workers **Free** as the ceiling (no paid plan). Cloudflare's current limits (verified 2026-10-15, `developers.cloudflare.com/workers/platform/limits`): **10 ms CPU per HTTP request**, 100,000 requests/day, 128 MB memory, **3 MiB** compressed Worker, 50 subrequests/request, 6 concurrent outbound connections. Cloudflare's own note: *"Heavier workloads that handle authentication, server-side rendering, or parse large payloads typically use 10–20 ms."* PI-CORE is exactly that shape (auth + SSR + RBAC + JSON).

## Options considered
1. Assume Free is enough — rejected: the official docs contradict that assumption.
2. **Treat the 10 ms budget as binding, measure early, design thin handlers, re-scope if exceeded** (chosen).
3. Move to a paid plan — not authorised (ADR-0003; approval gate).

## Decision
Workers Free is the target. Mitigate by: keeping route handlers thin; pushing work into SQL (scope filters in the query, AD-3); avoiding heavy SSR on hot paths; caching where safe; and **measuring CPU + compressed bundle size in Phase 0** on a representative flow (login → dashboard → list members). If the budget is exceeded, report and re-scope (e.g. move the API to a leaner Worker and keep Next.js for the UI) — **do not upgrade without owner approval**.

## Consequences
- Positive: an explicit budget prevents a late "it doesn't fit" surprise; SQL-side filtering and thin handlers are good design anyway.
- Negative/risk: Next.js-on-Workers may not fit the Free CPU budget for the admin UI; the fallback (split API/UI, or a non-Next API Worker) is a real design change to decide with evidence in Phase 0.
- Also watch: the 3 MiB compressed Worker size and the 100k/day request cap.

## Verification
- Phase 0 measures CPU time and compressed Worker size for a representative flow and records the numbers in `docs/STATE.md`; the result feeds a go/no-go on the Next.js-on-Workers shape.
