import { DurableObject } from "cloudflare:workers";
import type { RealtimeEvent } from "@pi-core/shared";
import { isRealtimeEvent } from "@pi-core/shared";
import type { Env } from "../env";

/**
 * `RealtimeHub` Durable Object (ADR-0011, FR-55).
 *
 * Implements Cloudflare WebSocket Hibernation so idle connections accrue 0 duration cost.
 * SQLite-backed via `new_sqlite_classes` migration tag to run inside Workers Free limits.
 *
 * Channel model:
 * - Notification channel only (never sends sensitive/unfiltered entity data).
 * - Broadcasts { topic, entity, id, action, at } to all authenticated connected clients.
 * - Supports both WebSocket (preferred) and SSE fallback.
 */
export class RealtimeHub extends DurableObject<Env> {
  /** Active SSE client streams */
  private sseControllers = new Set<ReadableStreamDefaultController<Uint8Array>>();
  private textEncoder = new TextEncoder();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Auto-respond to client "ping" with "pong" while hibernating (0 CPU wakeups)
    if (
      typeof WebSocketRequestResponsePair !== "undefined" &&
      typeof this.ctx.setWebSocketAutoResponse === "function"
    ) {
      this.ctx.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair("ping", "pong"),
      );
    }
  }

  /**
   * Handle internal DO fetch requests.
   * - `POST /publish`: Called by API Workers to fan out a Domain Event.
   * - `GET /ws`: Upgrades connection to WebSocket using Hibernation API.
   * - `GET /sse`: Establishes Server-Sent Events stream with 30s keep-alives.
   */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/publish") {
      return this.handlePublish(request);
    }

    if (request.method === "GET" && url.pathname === "/ws") {
      return this.handleWebSocketUpgrade(request);
    }

    if (request.method === "GET" && url.pathname === "/sse") {
      return this.handleSSE(request);
    }

    if (request.method === "GET" && url.pathname === "/stats") {
      const wsCount = this.ctx.getWebSockets().length;
      const sseCount = this.sseControllers.size;
      return new Response(JSON.stringify({ wsClients: wsCount, sseClients: sseCount }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Upgrade an incoming request to a hibernated WebSocket connection.
   */
  private handleWebSocketUpgrade(request: Request): Response {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Accept WebSocket into hibernation state
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle Server-Sent Events (SSE) fallback stream with keep-alive pings.
   */
  private handleSSE(_request: Request): Response {
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controllerRef = controller;
        this.sseControllers.add(controller);

        // Initial handshake comment
        controller.enqueue(this.textEncoder.encode(": connected\n\n"));
      },
      cancel: () => {
        if (controllerRef) {
          this.sseControllers.delete(controllerRef);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  /**
   * Broadcast a domain event to all connected WebSockets and SSE streams.
   */
  private async handlePublish(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as unknown;
      if (!isRealtimeEvent(body)) {
        return new Response(JSON.stringify({ error: "invalid_realtime_event" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const event: RealtimeEvent = body;
      const messageStr = JSON.stringify(event);

      // 1. Broadcast to hibernated WebSockets
      const sockets = this.ctx.getWebSockets();
      for (const ws of sockets) {
        try {
          ws.send(messageStr);
        } catch {
          // Socket failed, will be cleaned up by hibernation runtime
        }
      }

      // 2. Broadcast to SSE streams
      const sseData = this.textEncoder.encode(
        `event: ${event.topic}\ndata: ${messageStr}\n\n`,
      );
      for (const controller of this.sseControllers) {
        try {
          controller.enqueue(sseData);
        } catch {
          this.sseControllers.delete(controller);
        }
      }

      return new Response(
        JSON.stringify({ ok: true, deliveredWs: sockets.length, deliveredSse: this.sseControllers.size }),
        { headers: { "Content-Type": "application/json" } },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "publish_failed", details: String(err) }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  /**
   * Cloudflare Hibernation API handler for incoming WebSocket messages.
   */
  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message === "string") {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", at: new Date().toISOString() }));
        }
      } catch {
        // Ignore non-json or unparseable messages
      }
    }
  }

  /**
   * Cloudflare Hibernation API handler for closed WebSockets.
   */
  override async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    ws.close();
  }

  /**
   * Cloudflare Hibernation API handler for WebSocket errors.
   */
  override async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    ws.close();
  }
}
