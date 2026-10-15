# ADR-0013 — Static-first rendering + thin API Worker (Workers Free viability)

- **Status:** Accepted
- **Date:** 2026-10-15
- **Related:** ADR-0003 (staging on `*.workers.dev`, Free tier), ADR-0008 / ADR-0010 (Workers Free CPU budget), ADR-0011 (real-time), ADR-0012 (Next.js pin)

## Context

Story 1.5 measured the live staging Worker. The owner's dashboard screenshot confirmed the Cloudflare
account is on **Workers Free ($0)**, where the documented CPU limit is **10 ms per request**.

Measured on `pi-core-web-staging` (`wrangler tail --env staging --format json`; `cpuTime` is in
milliseconds — confirmed against workers-go, workerd `worker-interface.capnp` and Cloudflare
error-1102 guides):

| | Measured | Free limit |
|---|---|---|
| CPU/request, warm | **14–40 ms** | 10 ms |
| CPU/request, cold start | **120–303 ms** | 10 ms |
| Compressed Worker | 822.30 KiB | 3 MiB ✅ |

**Every** request exceeds the CPU limit, yet 150+ requests across three bursts all returned **200**
(no `exceededCpu` outcome, no error 1102). We are running on the runtime's per-isolate "built-in
flexibility", which Cloudflare documents as applying only while overages stay *infrequent*. The
Next.js/OpenNext server therefore **works today but has no documented CPU headroom** on Workers Free,
and the CPU is dominated by bootstrapping the Next.js server (not by serving the page).

Constraints that shape the choice: the owner requires **no paid resources** (ADR-0003); the app is a
CRUD admin system (organisation structure, members, roles, assignments) plus a mobile client; and it
must be real-time everywhere (ADR-0011).

## Decision

**Adopt a static-first architecture with a thin API Worker.** Rendering is moved off the Worker's CPU
path:

1. **`apps/web` becomes a static export** — Next.js runs as a *build-time* static site generator
   (`output: "export"`); every page ships as HTML/JS/CSS. The admin UI is a client-side React app
   that fetches data over the API. Page navigations are served from **Cloudflare static assets** and
   therefore consume **no Worker CPU**.
2. **A thin API Worker** (`apps/api`, Hono) owns everything dynamic:
   - `/api/v1/*` route handlers (zod-validated),
   - the `RealtimeHub` Durable Object (ADR-0011),
   - the OIDC provider endpoints (Epic 6, Better Auth),
   - Postgres access through Hyperdrive.
   Hono routing plus one Hyperdrive round-trip is a few milliseconds of CPU — inside the Free limit.
3. **One Worker deployment** serves both: the `assets` binding serves the static UI, and
   `run_worker_first` is scoped to the API paths so only API requests invoke the Worker script.

`@opennextjs/cloudflare` is **no longer used for rendering**; the Next.js app is built once at build
time and its output is uploaded as static assets.

## Consequences

- Removes the Free-tier CPU risk: page views cost 0 CPU, API calls cost a few ms.
- Stays on Workers Free; no plan change, no ADR-0003 violation.
- Loses Next.js SSR/RSC and server-side data fetching. Accepted: this is an authenticated admin tool,
  and client-side fetching + the real-time hub is a good fit. SEO is irrelevant for the admin app.
- Auth must be **token/session based over the API** (Better Auth with cookie or bearer tokens), not
  Next middleware/session helpers — already the plan for the Expo mobile client (ADR-0007), so one
  auth path now serves web + mobile.
- The real-time channel is the natural data-refresh path, so the UI stays live without polling.
- `apps/web`'s OpenNext/Wrangler Worker config is superseded; static assets + the API Worker replace it.
- Story 1.2 stays valid (Next.js app + TypeScript + toolchain) but its *deployment* approach is
  replaced; a follow-up story will convert the app to static export and add `apps/api`.

## Alternatives considered

- **A — Accept and monitor.** Keep Next SSR on the Worker. Zero work, but no documented CPU headroom:
  a traffic spike could start returning error 1102 with no warning. Rejected as a foundation to build
  Epics 4–8 on.
- **C — Workers Paid ($5/mo).** Raises the CPU limit to 30 s and needs no re-architecture, but it is a
  paid resource and contradicts ADR-0003. Rejected by the owner.
- **B′ — Keep OpenNext but serve prerendered HTML from static assets.** Not achievable cleanly:
  OpenNext keeps prerendered HTML inside the server functions, so page requests still invoke the
  Worker; there is no supported way to route them to the assets binding.
