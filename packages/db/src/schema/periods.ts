import { sql } from "drizzle-orm";
import { boolean, date, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * `periods` — a term of service (`docs/ARCHITECTURE.md` §4).
 *
 * **At most one active period**, enforced by a partial unique index on `is_active` where true
 * (FR-20). Activation must therefore happen inside one transaction that deactivates the old
 * period and activates the new one.
 */
export const periods = pgTable(
  "periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull().unique(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("periods_single_active_uq").on(t.isActive).where(sql`${t.isActive}`)],
);

export type Period = typeof periods.$inferSelect;
export type NewPeriod = typeof periods.$inferInsert;
