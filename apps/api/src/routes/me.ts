/**
 * The caller's own record — the one endpoint a plain member needs.
 *
 * `/api/v1/access` answers the same question for an **OAuth client**, but it demands a signed JWT: it
 * verifies the token itself instead of trusting `sessionMiddleware`. The mobile app holds an opaque
 * session token (`routes/mobile-auth.ts`), so it needs a route that reads the actor the middleware
 * already resolved. That is all this is.
 *
 * Guarded by `profile:read_own`, which `UNIVERSAL_GRANTS` gives every role, and the query is aimed at
 * `self` — so it can never become a way to read someone else's record.
 */
import { getMember } from "@pi-core/db";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { unauthorized } from "../http/errors";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";

export const meRoutes = new Hono<AppEnv>();

meRoutes.use("*", sessionMiddleware);

meRoutes.get("/", requirePermission("profile:read_own", { target: () => ({ kind: "self" }) }), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw unauthorized("Sign in required.");

  // `getMember` includes the sensitive columns for your own row, so NIM and phone are present here
  // even when the actor cannot read anyone else's (FR-9).
  const member = await getMember(db, { actor, id: actor.memberId });
  if (member === null) throw unauthorized("Member access is no longer active.");

  return c.json({ member, roles: actor.roles });
});
