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
};

export default nextConfig;
