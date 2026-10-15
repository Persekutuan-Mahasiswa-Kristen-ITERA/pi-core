# ADR-0012 — Pin Next.js to 16.3.8 (OpenNext / Workers compatibility)

- **Status:** Accepted
- **Date:** 2026-10-15
- **Related:** ADR-0003 (staging on `*.workers.dev`, Free tier), ADR-0010 (Workers Free CPU budget)

## Context

`apps/web` runs Next.js on Cloudflare Workers through `@opennextjs/cloudflare`. The first staging
deploy (story 1.4) **succeeded at the platform level** — upload, assets, startup — but every request
returned **Cloudflare error 1101** (Worker threw an exception). `wrangler tail --env staging` showed:

```
Error: Unexpected loadManifest(/.next/server/preview-props.json) call!
  at loadManifest
  at NextNodeServer.getPreviewProps
  at new Server / new NextNodeServer
```

Next.js **16.4** moved preview props out of `prerender-manifest.json` into a standalone
`.next/server/preview-props.json`, loaded unconditionally by `NextNodeServer.getPreviewProps()` from
the server constructor. The adapter patches `loadManifest()` with a **build-time inlined glob of
`*-manifest.json`**, which does not match `preview-props.json`, so the patched function throws at
runtime and every route 500s.

Verified upstream (not from memory): issue `opennextjs/opennextjs-cloudflare#1448` (open) and fix PR
`#1356` — *"include preview-props.json in loadManifest glob for Next.js 16.4"*. The newest published
adapter at the time, **`@opennextjs/cloudflare` 1.20.11**, does **not** contain that fix. The adapter
documents its supported floor as **"Next.js 15.5.27 or 16.3.8"**.

## Decision

Pin `next` to **exactly `16.3.8`** in `apps/web/package.json` — the last release before the 16.4
manifest change, and the version named by the adapter's supported floor. Do **not** float to `^16`.

## Consequences

- Staging renders: `https://pi-core-web-staging.pmkitera.workers.dev` → **HTTP 200**, `<title>PI-CORE</title>`.
- We stay on a security-supported Next release (16.3.8 carries the fixes the adapter requires).
- Next 16.4.x is unusable on Workers until the adapter ships the `preview-props.json` fix.
- **Revisit when** `@opennextjs/cloudflare` releases a version containing PR #1356: bump Next, rebuild,
  redeploy staging and re-run the smoke check.
- The exact pin is deliberate — a caret range would silently re-break the deploy on the next install.

## Alternatives considered

- **Keep Next 16.4.1 and patch the adapter locally** (`pnpm patch`): works, but adds a private patch we
  must re-verify on every adapter bump — more risk than a one-line pin.
- **Wait for the adapter fix**: blocks the staging milestone (story 1.4) indefinitely.
- **Drop to Next 15.x**: larger regression surface, and Next is dropping that line.
