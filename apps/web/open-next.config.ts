import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare adapter configuration for PI-CORE.
 * Defaults are fine for now; incremental cache / queue overrides land with the
 * data stories (Epic 2) if needed.
 */
export default defineCloudflareConfig();
