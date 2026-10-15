/**
 * Effective roles derivation — FR-31.
 *
 * > Effective roles = union of `position_roles` for active-period assignments + explicit system
 * > grants + implicit `anggota`. Only active-period assignments grant access; past/future periods
 * > do not.
 *
 * Pure, so the rule is testable without a database. Gathering the input (the member's assignments,
 * the active period, the position→role mapping) is the caller's job — see `@pi-core/db`'s
 * `loadActor`, which feeds the result straight into `can()`.
 */
import type { RoleKey } from "./matrix";

/** One assignment row, reduced to what role derivation needs. */
export interface AssignmentFact {
  periodId: string;
  orgUnitId: string;
  positionId: string;
  /** Position rank; lower is more senior. Used later by `can()`'s `U*` guard. */
  positionRank: number;
  /** ISO date (`YYYY-MM-DD`) or null. Only consulted when `asOf` is given. */
  startsOn?: string | null;
  /** ISO date, or null/absent for "still open". Only consulted when `asOf` is given. */
  endsOn?: string | null;
}

export interface EffectiveRolesInput {
  memberId: string;
  /** The single active period, or `null` when no period is active. */
  activePeriodId: string | null;
  /** **All** of the member's assignments, in every period — filtering happens here. */
  assignments: readonly AssignmentFact[];
  /** position id → the role keys that position confers (`position_roles`). */
  positionRoles: ReadonlyMap<string, readonly RoleKey[]>;
  /** Explicit grants from `system_grants` (in practice `super_admin`). */
  systemGrants?: readonly RoleKey[];
  /**
   * ISO date to evaluate assignment windows against. FR-31 only mentions periods, but FR-33 lets an
   * assignment be **ended** (or scheduled to start later), which must add/remove access — so pass
   * today's date and ended assignments stop granting. Omit to reason about periods alone.
   */
  asOf?: string;
}

/**
 * An assignment is current on `asOf` when it has started and has not ended. ISO `YYYY-MM-DD`
 * strings compare correctly with `<`/`>`.
 */
function isCurrent(assignment: AssignmentFact, asOf: string | undefined): boolean {
  if (asOf === undefined) return true;
  if (assignment.startsOn != null && assignment.startsOn > asOf) return false;
  if (assignment.endsOn != null && assignment.endsOn < asOf) return false;
  return true;
}

export interface EffectiveRolesResult {
  /** Sorted, de-duplicated; always contains `anggota`. */
  roles: RoleKey[];
  /** Assignments that actually conferred roles (active period only). */
  activeAssignments: AssignmentFact[];
  /** Assignments skipped because they belong to another period. */
  ignoredAssignments: AssignmentFact[];
  /** Position ids with no `position_roles` row — a data problem worth surfacing, not silently 0. */
  unknownPositions: string[];
}

/**
 * Compute a member's effective roles.
 *
 * `anggota` is the implicit baseline and is always present: holding a member record *is* being a
 * member. Everything else must be earned in the active period.
 */
export function effectiveRoles(input: EffectiveRolesInput): EffectiveRolesResult {
  const roles = new Set<RoleKey>(["anggota"]);
  const activeAssignments: AssignmentFact[] = [];
  const ignoredAssignments: AssignmentFact[] = [];
  const unknownPositions = new Set<string>();

  for (const assignment of input.assignments) {
    if (input.activePeriodId === null || assignment.periodId !== input.activePeriodId) {
      ignoredAssignments.push(assignment);
      continue;
    }

    if (!isCurrent(assignment, input.asOf)) {
      ignoredAssignments.push(assignment);
      continue;
    }

    const granted = input.positionRoles.get(assignment.positionId);
    if (granted === undefined) {
      unknownPositions.add(assignment.positionId);
      continue;
    }

    activeAssignments.push(assignment);
    for (const role of granted) roles.add(role);
  }

  for (const role of input.systemGrants ?? []) roles.add(role);

  return {
    roles: [...roles].sort(),
    activeAssignments,
    ignoredAssignments,
    unknownPositions: [...unknownPositions].sort(),
  };
}
