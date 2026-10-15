/**
 * FR-27 (rank-based escalation guard, self-edit) and FR-28 (last super_admin).
 *
 * Expectations are transcribed from the PRD/§3, not derived from the implementation.
 */
import { describe, expect, it } from "vitest";
import type { Actor } from "./can";
import type { RoleKey } from "./matrix";
import {
  DENIAL_MESSAGES,
  canChangeAssignment,
  decideAssignmentChange,
  decideRevokeSystemGrant,
  type AssignmentChangeTarget,
  type DenialReason,
} from "./guards";

const OTHER_MEMBER = "m-other";

function actor(roles: RoleKey[], extra: Partial<Actor> = {}): Actor {
  return { memberId: "m-self", roles, ...extra };
}

/** Sekretaris Departemen: `assignment:manage` at U, rank 50, scoped to one department. */
const sekretaris = actor(["sekretaris"], {
  unitScope: ["u-dept", "u-div"],
  highestRankByUnit: { "u-dept": 50, "u-div": 50 },
});

/** Kepala Departemen: also `organization_admin` (ADR-0002) → `assignment:manage` at O. */
const kadep = actor(["kepala_departemen", "organization_admin"], {
  unitScope: ["u-dept", "u-div"],
  highestRankByUnit: { "u-dept": 40, "u-div": 40 },
});

const superAdmin = actor(["super_admin"]);

function target(overrides: Partial<AssignmentChangeTarget> = {}): AssignmentChangeTarget {
  return { orgUnitId: "u-dept", positionRank: 70, memberId: OTHER_MEMBER, ...overrides };
}

describe("decideAssignmentChange(): FR-27 self-edit is absolute", () => {
  it("refuses editing your own assignment at every scope, even for super_admin", () => {
    const mine = { memberId: "m-self" };
    for (const who of [sekretaris, kadep, superAdmin, actor(["anggota"])]) {
      expect(decideAssignmentChange(who, target(mine)), who.roles.join("+")).toEqual({
        allowed: false,
        reason: "self_edit_forbidden",
      });
    }
  });

  it("checks self-edit before the permission, so the reason is never misleading", () => {
    // An anggota has no assignment:manage at all, yet the self rule is what is reported.
    expect(decideAssignmentChange(actor(["anggota"]), target({ memberId: "m-self" }))).toEqual({
      allowed: false,
      reason: "self_edit_forbidden",
    });
  });
});

describe("decideAssignmentChange(): FR-27 rank guard for a U-scoped manager", () => {
  it("allows a strictly more junior position inside the subtree", () => {
    expect(decideAssignmentChange(sekretaris, target({ positionRank: 70 }))).toEqual({ allowed: true });
    expect(decideAssignmentChange(sekretaris, target({ positionRank: 51 }))).toEqual({ allowed: true });
  });

  it("refuses an equal-rank position (strictly junior only)", () => {
    expect(decideAssignmentChange(sekretaris, target({ positionRank: 50 }))).toEqual({
      allowed: false,
      reason: "rank_not_junior",
    });
  });

  it("refuses a more senior position", () => {
    for (const rank of [40, 30, 20, 10]) {
      expect(decideAssignmentChange(sekretaris, target({ positionRank: rank })), `rank ${rank}`).toEqual({
        allowed: false,
        reason: "rank_not_junior",
      });
    }
  });

  it("refuses a unit outside the subtree even when the rank is junior", () => {
    expect(decideAssignmentChange(sekretaris, target({ orgUnitId: "u-elsewhere", positionRank: 70 }))).toEqual({
      allowed: false,
      reason: "target_outside_scope",
    });
  });

  it("refuses when the actor's own rank in that unit is unknown", () => {
    const unknown = actor(["sekretaris"], { unitScope: ["u-dept"] });
    expect(decideAssignmentChange(unknown, target({ positionRank: 70 }))).toEqual({
      allowed: false,
      reason: "rank_not_junior",
    });
  });
});

describe("decideAssignmentChange(): O scope is not rank-limited (owner decision 2026-10-15)", () => {
  it("allows a Kepala Departemen to manage a senior position anywhere, because ADR-0002 makes them org admin", () => {
    expect(decideAssignmentChange(kadep, target({ orgUnitId: "u-other", positionRank: 10 }))).toEqual({
      allowed: true,
    });
  });

  it("allows super_admin the same", () => {
    expect(decideAssignmentChange(superAdmin, target({ orgUnitId: "u-other", positionRank: 10 }))).toEqual({
      allowed: true,
    });
  });
});

describe("decideAssignmentChange(): deny by default", () => {
  it("refuses an actor whose roles do not grant assignment:manage", () => {
    for (const roles of [["anggota"], ["staff"], ["kepala_divisi"], ["bph"]] as RoleKey[][]) {
      expect(decideAssignmentChange(actor(roles), target()), roles.join("+")).toEqual({
        allowed: false,
        reason: "permission_not_granted",
      });
    }
  });

  it("refuses an actor with no roles", () => {
    expect(decideAssignmentChange(actor([]), target())).toEqual({
      allowed: false,
      reason: "permission_not_granted",
    });
  });
});

describe("decideAssignmentChange(): agrees with can() wherever can() can express the rule", () => {
  const actors = [sekretaris, kadep, superAdmin, actor(["staff"]), actor(["anggota"]), actor([])];
  const targets = [
    target(),
    target({ positionRank: 10 }),
    target({ positionRank: 50 }),
    target({ positionRank: 51 }),
    target({ orgUnitId: "u-elsewhere", positionRank: 70 }),
    target({ orgUnitId: "u-elsewhere", positionRank: 10 }),
  ];

  it("matches for every actor x target (excluding the self-edit rule can() cannot see)", () => {
    for (const who of actors) {
      for (const what of targets) {
        const guard = decideAssignmentChange(who, what).allowed;
        const decision = canChangeAssignment(who, what);
        expect(guard, `${who.roles.join("+")} -> ${JSON.stringify(what)}`).toBe(decision);
      }
    }
  });
});

describe("decideRevokeSystemGrant(): FR-28 last super_admin protection", () => {
  it("refuses removing the final super_admin", () => {
    expect(decideRevokeSystemGrant({ roleKey: "super_admin", superAdminsRemaining: 0 })).toEqual({
      allowed: false,
      reason: "last_super_admin",
    });
  });

  it("allows removal while others remain", () => {
    expect(decideRevokeSystemGrant({ roleKey: "super_admin", superAdminsRemaining: 1 })).toEqual({ allowed: true });
    expect(decideRevokeSystemGrant({ roleKey: "super_admin", superAdminsRemaining: 5 })).toEqual({ allowed: true });
  });

  it("does not restrict other roles", () => {
    expect(decideRevokeSystemGrant({ roleKey: "organization_admin", superAdminsRemaining: 0 })).toEqual({
      allowed: true,
    });
  });
});

describe("DENIAL_MESSAGES", () => {
  it("has a message for every reason", () => {
    const reasons: DenialReason[] = [
      "permission_not_granted",
      "target_outside_scope",
      "rank_not_junior",
      "self_edit_forbidden",
      "last_super_admin",
    ];
    for (const reason of reasons) expect(DENIAL_MESSAGES[reason], reason).toBeTruthy();
  });
});
