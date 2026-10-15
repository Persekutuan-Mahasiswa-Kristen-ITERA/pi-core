import { index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { members } from "./members";
import { roles } from "./rbac";

/**
 * `system_grants` and `audit_logs` — `docs/ARCHITECTURE.md` §4, FR-31 and FR-43.
 *
 * - `system_grants` — a role granted to a member *outside* the org tree, deliberately **not**
 *   tied to a position or period. Only `super_admin` uses it (§3: "granted explicitly, never tied
 *   to a position or period"), which is why the effective-roles derivation unions it in.
 * - `audit_logs` — **append-only**. Every mutation of members/assignments/periods/roles/
 *   integrations/settings writes exactly one row (FR-43). Update and delete are refused by the
 *   `audit_logs_append_only` trigger, which is enforced for *every* role including the table owner
 *   (a plain `REVOKE` would not bind the owner connection we reach Postgres with — see
 *   `docs/STATE.md`, least-privilege DB role is a follow-up).
 */

export const systemGrants = pgTable(
  "system_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    /** Role key, e.g. `super_admin`. Cascades with the role, like `role_permissions`. */
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => members.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("system_grants_member_role_uq").on(t.memberId, t.roleKey),
    index("system_grants_member_idx").on(t.memberId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Deliberately **not** a foreign key: the log is a historical record and must survive the
     * member it refers to (NFR-6 anonymization / deletion).
     */
    actorMemberId: uuid("actor_member_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    /** Sensitive fields are redacted before they get here (NFR-6). */
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
  },
  (t) => [
    index("audit_logs_at_idx").on(t.at),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorMemberId),
  ],
);

export type SystemGrant = typeof systemGrants.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
