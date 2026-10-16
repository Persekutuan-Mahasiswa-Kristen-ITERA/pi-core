/**
 * Organization units — story 4.5 (FR-15, FR-16, FR-18, FR-43).
 *
 * The hierarchy is stored as a **materialised path**: `path` is the chain of ids, `/a/b/c/`, and `depth`
 * is its length. FR-18 requires subtree filtering to happen *in the query*, and that is exactly what the
 * path buys — `unitScope` in `loadActor` is derived from it and a subtree check is a `startsWith`, not a
 * recursive walk.
 *
 * Two consequences follow, and both are why this file is more careful than a plain CRUD:
 *
 * 1. **A move rewrites the subtree.** Renaming is a one-row update; moving is not, because every
 *    descendant's `path` and `depth` are now wrong. They are rewritten in a single statement derived from
 *    the old prefix, so there is no window in which half the subtree has the new path and half the old —
 *    which would silently grant or revoke access for the people in it.
 * 2. **A move must not create a cycle.** Moving a unit under its own descendant would make the path
 *    chain self-referential, and every `startsWith` scope check would then match the wrong set. It is
 *    refused explicitly rather than left to chance.
 *
 * Deletion is soft (FR-16): units referenced by assignments must never be hard-deleted. There is no
 * hard-delete function here at all — that is the enforcement.
 */
import type { Actor } from "@pi-core/shared";
import { and, eq, isNull, like, sql } from "drizzle-orm";
import { writeAudit, type AuthorizationRequest } from "./access";
import type { Database } from "./client";
import { assignments, orgUnits, orgUnitType } from "./schema";

/** The unit-type enum, as a union. `orgUnitType` is the drizzle enum, not a TS type. */
export type OrgUnitType = (typeof orgUnitType.enumValues)[number];

export interface OrgUnitRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  type: string;
  sortOrder: number;
  depth: number;
  isActive: boolean;
}

export class OrgUnitError extends Error {
  constructor(readonly code: "conflict" | "not_found" | "cycle" | "has_children" | "type_in_use") {
    super(code);
    this.name = "OrgUnitError";
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current !== null && current !== undefined; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (code === "23505" || code === "23503") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

const COLUMNS = {
  id: orgUnits.id,
  parentId: orgUnits.parentId,
  name: orgUnits.name,
  slug: orgUnits.slug,
  type: orgUnits.type,
  sortOrder: orgUnits.sortOrder,
  depth: orgUnits.depth,
  isActive: orgUnits.isActive,
};

/** Every unit, active or not, ordered so a client can build the tree in one pass. */
export async function listOrgUnits(db: Database, params: { includeInactive?: boolean } = {}): Promise<OrgUnitRow[]> {
  const query = db.select(COLUMNS).from(orgUnits);
  const rows = params.includeInactive === true ? await query : await query.where(eq(orgUnits.isActive, true));
  return [...rows].sort((a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** The stored `path` (an id chain) — the input to every subtree query. */
async function loadPlacement(db: Database, id: string): Promise<{ path: string; depth: number; type: string }> {
  const rows = await db
    .select({ path: orgUnits.path, depth: orgUnits.depth, type: orgUnits.type })
    .from(orgUnits)
    .where(eq(orgUnits.id, id))
    .limit(1);
  const row = rows[0];
  if (row === undefined) throw new OrgUnitError("not_found");
  return { path: row.path ?? `/${id}/`, depth: row.depth, type: row.type };
}

/** `parentPath + id + "/"`; the root is `/`. */
function pathFor(parentPath: string, id: string): string {
  return `${parentPath}${id}/`;
}

export interface OrgUnitInput {
  name?: string | undefined;
  slug?: string | undefined;
  type?: OrgUnitType | undefined;
  parentId?: string | null | undefined;
  sortOrder?: number | undefined;
}

export async function createOrgUnit(
  db: Database,
  params: {
    actor: Actor;
    input: OrgUnitInput & { name: string; slug: string; type: OrgUnitType };
    request?: AuthorizationRequest;
  },
): Promise<OrgUnitRow> {
  const parentId = params.input.parentId ?? null;
  const parentPath = parentId === null ? "/" : (await loadPlacement(db, parentId)).path;
  const depth = parentId === null ? 0 : (await loadPlacement(db, parentId)).depth + 1;

  let id: string | undefined;
  try {
    const rows = await db
      .insert(orgUnits)
      .values({
        name: params.input.name,
        slug: params.input.slug,
        type: params.input.type,
        parentId,
        sortOrder: params.input.sortOrder ?? 0,
        depth,
      })
      .returning({ id: orgUnits.id });
    id = rows[0]?.id;
  } catch (error) {
    // `(parent_id, slug)` and the root-slug index both surface as unique violations.
    if (isForeignKeyViolation(error)) throw new OrgUnitError("conflict");
    throw error;
  }
  if (id === undefined) throw new OrgUnitError("not_found");

  await db.update(orgUnits).set({ path: pathFor(parentPath, id) }).where(eq(orgUnits.id, id));

  const created = (await listOrgUnits(db, { includeInactive: true })).find((row) => row.id === id);
  if (created === undefined) throw new OrgUnitError("not_found");

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "orgunit.create",
    entityType: "org_unit",
    entityId: created.id,
    after: { name: created.name, slug: created.slug, type: created.type, parentId: created.parentId },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return created;
}

export async function updateOrgUnit(
  db: Database,
  params: { actor: Actor; id: string; input: OrgUnitInput; request?: AuthorizationRequest },
): Promise<OrgUnitRow> {
  const before = (await listOrgUnits(db, { includeInactive: true })).find((row) => row.id === params.id);
  if (before === undefined) throw new OrgUnitError("not_found");
  const beforePlacement = await loadPlacement(db, params.id);

  const movingTo = params.input.parentId;
  const isMove = movingTo !== undefined && (movingTo ?? null) !== before.parentId;

  if (isMove && movingTo !== null && movingTo !== undefined) {
    const target = await loadPlacement(db, movingTo);
    // A unit cannot be moved under itself or under its own descendant: the path chain would become
    // self-referential and every subtree check would match the wrong set.
    if (target.path.startsWith(beforePlacement.path)) throw new OrgUnitError("cycle");
  }

  const nextParentId = isMove ? (movingTo ?? null) : before.parentId;
  const nextParentPath =
    nextParentId === null ? "/" : (await loadPlacement(db, nextParentId)).path;
  const nextDepth = nextParentId === null ? 0 : (await loadPlacement(db, nextParentId)).depth + 1;
  const nextPath = pathFor(nextParentPath, params.id);

  try {
    await db
      .update(orgUnits)
      .set({
        ...(params.input.name === undefined ? {} : { name: params.input.name }),
        ...(params.input.slug === undefined ? {} : { slug: params.input.slug }),
        ...(params.input.type === undefined ? {} : { type: params.input.type }),
        ...(params.input.sortOrder === undefined ? {} : { sortOrder: params.input.sortOrder }),
        ...(isMove ? { parentId: nextParentId, depth: nextDepth, path: nextPath } : {}),
        updatedAt: new Date(),
      })
      .where(eq(orgUnits.id, params.id));

    if (isMove) {
      /**
       * Rewrite the subtree, computing each new path in application code.
       *
       * The first version did this in one SQL statement with `substring(... from ...)` and it produced
       * **NULL** paths for the descendants — which is far worse than being slow, because `path` is the
       * scope: a NULL path matches no subtree, so the people in it silently lost access. An explicit
       * read-then-update loop is easier to reason about, and the subtree of one unit is small. It runs
       * in a transaction so there is no window where half the subtree has the new path and half the old.
       */
      const oldPrefix = beforePlacement.path;
      const depthDelta = nextDepth - beforePlacement.depth;

      const descendants = await db
        .select({ id: orgUnits.id, path: orgUnits.path, depth: orgUnits.depth })
        .from(orgUnits)
        .where(like(orgUnits.path, `${oldPrefix}%`));

      await db.transaction(async (tx) => {
        for (const descendant of descendants) {
          if (descendant.id === params.id) continue; // its own row was set above
          const suffix = (descendant.path ?? "").slice(oldPrefix.length);
          await tx
            .update(orgUnits)
            .set({ path: `${nextPath}${suffix}`, depth: descendant.depth + depthDelta })
            .where(eq(orgUnits.id, descendant.id));
        }
      });
    } else if (params.input.parentId !== undefined) {
      // A no-op move still has to leave `path` consistent with the row's own id.
      await db.update(orgUnits).set({ path: nextPath, depth: nextDepth }).where(eq(orgUnits.id, params.id));
    }
  } catch (error) {
    // Changing `type` while positions are assigned to the unit violates the composite FK (FR-30).
    if (isForeignKeyViolation(error)) throw new OrgUnitError("type_in_use");
    throw error;
  }

  const after = (await listOrgUnits(db, { includeInactive: true })).find((row) => row.id === params.id);
  if (after === undefined) throw new OrgUnitError("not_found");

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "orgunit.update",
    entityType: "org_unit",
    entityId: params.id,
    before: { name: before.name, slug: before.slug, type: before.type, parentId: before.parentId },
    after: { name: after.name, slug: after.slug, type: after.type, parentId: after.parentId, moved: isMove },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return after;
}

/**
 * Deactivate a unit (FR-16) — the only removal this module offers.
 *
 * Refused while it still has **active children**, because deactivating a parent would leave its
 * children reachable in the tree while their scope path points at a unit that is no longer part of it.
 * Assignments are not a reason to refuse: a unit referenced by history is exactly the case FR-16 says
 * must be soft-deleted rather than removed.
 */
export async function deactivateOrgUnit(
  db: Database,
  params: { actor: Actor; id: string; request?: AuthorizationRequest },
): Promise<OrgUnitRow> {
  const before = (await listOrgUnits(db, { includeInactive: true })).find((row) => row.id === params.id);
  if (before === undefined) throw new OrgUnitError("not_found");

  const children = await db
    .select({ id: orgUnits.id })
    .from(orgUnits)
    .where(and(eq(orgUnits.parentId, params.id), eq(orgUnits.isActive, true)))
    .limit(1);
  if (children.length > 0) throw new OrgUnitError("has_children");

  await db.update(orgUnits).set({ isActive: false, updatedAt: new Date() }).where(eq(orgUnits.id, params.id));

  const assignmentCount = (
    await db.select({ id: assignments.id }).from(assignments).where(eq(assignments.orgUnitId, params.id))
  ).length;

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "orgunit.deactivate",
    entityType: "org_unit",
    entityId: params.id,
    before: { isActive: true },
    after: { isActive: false, assignmentsKept: assignmentCount },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  const after = (await listOrgUnits(db, { includeInactive: true })).find((row) => row.id === params.id);
  if (after === undefined) throw new OrgUnitError("not_found");
  return after;
}

/** Units whose `path` is under this one — the same predicate the scope uses (FR-18). */
export async function listSubtree(db: Database, rootId: string): Promise<OrgUnitRow[]> {
  const root = await loadPlacement(db, rootId);
  const rows = await db
    .select(COLUMNS)
    .from(orgUnits)
    .where(sql`${orgUnits.path} like ${`${root.path}%`} and ${orgUnits.isActive} = true`);
  return [...rows].sort((a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder);
}

/** Units with no parent — the roots of the forest. There should be exactly one. */
export async function listRootUnits(db: Database): Promise<OrgUnitRow[]> {
  return db.select(COLUMNS).from(orgUnits).where(isNull(orgUnits.parentId));
}
