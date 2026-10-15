/**
 * Security headers (NFR-10), applied to every response.
 *
 * The CSP is deliberately tight for an API that also serves one small HTML page (the staging sign-in
 * page): `default-src 'none'` with the few sources that page actually needs, and no `unsafe-inline`
 * beyond the single inline script it contains. JSON responses are unaffected by a CSP, so the cost of
 * being strict here is zero — and it means a future HTML endpoint inherits a safe default instead of
 * an empty one.
 */
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

export const securityHeadersMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await next();

  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "no-referrer");
  c.header("x-frame-options", "DENY");
  c.header(
    "content-security-policy",
    [
      "default-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      // The sign-in page's own inline script and styles; nothing else is loaded.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
    ].join("; "),
  );

  // Only meaningful over HTTPS, which is all Cloudflare serves; harmless locally.
  c.header("strict-transport-security", "max-age=31536000; includeSubDomains");
});
