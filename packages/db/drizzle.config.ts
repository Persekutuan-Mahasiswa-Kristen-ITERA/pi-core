import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * `generate` (schema -> SQL) needs no database.
 * `migrate` / `studio` need `DIRECT_DATABASE_URL` — the **direct** Supabase Postgres URL,
 * used only for migrations and never by the Worker (the Worker goes through Hyperdrive).
 */
const directUrl = process.env.DIRECT_DATABASE_URL;

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: directUrl ?? "" },
  verbose: true,
});
