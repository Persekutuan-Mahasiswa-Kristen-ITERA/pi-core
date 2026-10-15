/**
 * Mutation guards — the rules that are about an *action*, not just a permission (FR-27, FR-28).
 *
 * `can()` answers "may this actor exercise this permission on this target". Two further rules do
 * not fit that shape and live here, each returning a **machine-readable denial reason** so a
 * refusal can be audited and shown to the user:
 *
 *  - **FR-27, self-edit:** *no* user may create/modify their own assignments, whatever their scope.
 *    `can()` cannot express this — it never sees who owns the target assignment — so the guard does
 *    it first and unconditionally. This is separation of duties, not a permission.
 *  - **FR-28, last `super_admin`:** the final `super_admin` grant cannot be removed.
 *
 * Like `can()`, these are pure: no I/O, no clock, no globals.
 */
import { can, scopeFor, type Actor, type Target } from "./can";
import type { PermissionMatrix, RoleKey } from "./matrix";

export type DenialReason =
  | "permission_not_granted"
  | "target_outside_scope"
  | "rank_not_junior"
  | "self_edit_forbidden"
  | "last_super_admin";

export type Decision = { allowed: true } | { allowed: false; reason: DenialReason };

/** Default messages for API error bodies and audit rows. */
export const DENIAL_MESSAGES: Readonly<Record<DenialReason, string>> = {
  permission_not_granted: "You do not have permission to do this.",
  target_outside_scope: "That unit is outside the part of the organization you manage.",
  rank_not_junior: "You can only manage positions more junior than your own.",
  self_edit_forbidden: "You cannot change your own assignments.",
  last_super_admin: "The last super admin cannot be removed.",
};

/** What an assignment change is aimed at. */
export interface AssignmentChangeTarget {
  /** The unit the assignment sits in — decides `U` scope. */
  orgUnitId: string;
  /** The position's rank; lower is more senior. */
  positionRank: number;
  /** The member the assignment belongs to — decides the self-edit rule. */
  memberId: string;
}

/**
 * May `actor` create/modify/end this assignment?
 *
 * Checks, in order: the absolute self-edit rule (FR-27), the permission itself, then — for a
 * `U`-scoped holder — the subtree and the §3 `U*` rank guard. An `O`-scoped holder
 * (`super_admin`, `organization_admin`) is not rank-limited; by owner decision (2026-10-15) that
 * is intended, because every Kepala Departemen/Biro is an organization admin.
 */
export function decideAssignmentChange(
  actor: Actor,
  target: AssignmentChangeTarget,
  matrix: PermissionMatrix | undefined = undefined,
): Decision {
  // FR-27: nobody edits their own assignments — not even super_admin, not even in their own unit.
  if (target.memberId === actor.memberId) {
    return { allowed: false, reason: "self_edit_forbidden" };
  }

  const scope = scopeFor(actor, "assignment:manage", matrix);
  if (scope === undefined || scope === "S") {
    return { allowed: false, reason: "permission_not_granted" };
  }
  if (scope === "O") return { allowed: true };

  // scope === "U"
  if (!actor.unitScope?.includes(target.orgUnitId)) {
    return { allowed: false, reason: "target_outside_scope" };
  }

  const ownRank = actor.highestRankByUnit?.[target.orgUnitId];
  if (ownRank === undefined || !(target.positionRank > ownRank)) {
    return { allowed: false, reason: "rank_not_junior" };
  }

  return { allowed: true };
}

/**
 * May this `system_grants` row be removed? (FR-28)
 *
 * `superAdminsRemaining` is how many members would **still** hold `super_admin` once this removal
 * is applied — the caller counts it inside the same transaction, so two concurrent removals cannot
 * both pass.
 */
export function decideRevokeSystemGrant(input: {
  roleKey: RoleKey;
  superAdminsRemaining: number;
}): Decision {
  if (input.roleKey === "super_admin" && input.superAdminsRemaining <= 0) {
    return { allowed: false, reason: "last_super_admin" };
  }
  return { allowed: true };
}

/**
 * Cross-check helper used by the tests: `decideAssignmentChange` must agree with `can()` on every
 * case that `can()` can express (i.e. everything except the self-edit rule, which `can()` has no
 * way to see).
 */
export function canChangeAssignment(
  actor: Actor,
  target: AssignmentChangeTarget,
  matrix: PermissionMatrix | undefined = undefined,
): boolean {
  const assignmentTarget: Target = {
    kind: "assignment",
    orgUnitId: target.orgUnitId,
    positionRank: target.positionRank,
  };
  return matrix === undefined
    ? can(actor, "assignment:manage", assignmentTarget)
    : can(actor, "assignment:manage", assignmentTarget, matrix);
}
