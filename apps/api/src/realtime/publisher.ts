import type { Context } from "hono";
import type { RealtimeEvent } from "@pi-core/shared";
import type { AppEnv } from "../env";

/**
 * Publish a domain event to the `RealtimeHub` Durable Object singleton (ADR-0011, FR-55).
 * Non-blocking: scheduled via `c.executionCtx.waitUntil` when available so client latency
 * is not penalized.
 */
export async function publishRealtimeEvent(
  c: Context<AppEnv>,
  event: RealtimeEvent,
): Promise<void> {
  const hubBinding = c.env.REALTIME_HUB;
  if (!hubBinding) {
    // In local unit tests or environments without DO binding, gracefully no-op
    return;
  }

  const publishAction = async (): Promise<void> => {
    try {
      const id = hubBinding.idFromName("global");
      const stub = hubBinding.get(id);
      const res = await stub.fetch("https://realtime-hub.internal/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        console.warn(`[realtime] publish to RealtimeHub returned status ${res.status}`);
      }
    } catch (err) {
      console.warn("[realtime] publish to RealtimeHub failed", err);
    }
  };

  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(publishAction());
  } else {
    await publishAction();
  }
}
