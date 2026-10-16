/**
 * Roles and the permission catalog — story 4.7 (FR-22, FR-23, FR-24).
 *
 * Two rules shape this file, and both are about what a role *cannot* be:
 *
 * 1. **System roles are read-only (FR-23, D3).** They are seeded from the design and the RBAC matrix is
 *    built on them; editing one in place would silently change what every existing member can do, with no
 *    record that the matrix moved. So `updateRole` refuses them outright rather than ignoring the flag.
 *    The refusal is not a UI convention — it is here, at the layer that writes.
 * 2. **Custom roles are built from the fixed catalog (FR-24).** A role cannot invent a permission. Every
 *    key is checked against `PERMISSION_KEYS` before anything is written, so a typo or a hand-crafted
 *    request cannot create a role that grants nothing (silently useless) or something unrecognised
 *    (silently broad). The scope is taken from the catalog, never from the request — scope is a property
 *    of the permission, not of whoever is assembling the bundle.
 *
 * A custom role's key is namespaced by convention (`custom:`), which keeps it visually distinct from the
 * seeded ones and makes an accidental collision with a future system role impossible.
 */
import { PERMISSION_KEYS, PERMISSIONS, ROLES, SCOPE_BREADTH, UNIVERSAL_GRANTS, type Actor, type PermissionKey, type Scope } from "@pi-core/shared";
import { eq, inArray } from "drizzle-orm";
import { writeAudit, type AuthorizationRequest } from "./access";
import type { Database } from "./client";
import { rolePermissions, roles } from "./schema";

export const CUSTOM_ROLE_PREFIX = "custom:";

/**
 * The narrowest scope at which each permission is granted to ANY system role.
 *
 * Scope is not a property of the permission — it is a property of the role↔permission pairing in the
 * matrix (`docs/ARCHITECTURE.md` §3). The catalog therefore cannot answer "what scope is `member:read`?",
 * and letting a caller answer it would let whoever assembles a bundle hand themselves `O` for something
 * the matrix only ever grants at `S`.
 *
 * Taking the NARROWEST scope any system role holds it at is least privilege: a custom role can never be
 * broader than the most restrictive way the matrix expresses that permission. A permission no system role
 * grants falls back to `S` (self only) rather than to `O`, because the failure mode of guessing too wide
 * is a privilege escalation and the failure mode of guessing too narrow is a role that does too little.
 */
const NARROWEST_SCOPE = (() => {
  const map = new Map<string, Scope>();
  const consider = (permission: string, scope: Scope) => {
    const current = map.get(permission);
    if (current === undefined || SCOPE_BREADTH[scope] < SCOPE_BREADTH[current]) map.set(permission, scope);
  };
  for (const [permission, scope] of Object.entries(UNIVERSAL_GRANTS)) {
    if (scope !== undefined) consider(permission, scope);
  }
  for (const role of ROLES) {
    for (const [permission, scope] of Object.entries(role.grants)) {
      if (scope !== undefined) consider(permission, scope);
    }
  }
  return map;
})();

export interface RolePermissionView {
  key: string;
  scope: "O" | "U" | "S";
  description: string | null;
}

export interface RoleView {
  id: string;
  key: string;
  name: string;
  description: string | null;
  /** True for the seeded roles: read-only, and the UI shows the lock (FR-23, D3). */
  isSystem: boolean;
  permissions: RolePermissionView[];
}

export class RoleError extends Error {
  constructor(
    readonly code: "not_found" | "system_role_read_only" | "unknown_permission" | "duplicate_key" | "invalid_key",
  ) {
    super(code);
    this.name = "RoleError";
  }
}

const DESCRIPTION_BY_KEY = new Map<string, string | null>(PERMISSIONS.map((p) => [p.key, p.description]));

export async function listRoles(db: Database): Promise<RoleView[]> {
  const rows = await db.select().from(roles);
  if (rows.length === 0) return [];

  const grants = await db
    .select()
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, rows.map((r) => r.id)));

  const byRole = new Map<string, RolePermissionView[]>();
  for (const grant of grants) {
    const list = byRole.get(grant.roleId) ?? [];
    list.push({
      key: grant.permissionKey,
      scope: grant.scope,
      description: DESCRIPTION_BY_KEY.get(grant.permissionKey) ?? null,
    });
    byRole.set(grant.roleId, list);
  }

  return rows
    .map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: (byRole.get(role.id) ?? []).sort((a, b) => a.key.localeCompare(b.key)),
    }))
    .sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.key.localeCompare(b.key));
}

export async function getRole(db: Database, id: string): Promise<RoleView> {
  const found = (await listRoles(db)).find((role) => role.id === id || role.key === id);
  if (found === undefined) throw new RoleError("not_found");
  return found;
}

/** Every key must be in the catalog. Returns the scope for each, taken from the catalog, not the caller. */
function resolvePermissions(keys: string[]): Array<{ permissionKey: PermissionKey; scope: "O" | "U" | "S" }> {
  const unique = [...new Set(keys)];
  const resolved: Array<{ permissionKey: PermissionKey; scope: "O" | "U" | "S" }> = [];
  for (const key of unique) {
    if (!(PERMISSION_KEYS as readonly string[]).includes(key)) throw new RoleError("unknown_permission");
    resolved.push({ permissionKey: key as PermissionKey, scope: NARROWEST_SCOPE.get(key) ?? "S" });
  }
  return resolved;
}

export async function createRole(
  db: Database,
  params: {
    actor: Actor;
    input: { key: string; name: string; description?: string | null | undefined; permissions: string[] };
    request?: AuthorizationRequest;
  },
): Promise<RoleView> {
  // Namespaced, so a custom role can never collide with a seeded one and is obvious in the audit trail.
  const key = params.input.key.startsWith(CUSTOM_ROLE_PREFIX)
    ? params.input.key
    : `${CUSTOM_ROLE_PREFIX}${params.input.key}`;
  if (!/^custom:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) throw new RoleError("invalid_key");

  const resolved = resolvePermissions(params.input.permissions);

  let roleId: string;
  try {
    const [created] = await db
      .insert(roles)
      .values({
        key,
        name: params.input.name,
        description: params.input.description ?? null,
        // Never settable from outside: a custom role cannot declare itself a system role (FR-23).
        isSystem: false,
      })
      .returning({ id: roles.id });
    roleId = created!.id;
  } catch (error) {
    if (isUniqueViolation(error)) throw new RoleError("duplicate_key");
    throw error;
  }

  if (resolved.length > 0) {
    await db.insert(rolePermissions).values(resolved.map((r) => ({ roleId, ...r })));
  }

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "role.create",
    entityType: "role",
    entityId: roleId,
    after: { key, name: params.input.name, permissions: resolved.map((r) => r.permissionKey) },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return getRole(db, roleId);
}

export async function updateRole(
  db: Database,
  params: {
    actor: Actor;
    id: string;
    input: { name?: string | undefined; description?: string | null | undefined; permissions?: string[] | undefined };
    request?: AuthorizationRequest;
  },
): Promise<RoleView> {
  const before = await getRole(db, params.id);

  // FR-23 / D3. Refused, not ignored: a silent no-op would let an admin believe they had changed a system
  // role. The UI shows a lock, but a lock in the UI is a hint, not a guard.
  if (before.isSystem) throw new RoleError("system_role_read_only");

  const resolved = params.input.permissions === undefined ? null : resolvePermissions(params.input.permissions);

  await db
    .update(roles)
    .set({
      ...(params.input.name === undefined ? {} : { name: params.input.name }),
      ...(params.input.description === undefined ? {} : { description: params.input.description }),
      updatedAt: new Date(),
    })
    .where(eq(roles.id, before.id));

  if (resolved !== null) {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, before.id));
    if (resolved.length > 0) {
      await db.insert(rolePermissions).values(resolved.map((r) => ({ roleId: before.id, ...r })));
    }
  }

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "role.update",
    entityType: "role",
    entityId: before.id,
    before: { name: before.name, permissions: before.permissions.map((p) => p.key) },
    after: {
      name: params.input.name ?? before.name,
      ...(resolved === null ? {} : { permissions: resolved.map((r) => r.permissionKey) }),
    },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return getRole(db, before.id);
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current !== null && current !== undefined; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** The fixed catalog, for the UI that assembles a custom role (FR-24). */
export function permissionCatalog(): Array<{ key: string; scope: string; description: string | null }> {
  return PERMISSIONS.map((p) => ({
    key: p.key,
    scope: NARROWEST_SCOPE.get(p.key) ?? "S",
    description: p.description,
  }));
}
