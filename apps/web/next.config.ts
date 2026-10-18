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
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.workers.dev; frame-ancestors 'none';",
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
