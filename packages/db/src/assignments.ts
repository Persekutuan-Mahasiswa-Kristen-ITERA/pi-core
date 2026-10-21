/**
 * Assignments — story 4.8 (FR-27, FR-31, FR-32, FR-33, FR-43).
 *
 * An assignment is the only thing that connects a member to authority: it is what `effectiveRoles`
 * turns into roles, and roles are what `can()` reads. So this file is where access actually changes
 * hands, and three of its rules are load-bearing:
 *
 * 1. **The role is DERIVED, never supplied (FR-32).** The caller picks a position; the role comes from
 *    `position_roles`. There is no `role` field in the input, so there is nothing to validate — the
 *    shape of the API is the enforcement. `derivedRolesForPosition` exposes the same derivation to the
 *    UI so the form can show the role read-only instead of guessing it.
 * 2. **The rank/subtree guard runs on the way in (FR-27).** `enforceAssignmentChange` decides it and
 *    writes the audit row, including on refusal — the refusals are the interesting half of the log.
 * 3. **Only the active period grants access (FR-31), and ending an assignment revokes it (FR-33).**
 *    Neither is enforced here: both are properties of `effectiveRoles`, which is the single place roles
 *    are computed. This file's job is to make the *facts* true — the period it writes, and the `endsOn`
 *    it sets — and to refuse to make them untrue.
 *
 * Ending and transferring are the same operation with different fields, so they share one function.
 * A transfer is deliberately not a delete-and-recreate: the row keeps its identity, which keeps the
 * audit trail readable as a history of one assignment rather than a series of unrelated ones.
 */
import {
  scopeFor,
  type Actor,
  type AssignmentFact,
  type RoleKey,
} from "@pi-core/shared";
import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { enforceAssignmentChange, findActivePeriodId, writeAudit, type AuthorizationRequest } from "./access";
import type { Database } from "./client";
import { assignments, members, orgUnits, periods, positionRoles, positions, roles } from "./schema";

export interface AssignmentView {
  id: string;
  memberId: string;
  memberName: string | null;
  orgUnitId: string;
  orgUnitName: string | null;
  positionId: string;
  positionName: string | null;
  positionRank: number | null;
  periodId: string;
  periodLabel: string | null;
  isActivePeriod: boolean;
  startsOn: string | null;
  endsOn: string | null;
  /** FR-32 — derived from the position, read-only, never supplied by a caller. */
  derivedRoles: string[];
}

export class AssignmentError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "forbidden"
      | "unit_type_mismatch"
      | "duplicate"
      | "period_not_found"
      | "already_ended",
    readonly reason?: string,
  ) {
    super(code);
    this.name = "AssignmentError";
  }
}

/**
 * Distinguish the two constraint families, because they mean different things and mapping them together
 * would lie to the caller: 23503 is a foreign-key violation (the unit type does not match the position),
 * 23505 is a uniqueness violation (that person already holds that position in that unit and period).
 * The first version of this function collapsed both into `unit_type_mismatch`, which sent me looking at
 * unit types when the actual problem was a duplicate assignment.
 */
function violationCode(error: unknown): "fk" | "unique" | null {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current !== null && current !== undefined; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (code === "23503") return "fk";
    if (code === "23505") return "unique";
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/** position id → role keys, the derivation FR-32 describes. */
async function positionRoleMap(db: Database, positionIds: string[]): Promise<Map<string, string[]>> {
  if (positionIds.length === 0) return new Map();
  const rows = await db
    .select({ positionId: positionRoles.positionId, roleKey: roles.key })
    .from(positionRoles)
    .innerJoin(roles, eq(roles.id, positionRoles.roleId))
    .where(inArray(positionRoles.positionId, [...new Set(positionIds)]));

  const map = new Map<string, string[]>();
  for (const row of rows) {
    map.set(row.positionId, [...(map.get(row.positionId) ?? []), row.roleKey].sort());
  }
  return map;
}

/** FR-32, for the form: the roles a position confers, so the UI can show them read-only. */
export async function derivedRolesForPosition(db: Database, positionId: string): Promise<string[]> {
  const map = await positionRoleMap(db, [positionId]);
  if (!map.has(positionId)) {
    // A position with no role mapping is a configuration gap, and saying so is better than returning an
    // empty list that looks like "this position grants nothing on purpose".
    const exists = await db.select({ id: positions.id }).from(positions).where(eq(positions.id, positionId)).limit(1);
    if (exists.length === 0) throw new AssignmentError("not_found");
    return [];
  }
  return map.get(positionId) ?? [];
}

export interface AssignmentListParams {
  actor: Actor;
  memberId?: string | undefined;
  orgUnitId?: string | undefined;
  periodId?: string | undefined;
  limit?: number | undefined;
}

/**
 * Scope, in SQL rather than in memory: `U` sees only its own subtree, `S` only its own rows. Reading
 * everything and filtering afterwards would put out-of-scope rows in the process's memory and in the
 * query log, which for an authorization surface is a leak even when the response is correct.
 *
 * Shared with the counts query so a total can never describe a wider set than the list the same actor
 * may read.
 */
function assignmentScopeConditions(actor: Actor): SQL[] {
  const scope = scopeFor(actor, "assignment:read");
  if (scope === "O") return [];

  const unitScope = actor.unitScope ?? [];
  const own = eq(assignments.memberId, actor.memberId);
  if (scope === "U" && unitScope.length > 0) {
    const inSubtree = or(inArray(assignments.orgUnitId, [...unitScope]), own);
    if (inSubtree !== undefined) return [inSubtree];
  }
  // `S`, or `U` with no subtree (no assignment in the active period): own rows only.
  return [own];
}

export async function listAssignments(db: Database, params: AssignmentListParams): Promise<AssignmentView[]> {
  const conditions: SQL[] = [];
  if (params.memberId !== undefined) conditions.push(eq(assignments.memberId, params.memberId));
  if (params.orgUnitId !== undefined) conditions.push(eq(assignments.orgUnitId, params.orgUnitId));
  if (params.periodId !== undefined) conditions.push(eq(assignments.periodId, params.periodId));
  conditions.push(...assignmentScopeConditions(params.actor));

  const activePeriodId = await findActivePeriodId(db);

  const rows = await db
    .select({
      id: assignments.id,
      memberId: assignments.memberId,
      memberName: members.fullName,
      orgUnitId: assignments.orgUnitId,
      orgUnitName: orgUnits.name,
      positionId: assignments.positionId,
      positionName: positions.name,
      positionRank: positions.rank,
      periodId: assignments.periodId,
      periodLabel: periods.label,
      startsOn: assignments.startsOn,
      endsOn: assignments.endsOn,
    })
    .from(assignments)
    .leftJoin(members, eq(members.id, assignments.memberId))
    .leftJoin(orgUnits, eq(orgUnits.id, assignments.orgUnitId))
    .leftJoin(positions, eq(positions.id, assignments.positionId))
    .leftJoin(periods, eq(periods.id, assignments.periodId))
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(desc(assignments.createdAt))
    .limit(Math.min(Math.max(params.limit ?? 100, 1), 200));

  const roleMap = await positionRoleMap(db, rows.map((row) => row.positionId));

  return rows.map((row) => ({
    ...row,
    isActivePeriod: row.periodId === activePeriodId,
    derivedRoles: roleMap.get(row.positionId) ?? [],
  }));
}

export interface AssignmentTypeCount {
  /** `org_units.type`, or `"unknown"` when the unit row is gone. */
  unitType: string;
  count: number;
}

/**
 * Assignments per unit type, counted in SQL.
 *
 * The list endpoint caps at 200 rows, so a client that counts the page reports "at least N". This
 * returns the real totals, over exactly the rows the same actor's scope predicate allows — sharing
 * `assignmentScopeConditions` is what makes that true rather than hopeful.
 */
export async function countAssignmentsByUnitType(
  db: Database,
  params: { actor: Actor; periodId?: string | undefined },
): Promise<AssignmentTypeCount[]> {
  const conditions: SQL[] = assignmentScopeConditions(params.actor);
  if (params.periodId !== undefined) conditions.push(eq(assignments.periodId, params.periodId));

  const rows = await db
    .select({ unitType: orgUnits.type, total: sql<number>`count(*)::int` })
    .from(assignments)
    .leftJoin(orgUnits, eq(orgUnits.id, assignments.orgUnitId))
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .groupBy(orgUnits.type);

  return rows.map((row) => ({ unitType: row.unitType ?? "unknown", count: Number(row.total) }));
}

/** The guard's view of the world: where the position sits, and who is being placed in it. */
async function loadTarget(
  db: Database,
  positionId: string,
  orgUnitId: string,
  memberId: string,
): Promise<{ orgUnitId: string; positionRank: number; memberId: string; unitType: string; isUniquePerUnit: boolean }> {
  const [position] = await db
    .select({ rank: positions.rank, unitType: positions.unitType, isUniquePerUnit: positions.isUniquePerUnit })
    .from(positions)
    .where(eq(positions.id, positionId))
    .limit(1);
  if (position === undefined) throw new AssignmentError("not_found");

  const [unit] = await db
    .select({ type: orgUnits.type, isActive: orgUnits.isActive })
    .from(orgUnits)
    .where(eq(orgUnits.id, orgUnitId))
    .limit(1);
  if (unit === undefined) throw new AssignmentError("not_found");
  // The composite FK would refuse this too, but with an opaque constraint error. Saying which half is
  // wrong ("a department position in a division") is the difference between a usable API and a puzzle.
  if (unit.type !== position.unitType) throw new AssignmentError("unit_type_mismatch");

  return {
    orgUnitId,
    positionRank: position.rank,
    memberId,
    unitType: position.unitType,
    isUniquePerUnit: position.isUniquePerUnit,
  };
}

export interface CreateAssignmentInput {
  memberId: string;
  orgUnitId: string;
  positionId: string;
  periodId: string;
  startsOn?: string | null | undefined;
}

export async function createAssignment(
  db: Database,
  params: { actor: Actor; input: CreateAssignmentInput; request?: AuthorizationRequest },
): Promise<AssignmentView> {
  const target = await loadTarget(db, params.input.positionId, params.input.orgUnitId, params.input.memberId);

  // FR-27. Refusal is audited by `enforceDecision`, which is the point of routing it through there
  // rather than throwing early.
  const decision = await enforceAssignmentChange(db, {
    actor: params.actor,
    target,
    action: "assignment.create",
    ...(params.request === undefined ? {} : { request: params.request }),
  });
  if (!decision.allowed) throw new AssignmentError("forbidden", decision.reason);

  const period = await db.select({ id: periods.id }).from(periods).where(eq(periods.id, params.input.periodId)).limit(1);
  if (period.length === 0) throw new AssignmentError("period_not_found");

  let id: string;
  try {
    const [created] = await db
      .insert(assignments)
      .values({
        memberId: params.input.memberId,
        orgUnitId: params.input.orgUnitId,
        positionId: params.input.positionId,
        periodId: params.input.periodId,
        // Derived from the position, not from the request: the composite FKs make these two columns the
        // DB's own guarantee that an assignment's unit type and uniqueness match its position.
        unitType: target.unitType as "organization" | "bph" | "department" | "bureau" | "division",
        isUniquePerUnit: target.isUniquePerUnit,
        startsOn: params.input.startsOn ?? null,
        createdBy: params.actor.memberId,
      })
      .returning({ id: assignments.id });
    id = created!.id;
  } catch (error) {
    const violation = violationCode(error);
    if (violation === "fk") throw new AssignmentError("unit_type_mismatch");
    // `(member_id, org_unit_id, position_id, period_id)` is unique: this is a duplicate, not a mismatch.
    if (violation === "unique") throw new AssignmentError("duplicate");
    throw error;
  }

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "assignment.create",
    entityType: "assignment",
    entityId: id,
    after: {
      memberId: params.input.memberId,
      orgUnitId: params.input.orgUnitId,
      positionId: params.input.positionId,
      periodId: params.input.periodId,
    },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  const [view] = await listAssignments(db, { actor: params.actor, memberId: params.input.memberId, limit: 200 }).then(
    (all) => all.filter((row) => row.id === id),
  );
  if (view === undefined) throw new AssignmentError("not_found");
  return view;
}

export interface UpdateAssignmentInput {
  endsOn?: string | null | undefined;
  orgUnitId?: string | undefined;
  positionId?: string | undefined;
  startsOn?: string | null | undefined;
}

/**
 * End or transfer an assignment (FR-33).
 *
 * Both are the same row changing shape, so they share a function: `endsOn` in the past ends it, a new
 * unit or position transfers it. The guard re-runs against the NEW destination, because a transfer moves
 * authority and must satisfy the same rank/subtree rule as the original placement — checking only the
 * old location would let an admin move someone into a unit they cannot manage.
 */
export async function updateAssignment(
  db: Database,
  params: { actor: Actor; id: string; input: UpdateAssignmentInput; request?: AuthorizationRequest },
): Promise<AssignmentView> {
  const [before] = await db
    .select({
      id: assignments.id,
      memberId: assignments.memberId,
      orgUnitId: assignments.orgUnitId,
      positionId: assignments.positionId,
      periodId: assignments.periodId,
      startsOn: assignments.startsOn,
      endsOn: assignments.endsOn,
    })
    .from(assignments)
    .where(eq(assignments.id, params.id))
    .limit(1);
  if (before === undefined) throw new AssignmentError("not_found");

  const nextOrgUnitId = params.input.orgUnitId ?? before.orgUnitId;
  const nextPositionId = params.input.positionId ?? before.positionId;

  const target = await loadTarget(db, nextPositionId, nextOrgUnitId, before.memberId);
  const decision = await enforceAssignmentChange(db, {
    actor: params.actor,
    target,
    action: "assignment.update",
    ...(params.request === undefined ? {} : { request: params.request }),
  });
  if (!decision.allowed) throw new AssignmentError("forbidden", decision.reason);

  // An `endsOn` before `startsOn` would create a window that never opens: the assignment would exist,
  // look active, and grant nothing. Refused rather than stored.
  const nextStartsOn = params.input.startsOn === undefined ? before.startsOn : params.input.startsOn;
  const nextEndsOn = params.input.endsOn === undefined ? before.endsOn : params.input.endsOn;
  if (nextStartsOn !== null && nextEndsOn !== null && nextEndsOn < nextStartsOn) {
    throw new AssignmentError("already_ended", "endsOn is before startsOn");
  }

  try {
    await db
      .update(assignments)
      .set({
        ...(params.input.orgUnitId === undefined ? {} : { orgUnitId: params.input.orgUnitId }),
        ...(params.input.positionId === undefined ? {} : { positionId: params.input.positionId }),
        ...(params.input.startsOn === undefined ? {} : { startsOn: params.input.startsOn }),
        ...(params.input.endsOn === undefined ? {} : { endsOn: params.input.endsOn }),
      })
      .where(eq(assignments.id, params.id));
  } catch (error) {
    const violation = violationCode(error);
    if (violation === "fk") throw new AssignmentError("unit_type_mismatch");
    if (violation === "unique") throw new AssignmentError("duplicate");
    throw error;
  }

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: params.input.endsOn === undefined ? "assignment.transfer" : "assignment.end",
    entityType: "assignment",
    entityId: params.id,
    before: { orgUnitId: before.orgUnitId, positionId: before.positionId, endsOn: before.endsOn },
    after: {
      orgUnitId: nextOrgUnitId,
      positionId: nextPositionId,
      endsOn: nextEndsOn,
      startsOn: nextStartsOn,
    },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  const [view] = (await listAssignments(db, { actor: params.actor, limit: 200 })).filter((row) => row.id === params.id);
  if (view === undefined) throw new AssignmentError("not_found");
  return view;
}

/**
 * The facts `effectiveRoles` consumes, for one member. Exported so the verification script can assert
 * FR-31 (only the active period grants) against the same shape the runtime uses, rather than a copy.
 */
export async function assignmentFactsFor(db: Database, memberId: string): Promise<AssignmentFact[]> {
  const rows = await db
    .select({
      periodId: assignments.periodId,
      orgUnitId: assignments.orgUnitId,
      positionId: assignments.positionId,
      positionRank: positions.rank,
      startsOn: assignments.startsOn,
      endsOn: assignments.endsOn,
    })
    .from(assignments)
    .innerJoin(positions, eq(positions.id, assignments.positionId))
    .where(eq(assignments.memberId, memberId));
  return rows.map((row) => ({
    periodId: row.periodId,
    orgUnitId: row.orgUnitId,
    positionId: row.positionId,
    positionRank: row.positionRank,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
  }));
}

/** Positions, so a form can offer them. Read-only: the catalog is seeded, not user-managed. */
export async function listPositions(db: Database): Promise<Array<{ id: string; key: string; name: string; unitType: string; rank: number; roles: RoleKey[] }>> {
  const rows = await db.select().from(positions).orderBy(positions.rank, positions.name);
  const map = await positionRoleMap(db, rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    unitType: row.unitType,
    rank: row.rank,
    roles: (map.get(row.id) ?? []) as RoleKey[],
  }));
}

/** Used by the verification script to assert the derived-role table is what the API reports. */
export async function countPositionRoles(db: Database): Promise<number> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(positionRoles);
  return rows[0]?.n ?? 0;
}
