/**
 * `requestId` — the thread that ties a user's complaint to a log line and an audit row (FR-51).
 *
 * Set once, before anything else can fail, so that even an error thrown by another middleware still
 * carries one. An inbound `X-Request-Id` is honoured (useful when a caller is tracing a chain) but
 * validated first: it ends up in logs and audit rows, so it must not be attacker-controlled prose.
 */
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

/** A conservative id shape: hex/uuid-ish, bounded length. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export const requestIdMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const inbound = c.req.header("x-request-id");
  const requestId =
    inbound !== undefined && SAFE_REQUEST_ID.test(inbound) ? inbound : crypto.randomUUID();

  c.set("requestId", requestId);
  c.header("x-request-id", requestId);

  await next();
});
