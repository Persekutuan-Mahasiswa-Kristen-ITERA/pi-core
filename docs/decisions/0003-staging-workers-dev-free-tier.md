# ADR-0003: Staging on `*.workers.dev`; no paid Cloudflare resources
- Status: accepted
- Date: 2026-10-15
- Deciders: owner

## Context
`docs/ARCHITECTURE.md` §8 proposed a custom domain `core.pmkitera.web.id` (which requires the zone on Cloudflare DNS) and noted that Workers Free limits may be insufficient for Next.js via OpenNext. During PRD review the owner answered OQ-1: `pmkitera.web.id` is **not** on Cloudflare DNS, and no paid Workers plan should be used.

## Options considered
1. Move DNS to Cloudflare + custom domain + possibly a paid Workers plan — rejected by the owner (cost / DNS control).
2. **Free-tier only: staging on a `*.workers.dev` subdomain; no paid resources** (chosen).

## Decision
- No paid Cloudflare/Supabase resources; Workers **Free** is the ceiling.
- Staging is served from a `*.workers.dev` subdomain; the custom domain is deferred.
- If Next.js via OpenNext exceeds Workers Free limits, report and re-scope (split the API, trim the bundle, move heavy work off the Worker) rather than upgrade — upgrading is an approval gate.

## Consequences
- Positive: zero cost; no DNS dependency.
- Negative/risk: Free-plan limits (bundle size, CPU time, request limits) may constrain the Next.js-on-Workers approach; this must be measured early (Phase 0) and reported before it becomes a blocker.

## Verification
- Phase 0 measures bundle size and CPU against Workers Free limits and reports; the deploy target is a `*.workers.dev` subdomain.
