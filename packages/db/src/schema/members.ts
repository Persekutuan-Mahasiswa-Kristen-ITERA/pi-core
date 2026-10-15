import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { citext } from "./citext";
import { memberStatus } from "./enums";

/**
 * `members` — one row per person known to PI-CORE.
 *
 * Field list follows `docs/ARCHITECTURE.md` §4. `email` is `citext` (case-insensitive
 * unique). `google_sub` is linked at first login (Epic 3). Deletion is soft via `deleted_at`
 * (AD-15); sensitive fields are redacted in logs/audit.
 *
 * **ADR-0015**: Better Auth's `user` model is mapped onto this table, so `id` *is* the auth user
 * id and `email_verified` is Better Auth's `emailVerified` field. That makes `auth_user_id`
 * (from §4's "auth-library user link") redundant — it is kept for now rather than dropping a
 * column, and is unused.
 */
export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: citext("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    nim: text("nim"),
    faculty: text("faculty"),
    studyProgram: text("study_program"),
    cohortYear: integer("cohort_year"),
    phone: text("phone"),
    avatarKey: text("avatar_key"),
    status: memberStatus("status").notNull().default("active"),
    googleSub: text("google_sub").unique(),
    authUserId: text("auth_user_id").unique(),
    /** Better Auth's `emailVerified`: Google's verified claim, required true to be admitted (NFR-1). */
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("members_full_name_idx").on(t.fullName),
    index("members_status_idx").on(t.status),
    index("members_deleted_at_idx").on(t.deletedAt),
  ],
);

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
