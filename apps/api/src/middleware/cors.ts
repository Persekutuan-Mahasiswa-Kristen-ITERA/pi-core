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

const ALLOWED_HEADERS = "content-type, authorization, x-request-id";

function applyCorsHeaders(headers: Headers, origin: string): void {
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("vary", "Origin");
  headers.set("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("access-control-allow-headers", ALLOWED_HEADERS);
  headers.set("access-control-max-age", "600");
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
    c.header("access-control-allow-headers", ALLOWED_HEADERS);
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

/**
 * Re-applies the CORS headers to the **final** response.
 *
 * `c.header()` writes to the response Hono builds at the end of the chain, but a route that returns a
 * `Response` it created itself replaces that object outright — and the Better Auth handler mounted at
 * `/api/auth` does exactly that. The symptom is nasty because it is invisible to `curl` without an
 * `Origin`: the token endpoint answered `401 invalid_grant` correctly, but with no
 * `Access-Control-Allow-Origin`, so the browser discarded it and the page reported
 * `TypeError: Failed to fetch` while the server had done nothing wrong.
 *
 * Registered after the CORS middleware in `app.ts`; it only fills in what is missing, never overrides.
 */
export const corsResponseMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await next();

  const origin = c.req.header("origin");
  if (origin === undefined || c.res === undefined) return;
  if (!allowedOrigins(c.env).includes(origin)) return;
  if (c.res.headers.has("access-control-allow-origin")) return;

  const headers = new Headers(c.res.headers);
  applyCorsHeaders(headers, origin);
  // A response produced by `fetch()` has immutable headers, so it is rebuilt rather than mutated.
  c.res = new Response(c.res.body, {
    status: c.res.status,
    statusText: c.res.statusText,
    headers,
  });
});

