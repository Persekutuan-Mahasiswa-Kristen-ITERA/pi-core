/**
 * Access resolution — the bridge between the database and the pure `can()` (FR-31, FR-43).
 *
 * `loadActor` reads the active period, the member's assignments, the position→role mapping and any
 * system grants, then hands them to `@pi-core/shared`'s `effectiveRoles` and returns a ready-to-use
 * `Actor` — including the two things `can()` needs beyond roles: the **unit subtree** the actor's
 * `U` scope covers, and the actor's **highest rank per subtree** for the §3 `U*` guard.
 *
 * `writeAudit` appends exactly one `audit_logs` row per mutation (FR-43); the table itself refuses
 * UPDATE/DELETE via the `audit_logs_append_only` trigger.
 */
import { effectiveRoles, redactForAudit, type Actor, type AssignmentFact, type RoleKey } from "@pi-core/shared";
import { eq, inArray, like, or } from "drizzle-orm";
import type { Database } from "./client";
import {
  assignments,
  auditLogs,
  orgUnits,
  periods,
  positionRoles,
  positions,
  roles,
  systemGrants,
} from "./schema";
import type { NewAuditLog } from "./schema";

export interface LoadedActor {
  /** Ready for `can(actor, permission, target)`. */
  actor: Actor;
  activePeriodId: string | null;
  /** Assignments that conferred roles (active period, and current on `asOf`). */
  activeAssignments: AssignmentFact[];
  /** Assignments skipped: other period, or outside their start/end window. */
  ignoredAssignments: AssignmentFact[];
  /** Position ids with no `position_roles` row — surfaced, never silently ignored. */
  unknownPositions: string[];
}

/** The single active period (FR-20 guarantees at most one), or `null`. */
export async function findActivePeriodId(db: Database): Promise<string | null> {
  const rows = await db
    .select({ id: periods.id })
    .from(periods)
    .where(eq(periods.isActive, true))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Resolve a member's effective access.
 *
 * Pass `asOf` (ISO `YYYY-MM-DD`) to also honour assignment windows — FR-33 lets an assignment be
 * ended or scheduled, and an ended assignment must stop granting.
 */
export async function loadActor(
  db: Database,
  memberId: string,
  asOf?: string,
): Promise<LoadedActor> {
  const activePeriodId = await findActivePeriodId(db);

  const assignmentRows = await db
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

  const roleRows = await db
    .select({ positionId: positionRoles.positionId, roleKey: roles.key })
    .from(positionRoles)
    .innerJoin(roles, eq(roles.id, positionRoles.roleId));

  const grantRows = await db
    .select({ roleKey: systemGrants.roleKey })
    .from(systemGrants)
    .where(eq(systemGrants.memberId, memberId));

  const positionRolesMap = new Map<string, RoleKey[]>();
  for (const row of roleRows) {
    const list = positionRolesMap.get(row.positionId) ?? [];
    list.push(row.roleKey as RoleKey);
    positionRolesMap.set(row.positionId, list);
  }

  const facts: AssignmentFact[] = assignmentRows.map((row) => ({
    periodId: row.periodId,
    orgUnitId: row.orgUnitId,
    positionId: row.positionId,
    positionRank: row.positionRank,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
  }));

  const derivation = effectiveRoles({
    memberId,
    activePeriodId,
    assignments: facts,
    positionRoles: positionRolesMap,
    systemGrants: grantRows.map((row) => row.roleKey as RoleKey),
    // `exactOptionalPropertyTypes`: only include `asOf` when the caller supplied one.
    ...(asOf === undefined ? {} : { asOf }),
  });

  const { unitScope, highestRankByUnit } = await resolveUnitScope(db, derivation.activeAssignments);

  return {
    actor: { memberId, roles: derivation.roles, unitScope, highestRankByUnit },
    activePeriodId,
    activeAssignments: derivation.activeAssignments,
    ignoredAssignments: derivation.ignoredAssignments,
    unknownPositions: derivation.unknownPositions,
  };
}

/**
 * The org units an actor's `U` scope covers — each active assignment's unit **and its
 * descendants** (`org_units.path` is the materialized path `/id/id/…/`) — plus the actor's own
 * highest rank per subtree, which is what `can()`'s `U*` guard compares against.
 */
async function resolveUnitScope(
  db: Database,
  activeAssignments: readonly AssignmentFact[],
): Promise<{ unitScope: string[]; highestRankByUnit: Record<string, number> }> {
  const rootIds = [...new Set(activeAssignments.map((a) => a.orgUnitId))];
  if (rootIds.length === 0) return { unitScope: [], highestRankByUnit: {} };

  const roots = await db
    .select({ path: orgUnits.path })
    .from(orgUnits)
    .where(inArray(orgUnits.id, rootIds));

  const prefixes = roots.map((r) => r.path).filter((p): p is string => p !== null);
  if (prefixes.length === 0) return { unitScope: [], highestRankByUnit: {} };

  const conditions = prefixes.map((prefix) => like(orgUnits.path, `${prefix}%`));
  const rows = await db
    .select({ id: orgUnits.id, path: orgUnits.path })
    .from(orgUnits)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions));

  const pathById = new Map(rows.map((row) => [row.id, row.path ?? ""]));

  const highestRankByUnit: Record<string, number> = {};
  for (const unit of rows) {
    const unitPath = unit.path ?? "";
    const ranks = activeAssignments
      .filter((a) => (pathById.get(a.orgUnitId) ?? "").startsWith(unitPath))
      .map((a) => a.positionRank);
    if (ranks.length > 0) highestRankByUnit[unit.id] = Math.min(...ranks);
  }

  return { unitScope: rows.map((row) => row.id), highestRankByUnit };
}

/**
 * Append one audit row (FR-43). Returns the new row id.
 *
 * `before`/`after` are passed through `redactForAudit`, so sensitive fields never reach the table
 * even if a caller hands over a whole entity.
 */
export async function writeAudit(db: Database, entry: NewAuditLog): Promise<string> {
  const rows = await db
    .insert(auditLogs)
    .values({
      ...entry,
      before: entry.before === undefined || entry.before === null ? entry.before : redactForAudit(entry.before),
      after: entry.after === undefined || entry.after === null ? entry.after : redactForAudit(entry.after),
    })
    .returning({ id: auditLogs.id });
  return rows[0]!.id;
}
