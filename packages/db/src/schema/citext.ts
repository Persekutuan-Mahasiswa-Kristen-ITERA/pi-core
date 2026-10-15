import { customType } from "drizzle-orm/pg-core";

/**
 * Postgres `citext` — case-insensitive text.
 *
 * Drizzle does not ship this type, so it is declared here. The migration creates the
 * extension (`CREATE EXTENSION IF NOT EXISTS citext`) before any table uses it.
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});
