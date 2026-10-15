/**
 * Seed data for the RBAC tables that is *organizational* rather than *security* definition:
 * positions and their default roles.
 *
 * The roles, the permission catalog and the role→permission matrix are **not** here — they live in
 * `@pi-core/shared`, so `can()` and this seed can never disagree. `packages/db` seeds
 * `role_permissions` straight from `DEFAULT_MATRIX`.
 *
 * Positions and their default roles come from `docs/ARCHITECTURE.md` §3, including **ADR-0002**
 * (all Kepala Departemen and Kepala Biro → `organization_admin`).
 *
 * Two documented gaps, owner-confirmed 2026-10-15:
 *  - §3 lists `Staff` for "division / bureau", but `positions.key` is unique (§4) and a position
 *    has a single `unit_type`, so it is seeded as **two** positions: `staff` (division) and
 *    `staff_biro` (bureau).
 *  - The `panitia` **position** is not seeded — its `unit_type` "reserved" is not in the
 *    `org_unit_type` enum and §3 defers it with Events. The `panitia` **role** exists in the
 *    shared matrix.
 */
import { DEFAULT_MATRIX, PERMISSIONS, ROLES, type RoleKey } from "@pi-core/shared";

export interface SeedPosition {
  key: string;
  name: string;
  unitType: "bph" | "department" | "bureau" | "division";
  rank: number;
  isUniquePerUnit: boolean;
  /** Role keys applied when someone is assigned to this position. */
  roles: RoleKey[];
}

/** Positions and their default roles (§3). */
export const POSITIONS: readonly SeedPosition[] = [
  { key: "ketua_umum", name: "Ketua Umum", unitType: "bph", rank: 10, isUniquePerUnit: true, roles: ["bph", "organization_admin"] },
  { key: "sekretaris_jenderal", name: "Sekretaris Jenderal", unitType: "bph", rank: 20, isUniquePerUnit: true, roles: ["bph", "organization_admin"] },
  { key: "sekretaris_umum_1", name: "Sekretaris Umum 1", unitType: "bph", rank: 30, isUniquePerUnit: true, roles: ["bph", "organization_admin"] },
  { key: "sekretaris_umum_2", name: "Sekretaris Umum 2", unitType: "bph", rank: 30, isUniquePerUnit: true, roles: ["bph", "organization_admin"] },
  { key: "bendahara_umum_1", name: "Bendahara Umum 1", unitType: "bph", rank: 30, isUniquePerUnit: true, roles: ["bph", "bendahara"] },
  { key: "bendahara_umum_2", name: "Bendahara Umum 2", unitType: "bph", rank: 30, isUniquePerUnit: true, roles: ["bph", "bendahara"] },
  { key: "kepala_departemen", name: "Kepala Departemen", unitType: "department", rank: 40, isUniquePerUnit: true, roles: ["kepala_departemen", "organization_admin"] },
  { key: "sekretaris_departemen", name: "Sekretaris Departemen", unitType: "department", rank: 50, isUniquePerUnit: true, roles: ["sekretaris"] },
  { key: "kepala_biro", name: "Kepala Biro", unitType: "bureau", rank: 40, isUniquePerUnit: true, roles: ["kepala_departemen", "organization_admin"] },
  { key: "sekretaris_biro", name: "Sekretaris Biro", unitType: "bureau", rank: 50, isUniquePerUnit: true, roles: ["sekretaris"] },
  { key: "kepala_divisi", name: "Kepala Divisi", unitType: "division", rank: 60, isUniquePerUnit: true, roles: ["kepala_divisi"] },
  { key: "staff", name: "Staff", unitType: "division", rank: 70, isUniquePerUnit: false, roles: ["staff"] },
  { key: "staff_biro", name: "Staff", unitType: "bureau", rank: 70, isUniquePerUnit: false, roles: ["staff"] },
];

/** Expected row counts, asserted after the seed so a silent drift fails the run. */
export const EXPECTED_RBAC_COUNTS = {
  roles: ROLES.length,
  permissions: PERMISSIONS.length,
  role_permissions: [...DEFAULT_MATRIX.values()].reduce((n, permissions) => n + permissions.size, 0),
  positions: POSITIONS.length,
  position_roles: POSITIONS.reduce((n, position) => n + position.roles.length, 0),
} as const;
