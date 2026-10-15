/**
 * CORS and CSRF (FR-54).
 *
 * The rule the requirement states is "no wildcard with credentials", and the reason is worth being
 * precise about: `Access-Control-Allow-Origin: *` together with
 * `Access-Control-Allow-Credentials: true` is rejected by browsers, and any looser arrangement would
 * let an arbitrary site make *credentialed* calls with the user's session cookie. So the origin is
 * **echoed** only when it is on the allowlist, and the response is `Vary: Origin` so no cache can hand
 * one origin's response to another.
 *
 * CSRF is handled by the same allowlist rather than by tokens: a cookie-authenticated mutation is
 * refused when it arrives with an `Origin` that is not allowed. Requests with **no** `Origin` are
 * allowed — that is the native mobile app (story 3.3) and same-origin navigations, neither of which a
 * browser will attach another site's cookies to. A token scheme would add state to manage and protect
 * nothing further here, because the session cookie is already `SameSite=Lax` and `HttpOnly`.
 */
import { createMiddleware } from "hono/factory";
import { forbidden } from "../http/errors";
import type { AppEnv, Env } from "../env";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** The API's own origin plus whatever the environment adds (the admin web app). */
export function allowedOrigins(env: Env): string[] {
  return [env.BETTER_AUTH_URL, ...(env.CORS_ORIGINS ?? "").split(",")]
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

export const corsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.req.header("origin");
  const allowed = allowedOrigins(c.env);
  const isAllowed = origin !== undefined && allowed.includes(origin);

  if (isAllowed) {
    c.header("access-control-allow-origin", origin);
    c.header("access-control-allow-credentials", "true");
    c.header("vary", "Origin");
    c.header("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    c.header("access-control-allow-headers", "content-type, authorization, x-request-id");
    c.header("access-control-max-age", "600");
  }

  if (c.req.method === "OPTIONS") {
    return isAllowed ? c.body(null, 204) : c.body(null, 403);
  }

  if (MUTATING.has(c.req.method) && origin !== undefined && !isAllowed) {
    throw forbidden("Cross-origin request refused.");
  }

  await next();
});
