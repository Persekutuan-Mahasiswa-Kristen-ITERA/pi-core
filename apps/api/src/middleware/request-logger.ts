/**
 * Structured request logging for Cloudflare Workers Observability (NFR-14, NFR-20).
 *
 * Produces structured JSON logs for each completed HTTP request:
 * - Includes correlation `requestId` (matching `X-Request-Id` header and `audit_logs.request_id`).
 * - Includes HTTP method, path, response status, and duration in ms.
 * - STRICTLY omits authorization headers, cookies, query tokens, and request/response bodies
 *   to ensure zero secret or sensitive data leakage (NFR-13, NFR-14).
 */
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

export const requestLoggerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const start = Date.now();
  await next();
  const durationMs = Date.now() - start;
  const requestId = c.get("requestId") ?? "";
  const status = c.res.status;
  const method = c.req.method;
  const path = c.req.path;

  // Single structured JSON line per request
  console.log(
    JSON.stringify({
      event: "http_request",
      requestId,
      method,
      path,
      status,
      durationMs,
      environment: c.env.ENVIRONMENT ?? "local",
    }),
  );
});
