/**
 * Roles — story 4.7 (FR-22, FR-23, FR-24).
 *
 * Reads need `role:read`, writes need `role:manage`. The rules that matter — system roles are read-only,
 * custom roles come from the fixed catalog, scope is not caller-supplied — live in `packages/db/src/roles.ts`,
 * so they hold for every caller and not just this route.
 *
 * `/permissions` is declared BEFORE `/:id` on purpose: Hono matches in registration order, so the reverse
 * would make the catalog unreachable by being swallowed as a role id.
 */
import { createRole, getRole, listRoles, permissionCatalog, RoleError, updateRole } from "@pi-core/db";
import { createRealtimeEvent } from "@pi-core/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { conflict, forbidden, notFound } from "../http/errors";
import { parseJson } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";
import { publishRealtimeEvent } from "../realtime/publisher";

export const roleRoutes = new Hono<AppEnv>();

roleRoutes.use("*", sessionMiddleware);

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

function roleFailure(error: unknown): never {
  if (error instanceof RoleError) {
    if (error.code === "not_found") throw notFound("Role not found.");
    if (error.code === "system_role_read_only") {
      throw forbidden("System roles are read-only. Create a custom role instead.");
    }
    if (error.code === "unknown_permission") {
      throw conflict("One of those permissions is not in the catalog.");
    }
    if (error.code === "duplicate_key") throw conflict("A role with that key already exists.");
    throw conflict("A custom role key must be lowercase letters, digits and hyphens.");
  }
  throw error;
}

roleRoutes.get("/", requirePermission("role:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  return c.json({ items: await listRoles(db) });
});

roleRoutes.get("/permissions", requirePermission("role:read"), (c) => {
  return c.json({ items: permissionCatalog() });
});

roleRoutes.get("/:id", requirePermission("role:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  try {
    return c.json({ role: await getRole(db, c.req.param("id")) });
  } catch (error) {
    return roleFailure(error);
  }
});

const createBody = z
  .object({
    key: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(400).nullable().optional(),
    permissions: z.array(z.string().trim().min(1).max(80)).max(200),
  })
  .strict();

roleRoutes.post("/", requirePermission("role:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const body = await parseJson(c, createBody);
  try {
    const role = await createRole(db, { actor, input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("roles", "role", role.id, "created"));
    return c.json({ role }, 201);
  } catch (error) {
    return roleFailure(error);
  }
});

const updateBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(400).nullable().optional(),
    permissions: z.array(z.string().trim().min(1).max(80)).max(200).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to change." });

roleRoutes.patch("/:id", requirePermission("role:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const body = await parseJson(c, updateBody);
  try {
    const role = await updateRole(db, { actor, id: c.req.param("id"), input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("roles", "role", role.id, "updated"));
    return c.json({ role });
  } catch (error) {
    return roleFailure(error);
  }
});
