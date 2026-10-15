import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { orgUnitType } from "./enums";

/**
 * `org_units` — the organization tree (`docs/ARCHITECTURE.md` §2):
 * organization -> bph | department | bureau; department -> division.
 *
 * `slug` is unique **within a parent**. Postgres treats NULLs as distinct, so the root
 * (parent_id IS NULL) is covered by a second partial unique index. `path`/`depth` are the
 * materialized path used for subtree (scope `U`) queries and are populated by the seed.
 */
export const orgUnits = pgTable(
  "org_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => orgUnits.id, {
      onDelete: "restrict",
    }),
    type: orgUnitType("type").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    path: text("path"),
    depth: integer("depth").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("org_units_parent_slug_uq")
      .on(t.parentId, t.slug)
      .where(sql`${t.parentId} is not null`),
    uniqueIndex("org_units_root_slug_uq")
      .on(t.slug)
      .where(sql`${t.parentId} is null`),
    index("org_units_parent_idx").on(t.parentId),
    index("org_units_path_idx").on(t.path),
  ],
);

export type OrgUnit = typeof orgUnits.$inferSelect;
export type NewOrgUnit = typeof orgUnits.$inferInsert;
