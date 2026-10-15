/**
 * The default role → permission matrix (`docs/ARCHITECTURE.md` §3).
 *
 * This is the **single source of truth** for the matrix: `packages/db` seeds `role_permissions`
 * from it and the pure `can()` uses it as its default. If they were defined twice they could
 * diverge, and a divergence here is a security bug.
 *
 * Scope: `O` organization-wide, `U` the holder's own unit subtree, `S` self only. `-` in §3 means
 * "no grant" and is expressed by simply omitting the permission.
 *
 * §3 writes the two `assignment:manage` cells as `U*`. The `permission_scope` enum in the database
 * has only `O|U|S`, so those are stored as plain `U` and the `*` rank guard lives in `can()`,
 * keyed on the permission — see `can.ts`.
 *
 * Two documented gaps are handled conservatively (deny by default), confirmed by the owner on
 * 2026-10-15: `bendahara` and `panitia` have no column in §3's matrix, so they carry only the
 * universal baseline (`bendahara_umum_*` positions also hold `bph`, which is where their real
 * permissions come from).
 */
import type { PermissionKey } from "./permissions";

/** `O` organization-wide, `U` the holder's own unit subtree, `S` self only. */
export type Scope = "O" | "U" | "S";

/** Broadest first: an actor holding a permission at two scopes gets the broader one. */
export const SCOPE_BREADTH: Readonly<Record<Scope, number>> = { O: 3, U: 2, S: 1 };

export const ROLE_KEYS = [
  "super_admin",
  "organization_admin",
  "bph",
  "bendahara",
  "kepala_departemen",
  "sekretaris",
  "kepala_divisi",
  "staff",
  "panitia",
  "anggota",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  /** Grants on top of {@link UNIVERSAL_GRANTS}. */
  grants: Partial<Record<PermissionKey, Scope>>;
}

/** Granted to every role — §3's first two matrix rows. */
export const UNIVERSAL_GRANTS: Readonly<Partial<Record<PermissionKey, Scope>>> = {
  "profile:read_own": "S",
  "profile:update_own": "S",
  "orgunit:read": "O",
  "period:read": "O",
};

export const ROLES: readonly RoleDefinition[] = [
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

/** role key → permission key → scope. */
export type PermissionMatrix = ReadonlyMap<string, ReadonlyMap<PermissionKey, Scope>>;

/** The matrix as data, built from {@link ROLES} + {@link UNIVERSAL_GRANTS}. */
export const DEFAULT_MATRIX: PermissionMatrix = new Map(
  ROLES.map((role) => [
    role.key,
    new Map<PermissionKey, Scope>(
      Object.entries({ ...UNIVERSAL_GRANTS, ...role.grants }) as Array<[PermissionKey, Scope]>,
    ),
  ]),
);

const ROLE_KEY_SET: ReadonlySet<string> = new Set(ROLE_KEYS);

/** Runtime guard for values that arrive from outside TypeScript (e.g. a DB row). */
export function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === "string" && ROLE_KEY_SET.has(value);
}
