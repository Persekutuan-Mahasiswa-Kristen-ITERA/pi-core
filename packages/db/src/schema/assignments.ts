import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { orgUnitType } from "./enums";
import { members } from "./members";
import { orgUnits } from "./org-units";
import { periods } from "./periods";
import { positions } from "./positions";

/**
 * `assignments` — member x org_unit x position x period (`docs/ARCHITECTURE.md` §4).
 *
 * Two columns are **derived from the position** — `unit_type` and `is_unique_per_unit` — and are
 * filled automatically by the `assignments_fill_from_position` trigger. They exist so Postgres can
 * enforce, declaratively, rules that span tables:
 *
 *  - `(position_id, unit_type) -> positions(id, unit_type)` and
 *    `(org_unit_id, unit_type) -> org_units(id, type)` together force
 *    **`org_unit.type = position.unit_type`** (FR-30) — the same `unit_type` must satisfy both.
 *  - `(position_id, is_unique_per_unit) -> positions(id, is_unique_per_unit)` keeps the flag honest.
 *  - the partial unique index `(org_unit_id, period_id, position_id) where is_unique_per_unit`
 *    rejects a second holder of a unique-per-unit position in the same unit and period.
 *  - `unique(member_id, org_unit_id, position_id, period_id)` stops duplicate assignments.
 */
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    orgUnitId: uuid("org_unit_id")
      .notNull()
      .references(() => orgUnits.id, { onDelete: "restrict" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "restrict" }),
    periodId: uuid("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "restrict" }),
    /** Derived from the position; the composite FKs below keep it consistent. */
    unitType: orgUnitType("unit_type").notNull(),
    /** Derived from the position; drives the partial unique index below. */
    isUniquePerUnit: boolean("is_unique_per_unit").notNull().default(false),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("assignments_member_unit_position_period_uq").on(
      t.memberId,
      t.orgUnitId,
      t.positionId,
      t.periodId,
    ),
    uniqueIndex("assignments_unique_per_unit_uq")
      .on(t.orgUnitId, t.periodId, t.positionId)
      .where(sql`${t.isUniquePerUnit}`),
    foreignKey({
      name: "assignments_position_unit_type_fk",
      columns: [t.positionId, t.unitType],
      foreignColumns: [positions.id, positions.unitType],
    }),
    foreignKey({
      name: "assignments_position_unique_per_unit_fk",
      columns: [t.positionId, t.isUniquePerUnit],
      foreignColumns: [positions.id, positions.isUniquePerUnit],
    }),
    foreignKey({
      name: "assignments_org_unit_type_fk",
      columns: [t.orgUnitId, t.unitType],
      foreignColumns: [orgUnits.id, orgUnits.type],
    }),
    index("assignments_member_idx").on(t.memberId),
    index("assignments_period_idx").on(t.periodId),
  ],
);

export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
