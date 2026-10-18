/**
 * Assignments — story 4.8 (FR-27, FR-31, FR-32, FR-33).
 *
 * Reads need `assignment:read` (scoped: `U` sees its own subtree, `S` only its own rows), writes need
 * `assignment:manage`. The rank/subtree guard (FR-27) and the derived role (FR-32) live in
 * `packages/db/src/assignments.ts`.
 *
 * Note what the create body does NOT contain: a `role`. The role comes from the position via
 * `position_roles`, and the way to guarantee a caller cannot supply one is for the field not to exist.
 */
import {
  AssignmentError,
  createAssignment,
  derivedRolesForPosition,
  listAssignments,
  listPositions,
  updateAssignment,
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

export const assignmentRoutes = new Hono<AppEnv>();

assignmentRoutes.use("*", sessionMiddleware);

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

function assignmentFailure(error: unknown): never {
  if (error instanceof AssignmentError) {
    if (error.code === "not_found") throw notFound("Assignment not found.");
    if (error.code === "forbidden") {
      // The reason is machine-readable and the refusal is already audited by `enforceDecision`.
      throw forbidden(error.reason ?? "Not permitted for that unit or rank.");
    }
    if (error.code === "unit_type_mismatch") {
      throw conflict("That position does not belong to that kind of unit.");
    }
    if (error.code === "duplicate") throw conflict("That member already holds that position in that unit.");
    if (error.code === "period_not_found") throw notFound("Period not found.");
    throw conflict(error.reason ?? "The assignment window is invalid.");
  }
  throw error;
}

// Declared before `/:id` so the path is not swallowed as an id — Hono matches in registration order.
assignmentRoutes.get("/positions", requirePermission("assignment:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  return c.json({ items: await listPositions(db) });
});

assignmentRoutes.get("/positions/:id/roles", requirePermission("assignment:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  try {
    return c.json({ positionId: c.req.param("id"), roles: await derivedRolesForPosition(db, c.req.param("id")) });
  } catch (error) {
    return assignmentFailure(error);
  }
});

const listQuery = z
  .object({
    memberId: z.uuid().optional(),
    orgUnitId: z.uuid().optional(),
    periodId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

assignmentRoutes.get("/", requirePermission("assignment:read"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();
  const query = parseQuery(c, listQuery);
  return c.json({ items: await listAssignments(db, { actor, ...query }) });
});

const createBody = z
  .object({
    memberId: z.uuid(),
    orgUnitId: z.uuid(),
    positionId: z.uuid(),
    periodId: z.uuid(),
    // ISO date only; an assignment window is day-granular, which is how FR-33 describes ending one.
    startsOn: z.iso.date().nullable().optional(),
  })
  .strict();

assignmentRoutes.post("/", requirePermission("assignment:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const body = await parseJson(c, createBody);
  try {
    const assignment = await createAssignment(db, { actor, input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("assignments", "assignment", assignment.id, "created"));
    return c.json({ assignment }, 201);
  } catch (error) {
    return assignmentFailure(error);
  }
});

const updateBody = z
  .object({
    endsOn: z.iso.date().nullable().optional(),
    startsOn: z.iso.date().nullable().optional(),
    orgUnitId: z.uuid().optional(),
    positionId: z.uuid().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to change." });

assignmentRoutes.patch("/:id", requirePermission("assignment:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const body = await parseJson(c, updateBody);
  try {
    const assignment = await updateAssignment(db, { actor, id: c.req.param("id"), input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("assignments", "assignment", assignment.id, "updated"));
    return c.json({ assignment });
  } catch (error) {
    return assignmentFailure(error);
  }
});
