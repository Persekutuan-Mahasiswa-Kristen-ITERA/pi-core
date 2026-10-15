import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
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
 * Pool-backed Drizzle client — for **scripts, tests and migrations only**
 * (`db:smoke`, seeds, `drizzle-kit`). Do **not** use this in a Worker: a pool that
 * outlives the request keeps I/O open and workerd cancels such requests.
 */
export function createDb(connectionString: string): DbHandle {
  const pool = new Pool({ connectionString, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}

/**
 * Run `fn` with a Drizzle client on a **single short-lived connection** — the Worker
 * pattern (ADR-0009). Cloudflare's Hyperdrive owns the real connection pool, so the
 * Worker opens one client per request and closes it before responding. Caching a pool
 * across requests (the previous implementation) makes requests hang and get cancelled
 * by the runtime: verified locally — 2 of 3 requests died with "code had hung".
 */
export async function withDb<T>(
  hyperdrive: HyperdriveLike,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: hyperdrive.connectionString });
  await client.connect();
  try {
    return await fn(drizzle(client, { schema }));
  } finally {
    await client.end();
  }
}
