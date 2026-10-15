import { pgEnum } from "drizzle-orm/pg-core";

/** `members.status` — soft lifecycle state (deletion is a separate `deleted_at`). */
export const memberStatus = pgEnum("member_status", ["active", "inactive"]);

/**
 * `org_units.type` — the fixed unit vocabulary from `docs/ARCHITECTURE.md` §2:
 * organization -> bph | department | bureau; department -> division.
 */
export const orgUnitType = pgEnum("org_unit_type", [
  "organization",
  "bph",
  "department",
  "bureau",
  "division",
]);
