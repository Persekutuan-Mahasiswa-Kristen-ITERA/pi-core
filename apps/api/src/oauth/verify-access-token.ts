/**
 * OAuth access-token verification shared by the resource endpoint and the session middleware
 * (ADR-0017, story 6.3/6.4).
 *
 * The signing keys are read **in-process** from the `jwks` table and handed to Better Auth's own
 * resource-client verifier as a *function*, never as a URL. On Cloudflare Workers a subrequest from
 * the Worker back to its own `*.workers.dev` hostname answers 404, which made every real token fail
 * with `Jwks failed: Not Found` while `curl` against the same path returned 200. A function source
 * also costs no subrequest, which matters under the Workers Free CPU budget (ADR-0008).
 */
import { loadJwks, type Database } from "@pi-core/db";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import type { Env } from "../env";

const resourceClient = oauthProviderResourceClient();

export interface AccessTokenAudience {
  issuer: string;
  audience: string;
}

/**
 * The issuer Better Auth signs with (its baseURL **plus** the auth base path) and the audience the
 * protected API answers on (the bare origin). `docs/INTEGRATION-CONTRACT.md` documents both.
 */
export function accessTokenAudience(env: Env): AccessTokenAudience {
  const origin = env.BETTER_AUTH_URL.replace(/\/$/, "");
  return { issuer: `${origin}/api/auth`, audience: origin };
}

/**
 * Verifies an OAuth access token and returns its claims.
 *
 * Checks the signature, `iss`, `aud`, expiry and the `pmk:access` scope. It does **not** decide
 * anything about the member: callers must still resolve roles and permissions from the database,
 * because a token identifies a subject and nothing more (FR-31, ADR-0002).
 */
export async function verifyAccessTokenWithLocalJwks(
  db: Database,
  token: string,
  options: AccessTokenAudience,
): Promise<Record<string, unknown>> {
  return (await resourceClient.getActions().verifyAccessToken(token, {
    jwksUrl: (async () => loadJwks(db)) as unknown as string,
    verifyOptions: { issuer: options.issuer, audience: options.audience },
    scopes: ["pmk:access"],
  })) as Record<string, unknown>;
}
