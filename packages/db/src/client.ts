import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

/** The subset of the Cloudflare Hyperdrive binding this package needs. */
export interface HyperdriveLike {
  connectionString: string;
}

export interface DbHandle {
  db: Database;
  pool: Pool;
}

/**
 * Build a Drizzle client over a Postgres connection string.
 *
 * On Workers the string comes from the `HYPERDRIVE` binding; locally it is
 * `DIRECT_DATABASE_URL`. `pg` requires the `nodejs_compat` compatibility flag.
 */
export function createDb(connectionString: string): DbHandle {
  const pool = new Pool({ connectionString, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}

// One pool per Worker isolate: the module scope is reused across requests, so we cache
// the handle instead of opening a connection per request.
let cached: DbHandle | undefined;

/** Get (and lazily create) the isolate-wide Drizzle client for a Hyperdrive binding. */
export function getDb(hyperdrive: HyperdriveLike): Database {
  cached ??= createDb(hyperdrive.connectionString);
  return cached.db;
}

/** Close the cached pool — used by tests and graceful shutdown. */
export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.pool.end();
    cached = undefined;
  }
}
