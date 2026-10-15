/**
 * `can()` and the §3 matrix, tested cell by cell.
 *
 * `EXPECTED_GRANTS` below is a hand transcription of `docs/ARCHITECTURE.md` §3 — deliberately
 * **not** derived from `matrix.ts`. If someone edits the implementation matrix, this file fails;
 * if §3 changes, this file must change with it. That is the point: the test is the executable
 * copy of the document, not a copy of the code.
 */
import { describe, expect, it } from "vitest";
import { can, scopeFor, type Actor, type Target } from "./can";
import { DEFAULT_MATRIX, ROLE_KEYS, type RoleKey, type Scope } from "./matrix";
import { PERMISSION_KEYS, type PermissionKey } from "./permissions";

const ALL_ROLES: readonly RoleKey[] = ROLE_KEYS;
/** §3's eight columns, for the matrix transcription below. */
const ADMINS: RoleKey[] = ["super_admin", "organization_admin"];
const ADMINS_AND_BPH: RoleKey[] = ["super_admin", "organization_admin", "bph"];
const SUPER_ONLY: RoleKey[] = ["super_admin"];

/** Transcribed from §3: permission → scope → the roles holding it at that scope. */
const EXPECTED_GRANTS: ReadonlyArray<readonly [PermissionKey, Scope, readonly RoleKey[]]> = [
  // Row 1–2: universal baseline — every role, incl. bendahara/panitia (owner-confirmed).
  ["profile:read_own", "S", ALL_ROLES],
  ["profile:update_own", "S", ALL_ROLES],
  ["orgunit:read", "O", ALL_ROLES],
  ["period:read", "O", ALL_ROLES],
  // member:read
  ["member:read", "O", ADMINS_AND_BPH],
  ["member:read", "U", ["kepala_departemen", "sekretaris", "kepala_divisi", "staff"]],
  // member:read_sensitive
  ["member:read_sensitive", "O", ADMINS],
  ["member:read_sensitive", "U", ["sekretaris"]],
  // member:create, member:deactivate
  ["member:create", "O", ADMINS],
  ["member:deactivate", "O", ADMINS],
  // member:update
  ["member:update", "O", ADMINS],
  ["member:update", "U", ["sekretaris"]],
  // assignment:read
  ["assignment:read", "O", ADMINS_AND_BPH],
  ["assignment:read", "U", ["kepala_departemen", "sekretaris", "kepala_divisi"]],
  // assignment:manage (the §3 `U*` cells — stored as `U`, guard lives in can())
  ["assignment:manage", "O", ADMINS],
  ["assignment:manage", "U", ["kepala_departemen", "sekretaris"]],
  // orgunit/period administration
  ["orgunit:manage", "O", ADMINS],
  ["period:manage", "O", ADMINS],
  ["period:activate", "O", ADMINS],
  // roles
  ["role:read", "O", ADMINS_AND_BPH],
  ["role:manage", "O", SUPER_ONLY],
  ["permission-mapping:manage", "O", SUPER_ONLY],
  // integrations, settings, audit
  ["integration:read", "O", ADMINS],
  ["integration:manage", "O", SUPER_ONLY],
  ["settings:read", "O", SUPER_ONLY],
  ["settings:manage", "O", SUPER_ONLY],
  ["audit:read", "O", ADMINS],
  // `report:read` is reserved (Reports screen deferred) → granted to nobody, asserted below.
];

function expectedScope(permission: PermissionKey, role: RoleKey): Scope | undefined {
  for (const [p, scope, roles] of EXPECTED_GRANTS) {
    if (p === permission && roles.includes(role)) return scope;
  }
  return undefined;
}

function actorWith(roles: RoleKey[], extra: Partial<Actor> = {}): Actor {
  return { memberId: "m-self", roles, ...extra };
}

const SELF: Target = { kind: "self" };
const ORG: Target = { kind: "org" };
const OTHER_MEMBER: Target = { kind: "member", memberId: "m-other" };
const OWN_MEMBER: Target = { kind: "member", memberId: "m-self" };
const MY_UNIT: Target = { kind: "unit", orgUnitId: "u-mine" };
const FOREIGN_UNIT: Target = { kind: "unit", orgUnitId: "u-foreign" };

describe("the §3 matrix — every cell, allowed and denied", () => {
  it("has exactly the 23 catalogued permissions and 10 roles", () => {
    expect(PERMISSION_KEYS).toHaveLength(23);
    expect(ROLE_KEYS).toHaveLength(10);
  });

  it("grants exactly what §3 says, for every (permission, role) pair", () => {
    for (const permission of PERMISSION_KEYS) {
      for (const role of ROLE_KEYS) {
        const expected = expectedScope(permission, role);
        const actual = scopeFor(actorWith([role]), permission);
        expect(
          actual,
          `${permission} @ ${role}: expected ${expected ?? "-"}, got ${actual ?? "-"}`,
        ).toBe(expected);
      }
    }
  });

  it("grants every catalogued permission except the reserved one", () => {
    const ungranted = PERMISSION_KEYS.filter((p) =>
      ROLE_KEYS.every((role) => scopeFor(actorWith([role]), p) === undefined),
    );
    expect(ungranted).toEqual(["report:read"]);
  });

  it("keeps bendahara and panitia on the universal baseline only (owner-confirmed)", () => {
    const baseline: PermissionKey[] = [
      "profile:read_own",
      "profile:update_own",
      "orgunit:read",
      "period:read",
    ];
    for (const role of ["bendahara", "panitia"] as const) {
      for (const permission of PERMISSION_KEYS) {
        const granted = scopeFor(actorWith([role]), permission) !== undefined;
        expect(granted, `${permission} @ ${role}`).toBe(baseline.includes(permission));
      }
    }
  });

  it("counts 85 grants in the default matrix (matches the seeded row count)", () => {
    let total = 0;
    for (const permissions of DEFAULT_MATRIX.values()) total += permissions.size;
    expect(total).toBe(85);
  });
});

describe("scope resolution", () => {
  it("takes the broadest scope when an actor holds several roles", () => {
    // staff alone: U; organization_admin alone: O; together: O wins.
    expect(scopeFor(actorWith(["staff"]), "member:read")).toBe("U");
    expect(scopeFor(actorWith(["organization_admin"]), "member:read")).toBe("O");
    expect(scopeFor(actorWith(["staff", "organization_admin"]), "member:read")).toBe("O");
  });

  it("returns undefined for a role that does not hold the permission", () => {
    expect(scopeFor(actorWith(["anggota"]), "member:create")).toBeUndefined();
    expect(scopeFor(actorWith([]), "member:read")).toBeUndefined();
  });
});

describe("can(): deny by default", () => {
  it("denies everything for an actor with no roles", () => {
    for (const permission of PERMISSION_KEYS) {
      expect(can(actorWith([]), permission, ORG), permission).toBe(false);
      expect(can(actorWith([]), permission), permission).toBe(false);
    }
  });

  it("denies an unlisted permission (report:read) to every role", () => {
    for (const role of ROLE_KEYS) {
      expect(can(actorWith([role]), "report:read", ORG), role).toBe(false);
    }
  });

  it("denies a permission value that is not in the catalog at all", () => {
    const bogus = "member:delete_everything" as PermissionKey;
    expect(can(actorWith(["super_admin"]), bogus, ORG)).toBe(false);
  });

  it("denies anggota the administrative permissions", () => {
    const anggota = actorWith(["anggota"]);
    expect(can(anggota, "member:read", ORG)).toBe(false);
    expect(can(anggota, "member:create", ORG)).toBe(false);
    expect(can(anggota, "assignment:read", ORG)).toBe(false);
    expect(can(anggota, "audit:read", ORG)).toBe(false);
    // …but the universal baseline still works.
    expect(can(anggota, "profile:read_own", SELF)).toBe(true);
    expect(can(anggota, "orgunit:read", ORG)).toBe(true);
  });
});

describe("can(): O scope is organization-wide", () => {
  const admin = actorWith(["organization_admin"]);

  it("allows any target, including none", () => {
    for (const target of [undefined, SELF, ORG, MY_UNIT, FOREIGN_UNIT, OTHER_MEMBER]) {
      expect(can(admin, "member:read", target), JSON.stringify(target)).toBe(true);
    }
  });

  it("allows super_admin to manage a senior assignment (no rank guard at O scope)", () => {
    const superAdmin = actorWith(["super_admin"]);
    expect(
      can(superAdmin, "assignment:manage", {
        kind: "assignment",
        orgUnitId: "u-any",
        positionRank: 10,
      }),
    ).toBe(true);
  });
});

describe("can(): S scope is self only", () => {
  const anggota = actorWith(["anggota"]);

  it("allows the actor's own profile, and only that", () => {
    expect(can(anggota, "profile:read_own", SELF)).toBe(true);
    expect(can(anggota, "profile:read_own", OWN_MEMBER)).toBe(true);
    expect(can(anggota, "profile:read_own", OTHER_MEMBER)).toBe(false);
    expect(can(anggota, "profile:read_own", ORG)).toBe(false);
    expect(can(anggota, "profile:read_own", MY_UNIT)).toBe(false);
    expect(can(anggota, "profile:read_own")).toBe(false);
  });

  it("keeps profile:* self-only even for an admin (§3 row 1 is S for every role)", () => {
    const admin = actorWith(["organization_admin"]);
    expect(can(admin, "profile:update_own", SELF)).toBe(true);
    expect(can(admin, "profile:update_own", OWN_MEMBER)).toBe(true);
    expect(can(admin, "profile:update_own", OTHER_MEMBER)).toBe(false);
    // Editing someone else's record goes through member:update, which organization_admin holds at O.
    expect(can(admin, "member:update", OTHER_MEMBER)).toBe(true);
  });
});

describe("can(): U scope is the holder's own subtree", () => {
  const kepalaDivisi = actorWith(["kepala_divisi"], { unitScope: ["u-mine", "u-child"] });

  it("allows targets inside the subtree", () => {
    expect(can(kepalaDivisi, "member:read", { kind: "unit", orgUnitId: "u-mine" })).toBe(true);
    expect(can(kepalaDivisi, "member:read", { kind: "unit", orgUnitId: "u-child" })).toBe(true);
    expect(
      can(kepalaDivisi, "member:read", { kind: "member", memberId: "m-x", orgUnitId: "u-child" }),
    ).toBe(true);
  });

  it("denies targets outside the subtree, and targets that name no unit", () => {
    expect(can(kepalaDivisi, "member:read", FOREIGN_UNIT)).toBe(false);
    expect(
      can(kepalaDivisi, "member:read", { kind: "member", memberId: "m-x", orgUnitId: "u-foreign" }),
    ).toBe(false);
    expect(can(kepalaDivisi, "member:read", { kind: "member", memberId: "m-x" })).toBe(false);
    expect(can(kepalaDivisi, "member:read", { kind: "member", memberId: "m-x", orgUnitId: null })).toBe(false);
  });

  it("denies an org-wide target (a U holder cannot act org-wide)", () => {
    expect(can(kepalaDivisi, "member:read", ORG)).toBe(false);
    expect(can(kepalaDivisi, "member:read")).toBe(false);
  });

  it("denies an actor with no unitScope at all", () => {
    expect(can(actorWith(["kepala_divisi"]), "member:read", MY_UNIT)).toBe(false);
  });
});

describe("can(): the §3 U* rank guard on assignment:manage", () => {
  // Kepala Departemen: rank 40, scoped to their department.
  const kadep = actorWith(["kepala_departemen"], {
    unitScope: ["u-dept"],
    highestRankByUnit: { "u-dept": 40 },
  });
  const assignment = (positionRank: number, orgUnitId = "u-dept"): Target => ({
    kind: "assignment",
    orgUnitId,
    positionRank,
  });

  it("allows managing a strictly more junior position in the subtree", () => {
    expect(can(kadep, "assignment:manage", assignment(70))).toBe(true); // staff
    expect(can(kadep, "assignment:manage", assignment(60))).toBe(true); // kepala divisi
    expect(can(kadep, "assignment:manage", assignment(41))).toBe(true); // just junior
  });

  it("refuses an equally senior or more senior position", () => {
    expect(can(kadep, "assignment:manage", assignment(40))).toBe(false); // own rank
    expect(can(kadep, "assignment:manage", assignment(30))).toBe(false); // bendahara umum
    expect(can(kadep, "assignment:manage", assignment(10))).toBe(false); // ketua umum
  });

  it("refuses outside the subtree even when the rank is junior", () => {
    expect(can(kadep, "assignment:manage", assignment(70, "u-other-dept"))).toBe(false);
  });

  it("refuses when the actor's own rank in that unit is unknown", () => {
    const unknown = actorWith(["kepala_departemen"], { unitScope: ["u-dept"] });
    expect(can(unknown, "assignment:manage", assignment(70))).toBe(false);
  });

  it("refuses a non-assignment target", () => {
    expect(can(kadep, "assignment:manage", MY_UNIT)).toBe(false);
    expect(can(kadep, "assignment:manage", ORG)).toBe(false);
  });

  it("does not apply the guard to assignment:read", () => {
    expect(can(kadep, "assignment:read", assignment(10))).toBe(true);
    expect(can(kadep, "assignment:read", assignment(70))).toBe(true);
  });

  it("does not apply the guard to sekretaris member:update (also U, not rank-guarded)", () => {
    const sekretaris = actorWith(["sekretaris"], {
      unitScope: ["u-dept"],
      highestRankByUnit: { "u-dept": 50 },
    });
    expect(
      can(sekretaris, "member:update", { kind: "member", memberId: "m-x", orgUnitId: "u-dept" }),
    ).toBe(true);
  });
});

describe("can(): a database-supplied matrix overrides the default", () => {
  it("honours a custom role and a custom grant", () => {
    const custom = new Map([
      ["custom_editor", new Map<PermissionKey, Scope>([["member:update", "O"]])],
    ]);
    const actor = actorWith(["custom_editor" as RoleKey]);

    // An unknown role is denied by default…
    expect(can(actor, "member:update", ORG)).toBe(false);
    expect(can(actor, "member:update", ORG, DEFAULT_MATRIX)).toBe(false);
    // …and the database-supplied matrix grants it.
    expect(can(actor, "member:update", ORG, custom)).toBe(true);
  });

  it("can narrow a default grant", () => {
    const narrowed = new Map([
      ["organization_admin", new Map<PermissionKey, Scope>([["member:read", "S"]])],
    ]);
    const admin = actorWith(["organization_admin"]);
    expect(can(admin, "member:read", ORG)).toBe(true);
    expect(can(admin, "member:read", ORG, narrowed)).toBe(false);
    expect(can(admin, "member:read", SELF, narrowed)).toBe(true);
  });
});
