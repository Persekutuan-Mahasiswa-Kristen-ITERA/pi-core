import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * `generate` (schema -> SQL) needs no database.
 * `migrate` / `studio` need the **direct/session** Supabase URL — `DIRECT_URL` (Supabase's
 * own name, port 5432) or `DIRECT_DATABASE_URL`. It is used only for migrations and never by
 * the Worker (the Worker reaches Postgres through Hyperdrive). Values live in
 * `packages/db/.env`, which is gitignored.
 */
const directUrl = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL ?? "";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: directUrl ?? "" },
  verbose: true,
});
