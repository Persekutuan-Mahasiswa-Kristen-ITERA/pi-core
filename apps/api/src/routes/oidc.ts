import { Hono } from "hono";
import type { Context } from "hono";

import type { AppEnv } from "../env";
import { authMiddleware } from "../middleware/auth";

/**
 * OIDC issuer aliases. Better Auth owns the protocol implementation under `/api/auth`;
 * these root aliases expose the standard issuer URLs and preserve one implementation of
 * discovery, JWKS and PKCE/token validation.
 */
export const oidcRoutes = new Hono<AppEnv>();
// Do not mount auth middleware on `*`: this router is mounted at `/`, and a wildcard would
// open Hyperdrive for every unrelated root path and turn ordinary 404s into 500s in local tests.
for (const path of [
  "/.well-known/openid-configuration",
  "/.well-known/oauth-authorization-server",
  "/jwks",
] as const) {
  oidcRoutes.use(path, authMiddleware);
}

async function forwardToAuth(c: Context<AppEnv>, path: string): Promise<Response> {
  const url = new URL(c.req.url);
  url.pathname = `/api/auth${path}`;
  return c.get("auth")!.handler(new Request(url, c.req.raw));
}

oidcRoutes.get("/.well-known/openid-configuration", (c) =>
  forwardToAuth(c, "/.well-known/openid-configuration"),
);
oidcRoutes.get("/.well-known/oauth-authorization-server", (c) =>
  forwardToAuth(c, "/.well-known/oauth-authorization-server"),
);
oidcRoutes.get("/jwks", (c) => forwardToAuth(c, "/jwks"));
