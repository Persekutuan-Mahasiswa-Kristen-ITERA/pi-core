/**
 * Organization profile settings — story 4.9 (FR-41, FR-42).
 *
 * A **singleton** row: the organization has one name and one logo, so the table holds exactly one row and
 * the database is what enforces that. A partial unique index on `singleton` where it is true means a
 * second row is impossible, rather than a convention that the first migration happened to respect. The
 * alternative — a key/value settings table — would let a typo create a second, shadow `org_name` that
 * nothing reads, and "which row is the real one?" is a bug that only shows up in production.
 *
 * The logo is stored as an R2 **key**, never a URL. The bucket stays private (FR-41) and the API serves
 * the bytes, so the key can be rotated or the bucket renamed without a data migration, and nothing in the
 * database points at a host we do not control.
 */
import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const orgSettings = pgTable(
  "org_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always true. Exists only so the partial unique index below has a column to constrain. */
    singleton: boolean("singleton").notNull().default(true),
    orgName: text("org_name").notNull(),
    /** R2 object key for the logo; `null` until one is uploaded. */
    logoKey: text("logo_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // At most one row, enforced by the database rather than by discipline.
    uniqueIndex("org_settings_singleton_uq").on(t.singleton).where(sql`${t.singleton}`),
  ],
);

export type OrgSettings = typeof orgSettings.$inferSelect;
