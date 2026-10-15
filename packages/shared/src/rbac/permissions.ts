/**
 * The fixed permission catalog (`docs/ARCHITECTURE.md` §3).
 *
 * `PermissionKey` is derived from this list, so a typo in a permission check is a compile error
 * rather than a silent "always denied". Deny by default: a permission that no role grants — or
 * that is not in this catalog — grants nothing.
 */

export const PERMISSION_KEYS = [
  "profile:read_own",
  "profile:update_own",
  "orgunit:read",
  "period:read",
  "member:read",
  "member:read_sensitive",
  "member:create",
  "member:update",
  "member:deactivate",
  "assignment:read",
  "assignment:manage",
  "orgunit:manage",
  "period:manage",
  "period:activate",
  "role:read",
  "role:manage",
  "permission-mapping:manage",
  "integration:read",
  "integration:manage",
  "settings:read",
  "settings:manage",
  "audit:read",
  "report:read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface PermissionDefinition {
  key: PermissionKey;
  description: string;
}

export const PERMISSIONS: readonly PermissionDefinition[] = [
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

const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(PERMISSION_KEYS);

/** Runtime guard for values that arrive from outside TypeScript (e.g. a DB row or a request). */
export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && PERMISSION_KEY_SET.has(value);
}
