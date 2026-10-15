import { withDb } from "@pi-core/db";
import { sql } from "drizzle-orm";
import type { Env } from "./env";

/**
 * Free-tier keep-alive (ADR-0014).
 *
 * Supabase pauses a Free-plan project after ~7 days of low activity, which would silently take
 * staging down between working sessions. This Cron Trigger issues the cheapest possible query a
 * few times a day so the project always counts as active. Cron Triggers are free on Workers Free;
 * this costs four requests and a few milliseconds of CPU per day.
 *
 * It never throws: a failed tick must not look like a broken deploy. Errors are logged as one
 * JSON line, which Workers Logs and `wrangler tail` pick up.
 */
export async function scheduled(controller: ScheduledController, env: Env): Promise<void> {
  const startedAt = Date.now();

  try {
    const row = await withDb(env.HYPERDRIVE, async (db) => {
      const result = await db.execute(sql`select 1 as ok, now() as at`);
      return (result.rows as Array<Record<string, unknown>>)[0];
    });

    console.log(
      JSON.stringify({
        event: "keepalive",
        cron: controller.cron,
        ok: row?.["ok"] === 1,
        databaseTime: row?.["at"] ?? null,
        environment: env.ENVIRONMENT ?? "local",
        latencyMs: Date.now() - startedAt,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "keepalive_failed",
        cron: controller.cron,
        environment: env.ENVIRONMENT ?? "local",
        message: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
      }),
    );
  }
}
