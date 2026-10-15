/** FR-31 — effective roles derivation, and the ways it must *not* grant access. */
import { describe, expect, it } from "vitest";
import { effectiveRoles, type AssignmentFact, type EffectiveRolesInput } from "./effective-roles";
import type { RoleKey } from "./matrix";

const ACTIVE = "period-2026";
const PAST = "period-2025";
const FUTURE = "period-2027";

const positionRoles = new Map<string, readonly RoleKey[]>([
  ["kepala_departemen", ["kepala_departemen", "organization_admin"]],
  ["sekretaris_departemen", ["sekretaris"]],
  ["kepala_divisi", ["kepala_divisi"]],
  ["staff", ["staff"]],
  ["bendahara_umum_1", ["bph", "bendahara"]],
]);

function assignment(periodId: string, positionId: string, orgUnitId = "u-1"): AssignmentFact {
  return { periodId, orgUnitId, positionId, positionRank: 40 };
}

function derive(overrides: Partial<EffectiveRolesInput> = {}) {
  return effectiveRoles({
    memberId: "m-1",
    activePeriodId: ACTIVE,
    assignments: [],
    positionRoles,
    ...overrides,
  });
}

describe("effectiveRoles(): the union FR-31 describes", () => {
  it("grants position_roles for active-period assignments", () => {
    const result = derive({ assignments: [assignment(ACTIVE, "kepala_departemen")] });
    expect(result.roles).toEqual(["anggota", "kepala_departemen", "organization_admin"]);
  });

  it("unions several active assignments and de-duplicates", () => {
    const result = derive({
      assignments: [
        assignment(ACTIVE, "sekretaris_departemen", "u-dept"),
        assignment(ACTIVE, "staff", "u-div"),
      ],
    });
    expect(result.roles).toEqual(["anggota", "sekretaris", "staff"]);
  });

  it("adds explicit system grants", () => {
    const result = derive({
      assignments: [assignment(ACTIVE, "staff")],
      systemGrants: ["super_admin"],
    });
    expect(result.roles).toEqual(["anggota", "staff", "super_admin"]);
  });

  it("always includes the implicit anggota baseline", () => {
    expect(derive().roles).toEqual(["anggota"]);
    expect(derive({ activePeriodId: null }).roles).toEqual(["anggota"]);
  });

  it("returns a stable, sorted list", () => {
    const result = derive({
      assignments: [assignment(ACTIVE, "bendahara_umum_1")],
      systemGrants: ["super_admin"],
    });
    expect(result.roles).toEqual(["anggota", "bendahara", "bph", "super_admin"]);
    expect([...result.roles]).toEqual(result.roles.slice().sort());
  });
});

describe("effectiveRoles(): only the active period grants access", () => {
  it("ignores past and future periods", () => {
    const result = derive({
      assignments: [
        assignment(PAST, "kepala_departemen"),
        assignment(ACTIVE, "staff"),
        assignment(FUTURE, "kepala_divisi"),
      ],
    });
    expect(result.roles).toEqual(["anggota", "staff"]);
    expect(result.activeAssignments).toHaveLength(1);
    expect(result.ignoredAssignments.map((a) => a.periodId)).toEqual([PAST, FUTURE]);
  });

  it("grants nothing beyond the baseline when no period is active", () => {
    const result = derive({
      activePeriodId: null,
      assignments: [assignment(ACTIVE, "kepala_departemen"), assignment(PAST, "bph" as never)],
    });
    expect(result.roles).toEqual(["anggota"]);
    expect(result.activeAssignments).toHaveLength(0);
    expect(result.ignoredAssignments).toHaveLength(2);
  });

  it("still honours system grants with no active period (super_admin is not period-bound)", () => {
    const result = derive({ activePeriodId: null, systemGrants: ["super_admin"] });
    expect(result.roles).toEqual(["anggota", "super_admin"]);
  });
});

describe("effectiveRoles(): never silently over- or under-grants", () => {
  it("reports a position with no position_roles row instead of granting nothing quietly", () => {
    const result = derive({ assignments: [assignment(ACTIVE, "panitia")] });
    expect(result.roles).toEqual(["anggota"]);
    expect(result.unknownPositions).toEqual(["panitia"]);
    // An unknown position is not an "active assignment" either — it granted nothing.
    expect(result.activeAssignments).toHaveLength(0);
  });

  it("does not grant a role from a position held in another period", () => {
    const result = derive({ assignments: [assignment(PAST, "kepala_departemen")] });
    expect(result.roles).not.toContain("organization_admin");
    expect(result.roles).not.toContain("kepala_departemen");
  });

  it("never returns an empty role list", () => {
    expect(derive({ assignments: [] }).roles.length).toBeGreaterThan(0);
  });
});

describe("effectiveRoles(): assignment windows (FR-33 — an ended assignment stops granting)", () => {
  const windowed = (periodId: string, startsOn: string, endsOn: string | null): AssignmentFact => ({
    periodId,
    orgUnitId: "u-1",
    positionId: "kepala_departemen",
    positionRank: 40,
    startsOn,
    endsOn,
  });

  it("ignores a period-only view when asOf is omitted", () => {
    const result = derive({
      assignments: [windowed(ACTIVE, "2026-01-01", "2026-02-01")],
    });
    expect(result.roles).toContain("kepala_departemen");
  });

  it("grants while the assignment is open on asOf", () => {
    const result = derive({
      asOf: "2026-03-15",
      assignments: [windowed(ACTIVE, "2026-01-01", "2026-06-30")],
    });
    expect(result.roles).toContain("kepala_departemen");
  });

  it("stops granting after ends_on", () => {
    const result = derive({
      asOf: "2026-07-01",
      assignments: [windowed(ACTIVE, "2026-01-01", "2026-06-30")],
    });
    expect(result.roles).toEqual(["anggota"]);
    expect(result.ignoredAssignments).toHaveLength(1);
  });

  it("does not grant before starts_on", () => {
    const result = derive({
      asOf: "2025-12-31",
      assignments: [windowed(ACTIVE, "2026-01-01", null)],
    });
    expect(result.roles).toEqual(["anggota"]);
  });

  it("treats a null ends_on as still open", () => {
    const result = derive({
      asOf: "2030-01-01",
      assignments: [windowed(ACTIVE, "2026-01-01", null)],
    });
    expect(result.roles).toContain("kepala_departemen");
  });

  it("grants on the first and last day inclusively", () => {
    for (const day of ["2026-01-01", "2026-06-30"]) {
      const result = derive({ asOf: day, assignments: [windowed(ACTIVE, "2026-01-01", "2026-06-30")] });
      expect(result.roles, day).toContain("kepala_departemen");
    }
  });
});
