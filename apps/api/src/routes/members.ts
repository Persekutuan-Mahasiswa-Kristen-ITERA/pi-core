/**
 * Member reads — story 4.2 (FR-8, FR-9, FR-26, FR-51).
 *
 * The route is deliberately thin: `requirePermission("member:read")` decides *whether* the actor may
 * read members at all, and `listMembers`/`getMember` decide *which* ones, inside the SQL. Nothing here
 * filters rows in application code, so there is no path that could return a member the scope excluded.
 */
import {
  countVisibleMembersByStatus,
  createMember,
  deactivateMember,
  getMember,
  listMembers,
  MemberWriteError,
  updateMember,
} from "@pi-core/db";
import { createRealtimeEvent } from "@pi-core/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { conflict, forbidden, notFound } from "../http/errors";
import { parseJson, parseQuery } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";
import { publishRealtimeEvent } from "../realtime/publisher";

export const memberRoutes = new Hono<AppEnv>();

memberRoutes.use("*", sessionMiddleware);

/** Request metadata for the audit row (FR-43), omitting absent headers (`exactOptionalPropertyTypes`). */
function requestFacts(c: Context<AppEnv>) {
  const ip = c.req.header("cf-connecting-ip");
  const userAgent = c.req.header("user-agent");
  const requestId = c.get("requestId");
  return {
    ...(ip === undefined ? {} : { ip }),
    ...(userAgent === undefined ? {} : { userAgent }),
    ...(requestId === undefined ? {} : { requestId }),
  };
}

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

memberRoutes.get("/stats", requirePermission("member:read"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  /**
   * Declared **before** `/:id`: Hono matches in registration order, so `/:id` would otherwise swallow
   * "stats" and answer 404 "Member not found." for a member id that never existed.
   *
   * The counts use the same scope predicate as the list (`countVisibleMembersByStatus`), because a total
   * that ignored scope would tell a unit head how many members exist outside their unit.
   */
  const counts = await countVisibleMembersByStatus(db, actor);
  return c.json(counts);
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

/** Turn the write layer's typed failures into the uniform envelope (FR-51). */
function writeFailure(error: unknown): never {
  if (error instanceof MemberWriteError) {
    if (error.code === "conflict") throw conflict("That email is already in use.");
    if (error.code === "not_found") throw notFound("Member not found.");
    throw forbidden(
      "You cannot change that. A member may edit only their own phone and photo; other fields need member:update.",
    );
  }
  throw error;
}

const createBody = z
  .object({
    email: z.email().max(200),
    fullName: z.string().trim().min(1).max(150),
    nim: z.string().trim().max(30).nullable().optional(),
    faculty: z.string().trim().max(150).nullable().optional(),
    studyProgram: z.string().trim().max(150).nullable().optional(),
    cohortYear: z.number().int().min(1990).max(2100).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    avatarKey: z.string().trim().max(300).nullable().optional(),
  })
  // `.strict()` is the FR-10 consequence: an unknown field is rejected, not dropped. Silently ignoring
  // `status` or `googleSub` would make a typo look like success and is how mass assignment gets in.
  .strict();

memberRoutes.post("/", requirePermission("member:create"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const body = await parseJson(c, createBody);
  try {
    const member = await createMember(db, { actor, input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("members", "member", member.id, "created"));
    return c.json({ member }, 201);
  } catch (error) {
    return writeFailure(error);
  }
});

const updateBody = createBody
  .partial()
  // An empty PATCH is a mistake worth naming rather than a no-op that still writes an audit row.
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to change." });

memberRoutes.patch(
  "/:id",
  // Guarded by the *self* form here; `updateMember` applies the real rule, which is per-field: a member
  // may change their own phone and photo (FR-11), anything else needs `member:update` and its scope.
  requirePermission("profile:update_own", { target: () => ({ kind: "self" }) }),
  async (c) => {
    const db = c.get("db");
    const actor = c.get("actor");
    if (db === undefined || actor === undefined) throw notFound();

    const body = await parseJson(c, updateBody);
    try {
      const member = await updateMember(db, {
        actor,
        id: c.req.param("id"),
        input: body,
        request: requestFacts(c),
      });
      await publishRealtimeEvent(c, createRealtimeEvent("members", "member", member.id, "updated"));
      return c.json({ member });
    } catch (error) {
      return writeFailure(error);
    }
  },
);

memberRoutes.post("/:id/deactivate", requirePermission("member:deactivate"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  try {
    const result = await deactivateMember(db, {
      actor,
      id: c.req.param("id"),
      request: requestFacts(c),
    });
    await publishRealtimeEvent(c, createRealtimeEvent("members", "member", result.member.id, "deactivated"));
    // The session count is returned because it is the visible half of FR-5: the caller can see that
    // access actually ended, not merely that the status changed.
    return c.json({ member: result.member, sessionsRevoked: result.sessionsRevoked });
  } catch (error) {
    return writeFailure(error);
  }
});
