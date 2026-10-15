/**
 * Rate limiting for auth and write endpoints (FR-53).
 *
 * **Honest limitation, stated up front:** this counts in the isolate's own memory. Workers run many
 * isolates, so the effective limit is per isolate and a determined caller can exceed the intended total.
 * It is a real protection against the common cases — credential stuffing bursts, a runaway client loop,
 * an accidental retry storm — not a distributed guarantee.
 *
 * The durable alternatives are Cloudflare's Rate Limiting binding (needs a plan check against ADR-0014)
 * or a Durable Object counter (free, and the `RealtimeHub` DO in Epic 8 could host it). Deliberately not
 * done now: it is not worth a paid resource to protect endpoints that are, at this stage, behind
 * invite-only Google sign-in.
 *
 * Keys are derived from the request, never from a body field the caller controls arbitrarily, and the
 * map is bounded so a flood of distinct keys cannot itself become the outage.
 */
import { createMiddleware } from "hono/factory";
import { errorBody } from "../http/errors";
import type { AppEnv } from "../env";

interface Bucket {
  /** Timestamps of the requests still inside the window. */
  hits: number[];
}

const MAX_TRACKED_KEYS = 5_000;

/** One store per middleware instance, i.e. per isolate. */
function createStore(): Map<string, Bucket> {
  return new Map();
}

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
  /** Derive the bucket key. Defaults to the client IP. */
  key?: (c: Parameters<Parameters<typeof createMiddleware<AppEnv>>[0]>[0]) => string;
  /** Human-readable scope, used in the message so logs make sense. */
  scope: string;
}

export function rateLimit(options: RateLimitOptions) {
  const store = createStore();

  return createMiddleware<AppEnv>(async (c, next) => {
    const key = options.key?.(c) ?? c.req.header("cf-connecting-ip") ?? "unknown";
    const now = Date.now();
    const bucket = store.get(key) ?? { hits: [] };

    // Drop anything outside the window before deciding.
    const recent = bucket.hits.filter((at) => now - at < options.windowMs);

    if (recent.length >= options.limit) {
      // Return the response here rather than throwing: a header set with `c.header()` before a throw is
      // not guaranteed to survive the error handler, and `Retry-After` is part of the contract (FR-53).
      c.header("retry-after", String(Math.ceil(options.windowMs / 1000)));
      return c.json(errorBody(c, "rate_limited", `Too many requests for ${options.scope}.`), 429);
    }

    recent.push(now);
    bucket.hits = recent;
    store.set(key, bucket);

    // Bounded memory: if a flood creates too many keys, drop the oldest ones rather than grow without
    // limit. Losing a counter is a smaller problem than the isolate dying.
    if (store.size > MAX_TRACKED_KEYS) {
      const excess = store.size - MAX_TRACKED_KEYS;
      let dropped = 0;
      for (const existing of store.keys()) {
        store.delete(existing);
        if (++dropped >= excess) break;
      }
    }

    await next();
  });
}

/** Limits applied by the app. Auth endpoints are the tightest: that is where guessing happens. */
export const authRateLimit = rateLimit({ limit: 20, windowMs: 60_000, scope: "authentication" });
export const writeRateLimit = rateLimit({ limit: 120, windowMs: 60_000, scope: "writes" });
