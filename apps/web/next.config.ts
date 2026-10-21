import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Wire Cloudflare bindings (Hyperdrive, R2, Durable Objects) into `next dev`.
void initOpenNextCloudflareForDev();

/**
 * PI-CORE web app.
 *
 * Runs on the Next.js **Node.js runtime** (required by @opennextjs/cloudflare,
 * see ADR-0007/ADR-0009) and is deployed to Cloudflare Workers Free. Pages are
 * kept **static-first** so navigation is served from static assets and does not
 * invoke the Worker script — see ADR-0010 (Workers Free 10 ms CPU budget).
 */

/**
 * The API origin the browser talks to. Derived from the same variable the client reads, so the CSP
 * cannot drift from where the app actually sends its bearer tokens.
 *
 * The staging default is a convenience for local and staging builds. A **production** build must pass
 * the variable explicitly, because `NEXT_PUBLIC_*` is baked into the bundle at build time: building the
 * production Worker without it would ship a bundle that calls the staging API and a CSP that permits
 * only the staging origin — a mistake that would look like "production is broken" after deploy. Hence
 * the hard stop below, triggered only when the build is told it is for production.
 */
const apiOrigin =
  process.env.NEXT_PUBLIC_API_URL ?? "https://pi-core-api-staging.pmkitera.workers.dev";

if (process.env.ENVIRONMENT === "production" && process.env.NEXT_PUBLIC_API_URL === undefined) {
  throw new Error(
    "ENVIRONMENT=production but NEXT_PUBLIC_API_URL is unset: the bundle would call the staging API. " +
      "Build with NEXT_PUBLIC_API_URL=https://api.core.pmkitera.web.id.",
  );
}

/** `https:` → `wss:`, `http:` → `ws:`; the realtime hub upgrades the same host. */
const realtimeOrigin = apiOrigin.replace(/^http/, "ws");

const contentSecurityPolicy = [
  "default-src 'self'",
  // `'unsafe-inline'` is what Next.js needs for the inline bootstrap/flight scripts in a **static**
  // page. Removing it means a per-response nonce, and a nonce forces dynamic rendering — which is the
  // CPU cost ADR-0010 exists to avoid. `'unsafe-eval'` is gone: nothing in a production build evals,
  // and it was only there for dev tooling, which never runs under this header in production.
  "script-src 'self' 'unsafe-inline'",
  // Next injects inline `style` attributes; there is no nonce path for those.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  // fetch/SSE go to the API origin, and the realtime WebSocket to the same host over wss:.
  `connect-src 'self' ${apiOrigin} ${realtimeOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
