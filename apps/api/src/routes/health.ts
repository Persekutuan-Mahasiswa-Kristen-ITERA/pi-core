import { withDb } from "@pi-core/db";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../env";

/**
 * `GET /api/v1/health` — proves the Worker can reach Postgres through Hyperdrive.
 * Deliberately the cheapest possible query (`select 1`) so it stays inside the
 * Workers Free CPU budget (ADR-0010/ADR-0013).
 *
 * Uses one connection per request: Hyperdrive owns the pool (ADR-0009).
 */
export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/health", async (c) => {
  const startedAt = Date.now();

  const row = await withDb(c.env.HYPERDRIVE, async (db) => {
    const result = await db.execute(
      sql`select 1 as ok, current_database() as db_name, current_user as db_user`,
    );
    return (result.rows as Array<Record<string, unknown>>)[0];
  });

  return c.json({
    ok: row?.["ok"] === 1,
    database: row?.["db_name"] ?? null,
    role: row?.["db_user"] ?? null,
    environment: c.env.ENVIRONMENT ?? "local",
    latencyMs: Date.now() - startedAt,
  });
});
