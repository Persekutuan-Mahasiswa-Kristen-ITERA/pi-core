---
name: cloudflare-deploy
description: Use when configuring, building or deploying PI-CORE on Cloudflare (Workers via OpenNext, wrangler config, Hyperdrive, R2, rate limiting, secrets, environments, custom domains, CI). Load before touching wrangler config, bindings, deploy workflows or env vars.
---

# Cloudflare deploy skill

Cloudflare tooling changes quickly. **Never rely on memory**: consult the current official docs (developers.cloudflare.com, opennext.js.org/cloudflare) or any Cloudflare/docs MCP available,
and record what you verified (version + date) in an ADR or the task report.

## Procedure
1. Inspect: `wrangler --version`, `wrangler whoami`, existing `wrangler.jsonc|toml`, `open-next.config.*`, CI workflows, which Cloudflare account/zone is authenticated. Do not assume.
2. Confirm adapter and Next.js version compatibility from the OpenNext docs; pin versions. Check the compatibility flags and Node APIs required.
3. Postgres from Workers: use a Hyperdrive binding with a Workers-compatible driver (verify which: postgres.js / node-postgres) and the connection string type the docs recommend.
   Never open a connection at module scope; create per request. Keep queries short (Workers CPU/time limits).
4. Bindings declared per environment (`env.staging`, `env.production`); generate types (`wrangler types`) and commit the result. Never share bindings between staging and production.
5. Secrets: `wrangler secret put` / GitHub environment secrets. Local: `.dev.vars` (gitignored) plus `.dev.vars.example`. Never print secrets in logs.
6. R2: private buckets, per-environment, CORS only if needed, access through authorized routes or short-lived signed URLs.
7. Custom domain: requires the zone on Cloudflare. If it is not, STOP and ask the owner (do not change nameservers/DNS yourself).
8. CI: lint + typecheck + test -> build -> deploy staging (automatic). Production = separate workflow with a manual approval gate. Apply DB migrations as an explicit, ordered step (see `db-migrations`).
9. Verify after deploy: health endpoint, a real request through the Worker to the DB, headers (CSP/HSTS), and that logs contain a request id.

## Checks before reporting done
- Bundle size and CPU limits vs the current plan tier (report numbers; if the free plan is insufficient, ask the owner before recommending a paid plan).
- No production resource was created or changed without approval.
- `docs/ROADMAP.md`, AGENTS.md "Commands", and `.env.example` / `.dev.vars.example` are up to date.
