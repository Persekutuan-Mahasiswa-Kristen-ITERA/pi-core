/**
 * Idempotent seed of the RBAC tables (story 2.4): permissions, roles, the role→permission
 * matrix, positions and position→role defaults.
 *
 * Idempotency: every row is matched on its natural key and updated in place. For the **seeded**
 * roles and positions the mappings are also *reconciled* — a grant or default role that is no
 * longer in `src/seed/rbac.ts` is removed, so the database always matches the documented matrix.
 * Custom roles (not in the seed) are never touched.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db db:seed:rbac
 */
import { DEFAULT_MATRIX, PERMISSIONS, ROLES } from "@pi-core/shared";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { permissions, positionRoles, positions, rolePermissions, roles } from "../src/schema";
import { EXPECTED_RBAC_COUNTS, POSITIONS } from "../src/seed/rbac";

const url = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DIRECT_DATABASE_URL) is required");
  process.exit(1);
}

const { db, pool } = createDb(url);
let created = 0;
let updated = 0;
let removed = 0;

try {
  // ---- permissions ---------------------------------------------------------
  for (const p of PERMISSIONS) {
    const res = await db
      .insert(permissions)
      .values(p)
      .onConflictDoUpdate({ target: permissions.key, set: { description: p.description } })
      .returning({ key: permissions.key, created: sql<boolean>`xmax = 0` });
    if (res[0]?.created) created += 1;
    else updated += 1;
  }

  // ---- roles ---------------------------------------------------------------
  const roleIds = new Map<string, string>();
  for (const r of ROLES) {
    const res = await db
      .insert(roles)
      .values({ key: r.key, name: r.name, description: r.description, isSystem: true })
      .onConflictDoUpdate({
        target: roles.key,
        set: { name: r.name, description: r.description, isSystem: true, updatedAt: new Date() },
      })
      .returning({ id: roles.id, created: sql<boolean>`xmax = 0` });
    const row = res[0]!;
    roleIds.set(r.key, row.id);
    if (row.created) created += 1;
    else updated += 1;
  }

  // ---- role → permission ---------------------------------------------------
  // Seeded straight from the shared DEFAULT_MATRIX, so the database and can() cannot disagree.
  const grants: Array<{ roleId: string; permissionKey: string; scope: "O" | "U" | "S" }> = [];
  for (const role of ROLES) {
    const roleId = roleIds.get(role.key)!;
    for (const [permissionKey, scope] of DEFAULT_MATRIX.get(role.key) ?? []) {
      grants.push({ roleId, permissionKey, scope });
    }
  }
  for (const g of grants) {
    await db
      .insert(rolePermissions)
      .values(g)
      .onConflictDoUpdate({
        target: [rolePermissions.roleId, rolePermissions.permissionKey],
        set: { scope: g.scope },
      });
  }
  // Reconcile only the seeded roles.
  const seededRoleIds = [...roleIds.values()];
  const stale = await db
    .delete(rolePermissions)
    .where(
      and(
        inArray(rolePermissions.roleId, seededRoleIds),
        sql`(${rolePermissions.roleId}, ${rolePermissions.permissionKey}) not in (
          ${sql.join(
            grants.map((g) => sql`(${g.roleId}::uuid, ${g.permissionKey}::text)`),
            sql`, `,
          )}
        )`,
      ),
    )
    .returning({ roleId: rolePermissions.roleId });
  removed += stale.length;

  // ---- positions -----------------------------------------------------------
  const positionIds = new Map<string, string>();
  for (const p of POSITIONS) {
    const res = await db
      .insert(positions)
      .values({
        key: p.key,
        name: p.name,
        unitType: p.unitType,
        rank: p.rank,
        isUniquePerUnit: p.isUniquePerUnit,
      })
      .onConflictDoUpdate({
        target: positions.key,
        set: {
          name: p.name,
          unitType: p.unitType,
          rank: p.rank,
          isUniquePerUnit: p.isUniquePerUnit,
          updatedAt: new Date(),
        },
      })
      .returning({ id: positions.id, created: sql<boolean>`xmax = 0` });
    const row = res[0]!;
    positionIds.set(p.key, row.id);
    if (row.created) created += 1;
    else updated += 1;
  }

  // ---- position → role -----------------------------------------------------
  const links: Array<{ positionId: string; roleId: string }> = [];
  const rolesByPosition = new Map<string, Set<string>>();
  for (const p of POSITIONS) {
    const positionId = positionIds.get(p.key)!;
    const ids = new Set<string>();
    for (const roleKey of p.roles) {
      const roleId = roleIds.get(roleKey);
      if (!roleId) throw new Error(`position ${p.key} references unknown role ${roleKey}`);
      links.push({ positionId, roleId });
      ids.add(roleId);
    }
    rolesByPosition.set(positionId, ids);
  }
  for (const l of links) {
    await db.insert(positionRoles).values(l).onConflictDoNothing();
  }
  const seededPositionIds = [...positionIds.values()];
  const staleLinks = await db
    .delete(positionRoles)
    .where(
      and(
        inArray(positionRoles.positionId, seededPositionIds),
        sql`(${positionRoles.positionId}, ${positionRoles.roleId}) not in (
          ${sql.join(
            links.map((l) => sql`(${l.positionId}::uuid, ${l.roleId}::uuid)`),
            sql`, `,
          )}
        )`,
      ),
    )
    .returning({ positionId: positionRoles.positionId });
  removed += staleLinks.length;

  // ---- report --------------------------------------------------------------
  const count = async (table: "roles" | "permissions" | "role_permissions" | "positions" | "position_roles") =>
    Number(
      (
        await db.execute(
          sql`select count(*)::int as n from ${sql.identifier(table)}`,
        )
      ).rows[0]!["n"],
    );

  const actual = {
    roles: await count("roles"),
    permissions: await count("permissions"),
    role_permissions: await count("role_permissions"),
    positions: await count("positions"),
    position_roles: await count("position_roles"),
  };

  console.log(`seed:rbac created=${created} updated=${updated} removed=${removed}`);
  let bad = false;
  for (const [k, expected] of Object.entries(EXPECTED_RBAC_COUNTS)) {
    const got = actual[k as keyof typeof actual];
    const ok = got === expected;
    if (!ok) bad = true;
    console.log(`  ${k.padEnd(18)} expected=${expected} actual=${got} ${ok ? "OK" : "MISMATCH"}`);
  }

  // Drift: system roles the seed no longer describes.
  const seededKeys = ROLES.map((r) => r.key);
  const extraSystemRoles = await db
    .select({ key: roles.key })
    .from(roles)
    .where(and(eq(roles.isSystem, true), notInArray(roles.key, seededKeys)));
  if (extraSystemRoles.length > 0) {
    console.log(`  drift: ${extraSystemRoles.length} system role(s) not in the seed source:`);
    for (const r of extraSystemRoles) console.log(`    - ${r.key}`);
  }

  if (bad) process.exitCode = 1;
} finally {
  await pool.end();
}
