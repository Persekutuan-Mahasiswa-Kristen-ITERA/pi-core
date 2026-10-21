# ADR-0019: One data plane for the live deployment, exposed on `core.pmkitera.web.id`

- **Status:** Accepted (owner decision, 2026-10-21)
- **Supersedes:** the production/staging *resource* split proposed in ADR-0003 and in `docs/OPERATIONS.md` §2.2
  (which assumed a second Supabase project, a second R2 bucket and a second Worker pair for production).

## Context

The owner's decision: no second Supabase project, no second R2 bucket, no second Worker fleet for
production. `pmkitera.web.id` already exists, so the intent is to expose PI-CORE as
`core.pmkitera.web.id` (web) and `api.core.pmkitera.web.id` (API) on the resources that already exist.

Verified facts that shape this decision (2026-10-21):

- The staging Supabase project and its Hyperdrive config (`afcb66f5…`) already hold the real organization
  data; there is no separate "production data" anywhere.
- R2 bucket `pmk-core-avatars` is the only bucket.
- The domain's nameservers are **Rumahweb** (`nsid1-4.rumahweb.*`), held by the organization's academic
  supervisor, and the zone serves **five** Vercel hostnames: `pmkitera.web.id` (A `216.198.79.1`), `www`,
  `form`, `ark` and `s` (CNAMEs to `*.vercel-dns-017.com`). Cloudflare Workers custom domains require the
  zone to be hosted on Cloudflare ("…or on a zone you do not own"), so a nameserver move — requested from
  the supervisor — is a prerequisite, not a detail. The move does not touch those applications: their
  records are reproduced identically, DNS-only, so Vercel keeps terminating TLS.
- The zone carries **no MX and no TXT records** — the move risks web delivery only, not email.

## Decision

1. **One data plane.** Production uses the existing Supabase project (same Hyperdrive config) and the
   existing R2 bucket. This is declared explicitly with `"DATA_PLANE": "shared"` in
   `apps/api/wrangler.jsonc` `env.production`, and `scripts/check-production-ready.mjs` fails if the
   Hyperdrive ids match without that declaration — a shared database must be a written decision, never an
   accident.
2. **One Worker pair.** `pi-core-api` and `pi-core-web`, each attached to its custom domain. The
   `pi-core-*-staging` Workers are redeployed away and deleted once the domain is live, so exactly one pair
   remains. A Worker is stateless; deleting the old pair removes code, not data.
3. **The `workers.dev` hostname stays as the test URL.** `pi-core-api.pmkitera.workers.dev` and
   `pi-core-web.pmkitera.workers.dev` continue to resolve to the same deployment, so testing does not
   require a second environment. They are added to `CORS_ORIGINS`.
4. **The domain moves to Cloudflare.** Nameservers at Rumahweb are replaced by Cloudflare's. Existing
   records (`@` → Vercel, `www` → Vercel, `form` → Vercel) are recreated **DNS only** (grey cloud) so
   Vercel keeps terminating TLS.

## Consequences

- **The safety net is a backup, not a second environment.** A staging experiment and a live request now hit
  the same rows. Every mutation is real. `docs/OPERATIONS.md` §6 (backup/restore) becomes mandatory before
  each migration, and there is no "roll back the environment" move — only "roll back the Worker version"
  and "restore the database".
- **Migrations are irreversible in practice.** They run once, against live data. They must be additive and
  rehearsed on a local Postgres first.
- **No more "staging data" to hide in.** Test members, test units and test audit rows are production rows;
  they must be created and removed deliberately.
- **Cost stays on the free tier** (ADR-0014): one Supabase project, one Hyperdrive, one bucket, one Worker
  pair.
- **Renaming is a deploy-time event.** A Worker's name cannot be edited, so `pi-core-api` is created by the
  first production deploy; the old `pi-core-api-staging` keeps serving until that deploy is verified, then
  is deleted with the owner's approval.

## Alternatives rejected

- **Second Supabase project + bucket + Hyperdrive** (the original plan): clean isolation, but a second free
  project to keep fed, a second set of migrations, and the owner explicitly ruled it out.
- **Keep only `*.workers.dev` and skip the domain**: free, zero DNS risk, but the URL is not something the
  organization can put in front of members, and Google OAuth consent would show a `workers.dev` host.
- **CNAME the subdomains from Rumahweb to `*.workers.dev`**: not supported — Cloudflare answers only for
  hostnames in a zone it hosts, so the subdomain would have to be a zone of its own (Enterprise).
- **Cloudflare partial (CNAME) setup on the existing zone**: requires a paid plan, against ADR-0014.
