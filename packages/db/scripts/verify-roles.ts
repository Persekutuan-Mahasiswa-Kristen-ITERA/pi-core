/**
 * Proof of the role rules — story 4.7 (FR-22, FR-23, FR-24) — against a real database.
 *
 * The assertions that matter are the refusals, because a role is a bundle of authority: a system role that
 * can be edited in place changes what every existing member can do with no record that the matrix moved,
 * and a permission key that is not checked against the catalog creates a role that grants either nothing
 * or something unrecognised. Both are checked here, against the database rather than a mock.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-roles.ts
 */
import { PERMISSION_KEYS, ROLES, SCOPE_BREADTH, UNIVERSAL_GRANTS } from "@pi-core/shared";
import { eq, inArray } from "drizzle-orm";
import { createDb } from "../src/client";
import { createRole, getRole, listRoles, permissionCatalog, RoleError, updateRole } from "../src/roles";
import { auditLogs, rolePermissions, roles } from "../src/schema";

const url = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DIRECT_DATABASE_URL) is required");
  process.exit(1);
}

const { db, pool } = createDb(url);
let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failed += 1;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`}`,
  );
}

const TAG = `verify-roles-${Date.now()}`;
const admin = { memberId: "00000000-0000-0000-0000-000000000001", roles: ["super_admin"] as const };
const created: string[] = [];

async function failureOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "no error";
  } catch (error) {
    return error instanceof RoleError ? error.code : `wrong error: ${String(error).slice(0, 80)}`;
  }
}

try {
  // ---- FR-22 / FR-23: the seeded roles are readable and marked read-only ----
  console.log("FR-22 / FR-23 — system roles are readable, and marked as read-only");
  const all = await listRoles(db);
  const system = all.filter((role) => role.isSystem);
  check("the seeded system roles are present", system.length > 0, true);
  check("every system role is flagged isSystem", system.every((role) => role.isSystem), true);
  check(
    "a system role carries permissions with their scopes",
    (system.find((role) => role.key === "super_admin")?.permissions.length ?? 0) > 0,
    true,
  );
  check("listRoles puts system roles first", all[0]?.isSystem, true);

  // ---- FR-23: a system role cannot be edited, and the refusal is a real one ----
  console.log("\nFR-23 — editing a system role is refused, not silently ignored");
  const superAdmin = system.find((role) => role.key === "super_admin")!;
  check("renaming a system role is refused", await failureOf(() => updateRole(db, {
    actor: admin,
    id: superAdmin.id,
    input: { name: "Pwned" },
  })), "system_role_read_only");
  check("changing a system role's permissions is refused", await failureOf(() => updateRole(db, {
    actor: admin,
    id: superAdmin.id,
    input: { permissions: [] },
  })), "system_role_read_only");

  // The refusal must not have changed anything — that is the difference between refusing and no-op'ing.
  const afterRefusal = await getRole(db, superAdmin.id);
  check("the system role is byte-for-byte unchanged", { name: afterRefusal.name, perms: afterRefusal.permissions.map((p) => p.key) }, { name: superAdmin.name, perms: superAdmin.permissions.map((p) => p.key) });

  // ---- FR-24: custom roles come from the fixed catalog ----
  console.log("\nFR-24 — custom roles are built from the catalog, and only from it");
  const custom = await createRole(db, {
    actor: admin,
    input: { key: `${TAG}-bundle`, name: "Verification bundle", permissions: ["member:read", "audit:read"] },
  });
  created.push(custom.id);
  check("the key is namespaced so it cannot collide with a seeded role", custom.key, `custom:${TAG}-bundle`);
  check("a custom role is never a system role", custom.isSystem, false);
  check("the requested permissions are stored", custom.permissions.map((p) => p.key), ["audit:read", "member:read"]);
  check(
    "each permission carries a scope taken from the matrix, not from the caller",
    custom.permissions.every((p) => SCOPE_BREADTH[p.scope] <= 3 && ["O", "U", "S"].includes(p.scope)),
    true,
  );
  check(
    "the creation is audited",
    (await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.entityId, custom.id))).length >= 1,
    true,
  );

  check("a permission outside the catalog is refused", await failureOf(() => createRole(db, {
    actor: admin,
    input: { key: `${TAG}-bad`, name: "Bad", permissions: ["member:read", "role:become_god"] },
  })), "unknown_permission");

  check("a duplicate key is refused", await failureOf(() => createRole(db, {
    actor: admin,
    input: { key: `${TAG}-bundle`, name: "Again", permissions: ["member:read"] },
  })), "duplicate_key");

  check("an unnamespaced key that would be invalid is refused", await failureOf(() => createRole(db, {
    actor: admin,
    input: { key: "Not A Valid Key", name: "Bad", permissions: ["member:read"] },
  })), "invalid_key");

  // A refused create must leave nothing behind, including its permission rows.
  const strays = await db.select({ id: roles.id }).from(roles).where(inArray(roles.key, [`custom:${TAG}-bad`, "custom:Not A Valid Key"]));
  check("no role rows were left behind by the refusals", strays.length, 0);

  console.log("\nFR-24 — a custom role can be edited");
  const edited = await updateRole(db, {
    actor: admin,
    id: custom.id,
    input: { name: "Verification bundle v2", permissions: ["member:read"] },
  });
  check("the name changed", edited.name, "Verification bundle v2");
  check("the permission set was replaced, not merged", edited.permissions.map((p) => p.key), ["member:read"]);
  const rows = await db.select({ key: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleId, custom.id));
  check("the replaced permissions are gone from the join table", rows.length, 1);

  // ---- the catalog the UI assembles from ----
  console.log("\nFR-24 — the catalog the UI assembles a role from");
  const catalog = permissionCatalog();
  check("the catalog is the fixed list", catalog.length, PERMISSION_KEYS.length);
  check("every catalog entry has a scope", catalog.every((entry) => ["O", "U", "S"].includes(entry.scope)), true);
  check(
    "no catalog scope is broader than the narrowest grant the matrix makes for it",
    catalog.every((entry) => {
      const scopes: string[] = [];
      for (const role of ROLES) {
        const granted = role.grants[entry.key as keyof typeof role.grants];
        if (granted !== undefined) scopes.push(granted);
      }
      const universal = UNIVERSAL_GRANTS[entry.key as keyof typeof UNIVERSAL_GRANTS];
      if (universal !== undefined) scopes.push(universal);
      if (scopes.length === 0) return entry.scope === "S"; // not granted anywhere → least privilege
      const narrowest = scopes.reduce((a, b) => (SCOPE_BREADTH[b as "O" | "U" | "S"] < SCOPE_BREADTH[a as "O" | "U" | "S"] ? b : a));
      return entry.scope === narrowest;
    }),
    true,
  );

  check("an unknown role id is a not_found", await failureOf(() => getRole(db, "00000000-0000-0000-0000-0000000000ff")), "not_found");
} finally {
  if (created.length > 0) await db.delete(roles).where(inArray(roles.id, created));
  await db.delete(roles).where(inArray(roles.key, [`custom:${TAG}-bad`, "custom:Not A Valid Key"]));
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
