/**
 * RBAC seed data — the roles, the fixed permission catalog, the role→permission matrix and each
 * position's default roles. Source of truth: `docs/ARCHITECTURE.md` §3.
 *
 * Scope: `O` organization-wide, `U` the holder's own unit subtree, `S` self only.
 *
 * Two documented gaps are handled conservatively (deny by default) and flagged to the owner:
 *  - `bendahara` and `panitia` have **no column** in §3's matrix, so they get only the universal
 *    baseline. `bendahara_umum_*` positions also carry `bph`, which is where their real
 *    permissions come from.
 *  - §3 lists `Staff` for "division / bureau", but `positions.key` is unique (§4) and a position
 *    has a single `unit_type`, so it is seeded as two positions: `staff` (division) and
 *    `staff_biro` (bureau).
 *  - The `panitia` **position** is not seeded: its unit_type is "reserved", which is not in the
 *    `org_unit_type` enum, and §3 marks it deferred with Events. The `panitia` role is seeded.
 */

export type Scope = "O" | "U" | "S";

/** Granted to every role (the matrix's first two rows). */
export const UNIVERSAL_GRANTS: Record<string, Scope> = {
  "profile:read_own": "S",
  "profile:update_own": "S",
  "orgunit:read": "O",
  "period:read": "O",
};

export interface SeedRole {
  key: string;
  name: string;
  description: string;
  /** Extra grants on top of {@link UNIVERSAL_GRANTS}. */
  grants: Record<string, Scope>;
}

export const ROLES: SeedRole[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Technical administrator. Granted explicitly, never tied to a position or period.",
    grants: {
      "member:read": "O",
      "member:read_sensitive": "O",
      "member:create": "O",
      "member:deactivate": "O",
      "member:update": "O",
      "assignment:read": "O",
      "assignment:manage": "O",
      "orgunit:manage": "O",
      "period:manage": "O",
      "period:activate": "O",
      "role:read": "O",
      "role:manage": "O",
      "permission-mapping:manage": "O",
      "integration:read": "O",
      "integration:manage": "O",
      "settings:read": "O",
      "settings:manage": "O",
      "audit:read": "O",
    },
  },
  {
    key: "organization_admin",
    name: "Organization Admin",
    description:
      "Org-wide administrator. Held by all Kepala Departemen and Kepala Biro (ADR-0002) plus BPH leadership. Cannot edit super_admin grants, roles or integrations.",
    grants: {
      "member:read": "O",
      "member:read_sensitive": "O",
      "member:create": "O",
      "member:deactivate": "O",
      "member:update": "O",
      "assignment:read": "O",
      "assignment:manage": "O",
      "orgunit:manage": "O",
      "period:manage": "O",
      "period:activate": "O",
      "role:read": "O",
      "integration:read": "O",
      "audit:read": "O",
    },
  },
  {
    key: "bph",
    name: "BPH",
    description: "BPH leadership.",
    grants: { "member:read": "O", "assignment:read": "O", "role:read": "O" },
  },
  {
    key: "bendahara",
    name: "Bendahara",
    description:
      "Treasurer marker role. §3's matrix has no column for it, so it carries only the universal baseline (its holders also hold `bph`).",
    grants: {},
  },
  {
    key: "kepala_departemen",
    name: "Kepala Departemen / Kepala Biro",
    description: "Head of a department or bureau.",
    grants: { "member:read": "U", "assignment:read": "U", "assignment:manage": "U" },
  },
  {
    key: "sekretaris",
    name: "Sekretaris",
    description: "Sekretaris Departemen / Sekretaris Biro.",
    grants: {
      "member:read": "U",
      "member:read_sensitive": "U",
      "member:update": "U",
      "assignment:read": "U",
      "assignment:manage": "U",
    },
  },
  {
    key: "kepala_divisi",
    name: "Kepala Divisi",
    description: "Head of a division.",
    grants: { "member:read": "U", "assignment:read": "U" },
  },
  {
    key: "staff",
    name: "Staff",
    description: "Staff of a division or bureau.",
    grants: { "member:read": "U" },
  },
  {
    key: "panitia",
    name: "Panitia",
    description: "Reserved for event committees (deferred with Events).",
    grants: {},
  },
  {
    key: "anggota",
    name: "Anggota",
    description: "Implicit baseline role held by every member.",
    grants: {},
  },
];

/** The fixed permission catalog (§3). Deny by default: a key with no `role_permissions` row grants nothing. */
export const PERMISSIONS: Array<{ key: string; description: string }> = [
  { key: "profile:read_own", description: "Read own profile" },
  { key: "profile:update_own", description: "Update own profile" },
  { key: "orgunit:read", description: "Read the organization structure" },
  { key: "period:read", description: "Read periods" },
  { key: "member:read", description: "Read members (name, email, avatar, unit, position)" },
  { key: "member:read_sensitive", description: "Read sensitive member fields (NIM, phone, …)" },
  { key: "member:create", description: "Create members" },
  { key: "member:update", description: "Update members" },
  { key: "member:deactivate", description: "Deactivate members" },
  { key: "assignment:read", description: "Read assignments" },
  { key: "assignment:manage", description: "Create, update and end assignments" },
  { key: "orgunit:manage", description: "Create, edit and deactivate org units" },
  { key: "period:manage", description: "Create and edit periods" },
  { key: "period:activate", description: "Activate a period" },
  { key: "role:read", description: "Read roles" },
  { key: "role:manage", description: "Create and edit custom roles" },
  { key: "permission-mapping:manage", description: "Change role → permission mappings" },
  { key: "integration:read", description: "Read integrations (OIDC clients)" },
  { key: "integration:manage", description: "Create and edit integrations" },
  { key: "settings:read", description: "Read settings" },
  { key: "settings:manage", description: "Change settings" },
  { key: "audit:read", description: "Read the audit log" },
  { key: "report:read", description: "Reserved — Reports screen deferred" },
];

export interface SeedPosition {
  key: string;
  name: string;
  unitType: "bph" | "department" | "bureau" | "division";
  rank: number;
  isUniquePerUnit: boolean;
  /** Role keys applied when someone is assigned to this position. */
  roles: string[];
}

/** Positions and their default roles (§3). */
export const POSITIONS: SeedPosition[] = [
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

/** Expected row counts, used to assert the seed. */
export const EXPECTED_RBAC_COUNTS = {
  roles: ROLES.length,
  permissions: PERMISSIONS.length,
  role_permissions: ROLES.reduce((n, r) => n + Object.keys(UNIVERSAL_GRANTS).length + Object.keys(r.grants).length, 0),
  positions: POSITIONS.length,
  position_roles: POSITIONS.reduce((n, p) => n + p.roles.length, 0),
} as const;
