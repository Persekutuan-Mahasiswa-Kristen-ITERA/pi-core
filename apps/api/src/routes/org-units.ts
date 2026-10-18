/**
 * Organization units — story 4.5 (FR-15, FR-16, FR-18).
 *
 * Reads are O-scoped (FR-15): every authenticated member can see the tree, because it is the org chart,
 * not personal data. Writes need `orgunit:manage`. The invariants — slug uniqueness per parent, no cycles
 * on a move, subtree path rewriting, soft delete — live in `packages/db/src/org-units.ts`.
 */
import { createOrgUnit, deactivateOrgUnit, listOrgUnits, OrgUnitError, updateOrgUnit } from "@pi-core/db";
import { createRealtimeEvent } from "@pi-core/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { conflict, notFound } from "../http/errors";
import { parseJson, parseQuery } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";
import { publishRealtimeEvent } from "../realtime/publisher";

export const orgUnitRoutes = new Hono<AppEnv>();

orgUnitRoutes.use("*", sessionMiddleware);

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

function orgUnitFailure(error: unknown): never {
  if (error instanceof OrgUnitError) {
    if (error.code === "conflict") throw conflict("That slug is already used under the same parent.");
    if (error.code === "cycle") {
      throw conflict("A unit cannot be moved under itself or one of its own descendants.");
    }
    if (error.code === "has_children") {
      throw conflict("Deactivate or move its children first.");
    }
    if (error.code === "type_in_use") {
      throw conflict("A unit's type cannot change while positions are assigned to it.");
    }
    throw notFound("Organization unit not found.");
  }
  throw error;
}

const listQuery = z.object({ includeInactive: z.enum(["true", "false"]).optional() }).strict();

orgUnitRoutes.get("/", requirePermission("orgunit:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();

  const query = parseQuery(c, listQuery);
  const items = await listOrgUnits(db, { includeInactive: query.includeInactive === "true" });
  return c.json({ items });
});

const createBody = z
  .object({
    name: z.string().trim().min(1).max(150),
    // Slugs appear in paths and are compared, so they are constrained to what is unambiguous.
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, digits and single hyphens only"),
    type: z.enum(["organization", "bph", "department", "bureau", "division"]),
    parentId: z.uuid().nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

orgUnitRoutes.post("/", requirePermission("orgunit:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const body = await parseJson(c, createBody);
  try {
    const unit = await createOrgUnit(db, { actor, input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("settings", "org_unit", unit.id, "created"));
    return c.json({ unit }, 201);
  } catch (error) {
    return orgUnitFailure(error);
  }
});

const updateBody = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, digits and single hyphens only")
      .optional(),
    type: z.enum(["organization", "bph", "department", "bureau", "division"]).optional(),
    parentId: z.uuid().nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to change." });

orgUnitRoutes.patch("/:id", requirePermission("orgunit:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const body = await parseJson(c, updateBody);
  try {
    const unit = await updateOrgUnit(db, { actor, id: c.req.param("id"), input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("settings", "org_unit", unit.id, "updated"));
    return c.json({ unit });
  } catch (error) {
    return orgUnitFailure(error);
  }
});

orgUnitRoutes.post("/:id/deactivate", requirePermission("orgunit:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  try {
    const unit = await deactivateOrgUnit(db, { actor, id: c.req.param("id"), request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("settings", "org_unit", unit.id, "deactivated"));
    return c.json({ unit });
  } catch (error) {
    return orgUnitFailure(error);
  }
});
