/**
 * Domain event topics for PI-CORE real-time fan-out (ADR-0011, FR-55).
 * Real-time channel is a notification channel only: payloads contain IDs/actions only,
 * never raw entity data or secrets.
 */
export const REALTIME_TOPICS = [
  "members",
  "assignments",
  "periods",
  "roles",
  "integrations",
  "settings",
  "audit",
] as const;

export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

export interface RealtimeEvent {
  topic: RealtimeTopic;
  entity: string;
  id: string;
  action: string;
  at: string;
}

export function isRealtimeTopic(val: unknown): val is RealtimeTopic {
  return typeof val === "string" && REALTIME_TOPICS.includes(val as RealtimeTopic);
}

export function isRealtimeEvent(val: unknown): val is RealtimeEvent {
  if (!val || typeof val !== "object") return false;
  const o = val as Record<string, unknown>;
  return (
    isRealtimeTopic(o.topic) &&
    typeof o.entity === "string" &&
    o.entity.length > 0 &&
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.action === "string" &&
    o.action.length > 0 &&
    typeof o.at === "string" &&
    o.at.length > 0
  );
}

/**
 * Factory helper to construct a valid notification event.
 */
export function createRealtimeEvent(
  topic: RealtimeTopic,
  entity: string,
  id: string,
  action: string,
  at?: string,
): RealtimeEvent {
  return {
    topic,
    entity,
    id,
    action,
    at: at ?? new Date().toISOString(),
  };
}
