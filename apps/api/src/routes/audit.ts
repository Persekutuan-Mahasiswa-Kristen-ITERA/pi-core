/**
 * Audit log — story 4.10 (FR-44, FR-13).
 *
 * `audit:read` guards the routes; the *scope* check (must be `O`) lives in `packages/db/src/audit-log.ts`,
 * because holding a permission and being allowed to see this particular data are different questions, and
 * the log has no unit relation to narrow a `U`-scoped holder by.
 */
import { AuditError, listAuditActions, listAuditEntries, listAuditEntityTypes } from "@pi-core/db";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { forbidden, notFound } from "../http/errors";
import { parseQuery } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";

export const auditRoutes = new Hono<AppEnv>();

auditRoutes.use("*", sessionMiddleware);

function auditFailure(error: unknown): never {
  if (error instanceof AuditError) {
    throw forbidden(
      "The audit log is org-wide; your access is limited to a unit subtree, which it cannot be filtered by.",
    );
  }
  throw error;
}

// Declared before any `/:id`-shaped route so the path cannot be swallowed as an id.
auditRoutes.get("/actions", requirePermission("audit:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  return c.json({ items: await listAuditActions(db) });
});

const listQuery = z
  .object({
    action: z.string().trim().min(1).max(120).optional(),
    entityType: z.string().trim().min(1).max(60).optional(),
    entityId: z.string().trim().min(1).max(120).optional(),
    actorMemberId: z.uuid().optional(),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    cursor: z.string().trim().min(1).max(400).optional(),
  })
  .strict();

auditRoutes.get("/entity-types", requirePermission("audit:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  return c.json({ items: await listAuditEntityTypes(db) });
});

auditRoutes.get("/", requirePermission("audit:read"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const query = parseQuery(c, listQuery);
  try {
    const page = await listAuditEntries(db, { actor, ...query });
    return c.json(page);
  } catch (error) {
    return auditFailure(error);
  }
});
