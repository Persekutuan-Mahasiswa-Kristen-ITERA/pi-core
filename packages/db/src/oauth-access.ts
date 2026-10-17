import { and, eq, inArray } from "drizzle-orm";
import { loadActor, type LoadedActor } from "./access";
import type { Database } from "./client";
import {
  assignments,
  jwks,
  members,
  orgUnits,
  periods,
  permissions,
  positionRoles,
  positions,
  rolePermissions,
  roles,
} from "./schema";

export interface PublicJwkKey {
  kid: string;
  alg: string;
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  e?: string;
  n?: string;
}

/**
 * Load public keys directly from the database for token signature verification.
 * Avoids loopback HTTP subrequests on Cloudflare Workers where self-fetches on *.workers.dev fail.
 */
export async function loadJwks(
  db: Database,
): Promise<{ keys: PublicJwkKey[] }> {
  const rows = await db
    .select({ id: jwks.id, publicKey: jwks.publicKey })
    .from(jwks);
  return {
    keys: rows.map((row) => ({
      ...(JSON.parse(row.publicKey) as Record<string, unknown>),
      kid: row.id,
      alg: "EdDSA",
    })) as PublicJwkKey[],
  };
}

export interface AccessSnapshot {
  member: { id: string; email: string; name: string };
  activePeriod: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
  } | null;
  assignments: Array<{
    id: string;
    unit: { id: string; name: string; type: string; path: string | null };
    position: { id: string; key: string; name: string; rank: number };
    roles: string[];
    startsOn: string | null;
    endsOn: string | null;
  }>;
  roles: string[];
  permissions: string[];
  loadedActor: LoadedActor;
}

/**
 * Resolve the authorization snapshot from current database state.
 *
 * OAuth claims identify the subject only. Roles, permissions, period and assignments are always
 * recomputed here so a consumer cannot grant access from stale or client-supplied claims.
 */
export async function loadAccessSnapshot(
  db: Database,
  memberId: string,
): Promise<AccessSnapshot | null> {
  const memberRows = await db
    .select({
      id: members.id,
      email: members.email,
      name: members.fullName,
      status: members.status,
    })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  const member = memberRows[0];
  if (member === undefined || member.status !== "active") return null;

  const loadedActor = await loadActor(db, memberId);
  const activePeriod = loadedActor.activePeriodId
    ? ((
        await db
          .select({
            id: periods.id,
            label: periods.label,
            startDate: periods.startDate,
            endDate: periods.endDate,
          })
          .from(periods)
          .where(eq(periods.id, loadedActor.activePeriodId))
          .limit(1)
      )[0] ?? null)
    : null;

  const assignmentIds = loadedActor.activeAssignments.map(
    (assignment) => assignment.positionId,
  );
  const activeAssignmentKeys = new Set(
    loadedActor.activeAssignments.map(
      (assignment) =>
        `${assignment.orgUnitId}:${assignment.positionId}:${assignment.periodId}`,
    ),
  );
  const assignmentRows =
    loadedActor.activeAssignments.length === 0
      ? []
      : (
          await db
            .select({
              id: assignments.id,
              orgUnitId: assignments.orgUnitId,
              unitName: orgUnits.name,
              unitType: orgUnits.type,
              unitPath: orgUnits.path,
              positionId: positions.id,
              positionKey: positions.key,
              positionName: positions.name,
              positionRank: positions.rank,
              periodId: assignments.periodId,
              startsOn: assignments.startsOn,
              endsOn: assignments.endsOn,
            })
            .from(assignments)
            .innerJoin(orgUnits, eq(orgUnits.id, assignments.orgUnitId))
            .innerJoin(positions, eq(positions.id, assignments.positionId))
            .where(
              and(
                eq(assignments.memberId, memberId),
                eq(assignments.periodId, loadedActor.activePeriodId!),
                inArray(assignments.positionId, assignmentIds),
              ),
            )
        ).filter((row) =>
          activeAssignmentKeys.has(
            `${row.orgUnitId}:${row.positionId}:${row.periodId}`,
          ),
        );

  const roleRows =
    assignmentRows.length === 0
      ? []
      : await db
          .select({ positionId: positionRoles.positionId, roleKey: roles.key })
          .from(positionRoles)
          .innerJoin(roles, eq(roles.id, positionRoles.roleId))
          .where(inArray(positionRoles.positionId, assignmentIds));
  const rolesByPosition = new Map<string, string[]>();
  for (const row of roleRows)
    rolesByPosition.set(row.positionId, [
      ...(rolesByPosition.get(row.positionId) ?? []),
      row.roleKey,
    ]);

  const assignmentsView = assignmentRows.map((row) => ({
    id: row.id,
    unit: {
      id: row.orgUnitId,
      name: row.unitName,
      type: row.unitType,
      path: row.unitPath,
    },
    position: {
      id: row.positionId,
      key: row.positionKey,
      name: row.positionName,
      rank: row.positionRank,
    },
    roles: rolesByPosition.get(row.positionId) ?? [],
    startsOn: row.startsOn,
    endsOn: row.endsOn,
  }));
  const rolesSet = new Set<string>(loadedActor.actor.roles);
  const permissions = await resolvePermissionKeys(db, loadedActor.actor.roles);

  return {
    member: { id: member.id, email: member.email, name: member.name },
    activePeriod: activePeriod
      ? {
          id: activePeriod.id,
          label: activePeriod.label,
          startDate: activePeriod.startDate,
          endDate: activePeriod.endDate,
        }
      : null,
    assignments: assignmentsView,
    roles: [...rolesSet].sort(),
    permissions,
    loadedActor,
  };
}

async function resolvePermissionKeys(
  db: Database,
  roleKeys: readonly string[],
): Promise<string[]> {
  if (roleKeys.length === 0) return [];
  const rows = await db
    .select({ permissionKey: permissions.key })
    .from(rolePermissions)
    .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(permissions.key, rolePermissions.permissionKey))
    .where(inArray(roles.key, roleKeys));
  return [...new Set(rows.map((row) => row.permissionKey))].sort();
}
