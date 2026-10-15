/**
 * Builds the Better Auth instance **once per request** and puts it on the Hono context.
 *
 * `withDb` opens a single short-lived Postgres connection and closes it when its callback returns —
 * so the callback must wrap the whole request (`await next()`), which is exactly what keeps the
 * connection (and therefore the auth instance) alive for this request and no longer. Caching the
 * instance at module scope would hold a client across requests and workerd cancels such requests
 * (ADR-0009, found the hard way in story 1.6).
 *
 * Mount it only where a session is actually needed — `/api/auth/*` and any protected group — so
 * cheap routes like the health probe and the keep-alive cron do not open a database connection.
 */
import { withDb } from "@pi-core/db";
import { createMiddleware } from "hono/factory";
import { createAuth } from "../auth";
import type { AppEnv } from "../env";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await withDb(c.env.HYPERDRIVE, async (db) => {
    c.set("auth", createAuth(db, c.env));
    await next();
  });
});
