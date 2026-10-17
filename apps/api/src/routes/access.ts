import { loadAccessSnapshot, withDb } from "@pi-core/db";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../env";
import { accessRateLimit } from "../middleware/rate-limit";
import { unauthorized, forbidden } from "../http/errors";

export const accessRoutes = new Hono<AppEnv>();

const resourceClient = oauthProviderResourceClient();

export function extractBearerToken(header: string | undefined): string {
  if (header === undefined || !/^Bearer\s+\S+$/i.test(header)) throw unauthorized("Bearer access token required.");
  return header.replace(/^Bearer\s+/i, "");
}

function bearerToken(c: Context<AppEnv>): string {
  return extractBearerToken(c.req.header("authorization"));
}

accessRoutes.get("/access", accessRateLimit, async (c) => {
  const token = bearerToken(c);
  const issuer = `${c.env.BETTER_AUTH_URL.replace(/\/$/, "")}/api/auth`;
  // Better Auth uses its baseURL (the API origin) as the default resource audience.
  const audience = c.env.BETTER_AUTH_URL.replace(/\/$/, "");
  let claims: Record<string, unknown>;
  try {
    claims = (await resourceClient.getActions().verifyAccessToken(token, {
      jwksUrl: `${issuer}/jwks`,
      verifyOptions: { issuer, audience },
      scopes: ["pmk:access"],
    })) as Record<string, unknown>;
  } catch {
    throw unauthorized("Invalid or expired access token.");
  }

  const subject = claims.sub;
  const scope = typeof claims.scope === "string" ? claims.scope.split(" ").filter(Boolean) : [];
  if (typeof subject !== "string" || !scope.includes("pmk:access")) {
    throw forbidden("The access token has no PI-CORE access scope.");
  }

  return withDb(c.env.HYPERDRIVE, async (db) => {
    const snapshot = await loadAccessSnapshot(db, subject);
    if (snapshot === null) throw unauthorized("Member access is no longer active.");

    return c.json(
      {
        member: snapshot.member,
        activePeriod: snapshot.activePeriod,
        assignments: snapshot.assignments,
        roles: snapshot.roles,
        permissions: snapshot.permissions,
        token: {
          issuer,
          audience,
          scopes: scope,
          expiresAt: typeof claims.exp === "number" ? new Date(claims.exp * 1000).toISOString() : null,
        },
      },
      200,
      {
        "cache-control": "private, no-store",
        vary: "Authorization",
      },
    );
  });
});
