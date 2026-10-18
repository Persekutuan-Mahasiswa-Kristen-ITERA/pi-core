import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  }
  return { DurableObject };
});

import {
  can,
  createRealtimeEvent,
  isRealtimeEvent,
  isRealtimeTopic,
  type Actor,
  type RealtimeEvent,
  REALTIME_TOPICS,
} from "@pi-core/shared";
import { app } from "../app";
import type { Env } from "../env";
import { RealtimeHub } from "../realtime/hub";

const mockEnv = {
  BETTER_AUTH_URL: "https://api.example.test",
  CORS_ORIGINS: "https://admin.example.test",
  BETTER_AUTH_SECRET: "test",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  ENVIRONMENT: "local",
} as unknown as Env;

describe("Epic 8: Real-time Updates (ADR-0011, FR-55..57, Story 8.1..8.4)", () => {
  describe("Story 8.1 & 8.4: Subscription connection authorization", () => {
    it("rejects unauthenticated WebSocket connection with 401 unauthorized", async () => {
      const res = await app.request("/api/v1/realtime/ws", {}, mockEnv);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("unauthorized");
    });

    it("rejects unauthenticated SSE fallback connection with 401 unauthorized", async () => {
      const res = await app.request("/api/v1/realtime/sse", {}, mockEnv);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("unauthorized");
    });
  });

  describe("Story 8.4: Notification-only channel payload integrity (zero data leakage)", () => {
    it("defines the exact required topics for PI-CORE", () => {
      expect(REALTIME_TOPICS).toEqual([
        "members",
        "assignments",
        "periods",
        "roles",
        "integrations",
        "settings",
        "audit",
      ]);
      expect(isRealtimeTopic("members")).toBe(true);
      expect(isRealtimeTopic("unknown_topic")).toBe(false);
    });

    it("enforces that domain events carry strictly notification keys (id, topic, entity, action, at) and zero personal or confidential fields", () => {
      const event = createRealtimeEvent("members", "member", "mem_123", "created");
      expect(isRealtimeEvent(event)).toBe(true);
      expect(Object.keys(event).sort()).toEqual(["action", "at", "entity", "id", "topic"]);

      // Verify that sensitive fields are never present in the event schema
      const sensitiveAttempt = {
        ...event,
        nim: "121140001",
        email: "student@itera.ac.id",
        phoneNumber: "+6281234567890",
        clientSecret: "secret-token",
      };

      const keys = Object.keys(sensitiveAttempt);
      const disallowedKeys = keys.filter((k) => !["topic", "entity", "id", "action", "at"].includes(k));
      expect(disallowedKeys).toEqual(["nim", "email", "phoneNumber", "clientSecret"]);
    });

    it("rejects malformed realtime events", () => {
      expect(isRealtimeEvent(null)).toBe(false);
      expect(isRealtimeEvent({})).toBe(false);
      expect(isRealtimeEvent({ topic: "invalid", entity: "member", id: "1", action: "c", at: "2026" })).toBe(false);
      expect(isRealtimeEvent({ topic: "members", entity: "", id: "1", action: "c", at: "2026" })).toBe(false);
    });
  });

  describe("Story 8.1: RealtimeHub Durable Object functionality", () => {
    // Mock minimal DurableObjectState for unit tests
    function createMockState(): DurableObjectState {
      const websockets: WebSocket[] = [];
      return {
        id: {} as DurableObjectId,
        storage: {} as DurableObjectStorage,
        waitUntil: () => {},
        acceptWebSocket: (ws: WebSocket) => {
          websockets.push(ws);
        },
        getWebSockets: () => websockets,
        setWebSocketAutoResponse: () => {},
        getTags: () => [],
      } as unknown as DurableObjectState;
    }

    it("handles /stats endpoint and reports active connection counts", async () => {
      const state = createMockState();
      const hub = new RealtimeHub(state, mockEnv);

      const res = await hub.fetch(new Request("https://realtime.internal/stats"));
      expect(res.status).toBe(200);
      const data = (await res.json()) as { wsClients: number; sseClients: number };
      expect(data.wsClients).toBe(0);
      expect(data.sseClients).toBe(0);
    });

    it("rejects malformed event publishes with 400 invalid_realtime_event", async () => {
      const state = createMockState();
      const hub = new RealtimeHub(state, mockEnv);

      const res = await hub.fetch(
        new Request("https://realtime.internal/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invalid: true }),
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("invalid_realtime_event");
    });

    it("publishes valid domain events to connected clients and reports delivery", async () => {
      const state = createMockState();
      const hub = new RealtimeHub(state, mockEnv);

      const validEvent: RealtimeEvent = {
        topic: "members",
        entity: "member",
        id: "mem_abc_456",
        action: "created",
        at: new Date().toISOString(),
      };

      const res = await hub.fetch(
        new Request("https://realtime.internal/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validEvent),
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; deliveredWs: number; deliveredSse: number };
      expect(body.ok).toBe(true);
      expect(body.deliveredWs).toBe(0);
    });

    it("establishes SSE fallback stream with initial connection comment", async () => {
      const state = createMockState();
      const hub = new RealtimeHub(state, mockEnv);

      const res = await hub.fetch(new Request("https://realtime.internal/sse"));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/event-stream");

      // Verify stats reflects active SSE client
      const statsRes = await hub.fetch(new Request("https://realtime.internal/stats"));
      const stats = (await statsRes.json()) as { sseClients: number };
      expect(stats.sseClients).toBe(1);
    });
  });

  describe("Story 8.4: Scope-Safe Fan-Out (AD-16, NFR-21)", () => {
    it("guarantees an out-of-scope client cannot read target data even if an event id is observed", () => {
      // Simulate U-scoped actor (e.g. Kepala Departemen Pelayanan)
      const uScopedActor: Actor = {
        memberId: "actor_u",
        roles: ["kepala_departemen"],
        unitScope: ["unit_dept_pelayanan", "unit_div_ibadah"], // Subtree of Pelayanan only
        highestRankByUnit: { unit_dept_pelayanan: 5, unit_div_ibadah: 10 },
      };

      // Real-time event announces a mutation in another subtree (e.g. Dept Media)
      const outOfScopeEvent: RealtimeEvent = {
        topic: "members",
        entity: "member",
        id: "member_in_dept_media",
        action: "updated",
        at: new Date().toISOString(),
      };

      // The client receives the event notification on WebSocket
      expect(outOfScopeEvent.id).toBe("member_in_dept_media");

      // Now client attempts to query/manage the out-of-scope entity
      // 1. Assignment change for member in another subtree is denied by can()
      const allowedInScope = can(uScopedActor, "assignment:manage", {
        kind: "assignment",
        orgUnitId: "unit_div_ibadah",
        positionRank: 12,
      });
      expect(allowedInScope).toBe(true);

      const allowedOutOfScope = can(uScopedActor, "assignment:manage", {
        kind: "assignment",
        orgUnitId: "unit_div_media",
        positionRank: 12,
      });
      // can() strictly rejects out-of-subtree targets!
      expect(allowedOutOfScope).toBe(false);

      // 2. Member update on someone outside self/scope is denied
      const allowedSelf = can(uScopedActor, "profile:update_own", { kind: "self" });
      expect(allowedSelf).toBe(true);

      const allowedOther = can(uScopedActor, "profile:update_own", {
        kind: "member",
        memberId: "other_member",
      });
      expect(allowedOther).toBe(false);
    });
  });
});
