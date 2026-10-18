import { Hono } from "hono";
import type { AppEnv } from "../env";
import { errorBody } from "../http/errors";
import { sessionMiddleware } from "../middleware/session";

/**
 * Real-time event subscription routes (ADR-0011, FR-55).
 *
 * Subscriptions are authorized at connect time (Story 8.4 acceptance criteria):
 * unauthenticated requests get 401; authenticated requests are upgraded to
 * WebSocket (Hibernation API) or streamed over SSE (fallback).
 */
export const realtimeRoutes = new Hono<AppEnv>();

realtimeRoutes.use("*", sessionMiddleware);

realtimeRoutes.get("/ws", async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return c.json(errorBody(c, "unauthorized"), 401);
  }

  const hubBinding = c.env.REALTIME_HUB;
  if (!hubBinding) {
    return c.json({ error: "realtime_hub_unavailable" }, 503);
  }

  const id = hubBinding.idFromName("global");
  const stub = hubBinding.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/ws";
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

realtimeRoutes.get("/sse", async (c) => {
  const actor = c.get("actor");
  if (!actor) {
    return c.json(errorBody(c, "unauthorized"), 401);
  }

  const hubBinding = c.env.REALTIME_HUB;
  if (!hubBinding) {
    return c.json({ error: "realtime_hub_unavailable" }, 503);
  }

  const id = hubBinding.idFromName("global");
  const stub = hubBinding.get(id);

  const url = new URL(c.req.url);
  url.pathname = "/sse";
  return stub.fetch(new Request(url.toString(), c.req.raw));
});
