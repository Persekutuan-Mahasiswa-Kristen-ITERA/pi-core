import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { orgUnitType } from "./enums";

/**
 * `positions` — a title inside a unit type (`docs/ARCHITECTURE.md` §3): what a person *is*.
 *
 * `rank` — lower number = more senior. `is_unique_per_unit` marks positions that may be held by
 * only one member per unit per period (e.g. Kepala Divisi) — enforced on `assignments` through a
 * partial unique index.
 *
 * The `(id, unit_type)` and `(id, is_unique_per_unit)` **unique constraints** exist purely so
 * `assignments` can reference them in composite foreign keys, which is how Postgres keeps the
 * denormalized copies honest. They must be constraints, not bare unique indexes — Postgres only
 * accepts a unique *constraint* as a composite FK target.
 */
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    unitType: orgUnitType("unit_type").notNull(),
    rank: integer("rank").notNull(),
    isUniquePerUnit: boolean("is_unique_per_unit").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("positions_id_unit_type_uq").on(t.id, t.unitType),
    unique("positions_id_unique_per_unit_uq").on(t.id, t.isUniquePerUnit),
    index("positions_unit_type_idx").on(t.unitType),
  ],
);

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
