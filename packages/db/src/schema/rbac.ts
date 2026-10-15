import { boolean, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { positions } from "./positions";

/**
 * Roles, the fixed permission catalog, and the two mapping tables —
 * `docs/ARCHITECTURE.md` §3/§4.
 *
 * - `roles` — what a person *may do*. System roles are immutable (`is_system`).
 * - `permissions` — the fixed catalog. Deny by default: a permission with no `role_permissions`
 *   row grants nothing.
 * - `role_permissions` — role → permission with a **scope**: `O` organization-wide, `U` the
 *   holder's own unit subtree, `S` self only.
 * - `position_roles` — a position's *default* roles, applied when someone is assigned to it.
 */

export const permissionScope = pgEnum("permission_scope", ["O", "U", "S"]);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
    scope: permissionScope("scope").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
);

export const positionRoles = pgTable(
  "position_roles",
  {
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.positionId, t.roleId] })],
);

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type PositionRole = typeof positionRoles.$inferSelect;
