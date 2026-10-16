/**
 * Member reads — story 4.2 (FR-8, FR-9, FR-26, FR-51).
 *
 * The route is deliberately thin: `requirePermission("member:read")` decides *whether* the actor may
 * read members at all, and `listMembers`/`getMember` decide *which* ones, inside the SQL. Nothing here
 * filters rows in application code, so there is no path that could return a member the scope excluded.
 */
import { getMember, listMembers } from "@pi-core/db";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { notFound } from "../http/errors";
import { parseQuery } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";

export const memberRoutes = new Hono<AppEnv>();

memberRoutes.use("*", sessionMiddleware);

const listQuery = z
  .object({
    /** Free-text search over name and email. */
    q: z.string().trim().min(1).max(100).optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

memberRoutes.get("/", requirePermission("member:read"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const query = parseQuery(c, listQuery);
  const result = await listMembers(db, {
    actor,
    ...(query.q === undefined ? {} : { search: query.q }),
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
    ...(query.limit === undefined ? {} : { limit: query.limit }),
  });

  // `sensitiveIncluded` is reported rather than inferred by the client: whether NIM and phone are
  // present depends on the caller's permissions, and a client that guessed would render blanks.
  return c.json({
    items: result.items,
    nextCursor: result.nextCursor,
    sensitiveIncluded: result.sensitiveIncluded,
  });
});

memberRoutes.get("/:id", requirePermission("member:read"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const id = c.req.param("id");
  const member = await getMember(db, { actor, id });

  // Out of scope and nonexistent are answered identically on purpose: a distinct 403 would confirm the
  // id exists, which is the enumeration the scoping exists to prevent (FR-8).
  if (member === null) throw notFound("Member not found.");

  return c.json({ member });
});
