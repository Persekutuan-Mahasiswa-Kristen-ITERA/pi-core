import { loadAccessSnapshot, withDb } from "@pi-core/db";
import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../env";
import { accessRateLimit } from "../middleware/rate-limit";
import { unauthorized, forbidden } from "../http/errors";
import { accessTokenAudience, verifyAccessTokenWithLocalJwks } from "../oauth/verify-access-token";

export const accessRoutes = new Hono<AppEnv>();

export function extractBearerToken(header: string | undefined): string {
  if (header === undefined || !/^Bearer\s+\S+$/i.test(header))
    throw unauthorized("Bearer access token required.");
  return header.replace(/^Bearer\s+/i, "");
}

function bearerToken(c: Context<AppEnv>): string {
  return extractBearerToken(c.req.header("authorization"));
}

accessRoutes.get("/access", accessRateLimit, async (c) => {
  const token = bearerToken(c);

  // Validate compact JWS structure (header.payload.signature) before opening database connection
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw unauthorized("Invalid or expired access token.");
  }

  // Better Auth signs JWTs with the JWT plugin issuer under /api/auth.
  // The protected resource audience remains the API origin.
  const { issuer, audience } = accessTokenAudience(c.env);

  return withDb(c.env.HYPERDRIVE, async (db) => {
    let claims: Record<string, unknown>;
    try {
      claims = await verifyAccessTokenWithLocalJwks(db, token, {
        issuer,
        audience,
      });
    } catch (error) {
      const details =
        error instanceof Error ? error.message : "unknown verifier error";
      console.error("oauth access token verification failed", {
        errorType: error instanceof Error ? error.name : typeof error,
        details: details.slice(0, 160),
      });
      throw unauthorized("Invalid or expired access token.");
    }

    const subject = claims.sub;
    const scope =
      typeof claims.scope === "string"
        ? claims.scope.split(" ").filter(Boolean)
        : [];
    if (typeof subject !== "string" || !scope.includes("pmk:access")) {
      throw forbidden("The access token has no PI-CORE access scope.");
    }

    const snapshot = await loadAccessSnapshot(db, subject);
    if (snapshot === null)
      throw unauthorized("Member access is no longer active.");

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
          expiresAt:
            typeof claims.exp === "number"
              ? new Date(claims.exp * 1000).toISOString()
              : null,
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
