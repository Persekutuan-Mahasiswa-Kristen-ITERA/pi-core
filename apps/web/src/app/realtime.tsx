"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import type { RealtimeEvent } from "@pi-core/shared";

export type ConnectionStatus = "connecting" | "connected" | "fallback_sse" | "disconnected";

export interface UseRealtimeOptions {
  apiBaseUrl: string;
  onEvent?: (event: RealtimeEvent) => void;
  token?: string;
}

export function useRealtime({ apiBaseUrl, onEvent, token }: UseRealtimeOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<RealtimeEvent[]>([]);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let sse: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1000;
    let isCancelled = false;

    function handleIncomingEvent(event: RealtimeEvent) {
      setLastEvent(event);
      setEventHistory((prev) => [event, ...prev.slice(0, 19)]);
      if (onEventRef.current) {
        onEventRef.current(event);
      }
    }

    function connectSSE() {
      if (isCancelled) return;
      setStatus("fallback_sse");
      const url = new URL(`${apiBaseUrl}/api/v1/realtime/sse`);
      if (token) url.searchParams.set("token", token);

      try {
        sse = new EventSource(url.toString(), { withCredentials: true });

        sse.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data) as RealtimeEvent;
            handleIncomingEvent(data);
          } catch {
            // Ignore non-json comments/pings
          }
        };

        sse.onerror = () => {
          if (sse) {
            sse.close();
            sse = null;
          }
          setStatus("disconnected");
          scheduleReconnect();
        };
      } catch {
        setStatus("disconnected");
        scheduleReconnect();
      }
    }

    function connectWS() {
      if (isCancelled) return;
      setStatus("connecting");

      const wsProtocol = apiBaseUrl.startsWith("https") ? "wss:" : "ws:";
      const host = apiBaseUrl.replace(/^https?:\/\//, "");
      const url = new URL(`${wsProtocol}//${host}/api/v1/realtime/ws`);
      if (token) url.searchParams.set("token", token);

      try {
        ws = new WebSocket(url.toString());

        ws.onopen = () => {
          setStatus("connected");
          backoffMs = 1000;
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(String(msg.data)) as RealtimeEvent;
            if (data && data.topic) {
              handleIncomingEvent(data);
            }
          } catch {
            // Ignore pings
          }
        };

        ws.onerror = () => {
          // If WebSocket upgrade fails, fall back to SSE
          if (ws) {
            ws.close();
            ws = null;
          }
          connectSSE();
        };

        ws.onclose = () => {
          if (!isCancelled) {
            // If we closed normally or unexpectedly, try reconnecting
            setStatus("disconnected");
            scheduleReconnect();
          }
        };
      } catch {
        connectSSE();
      }
    }

    function scheduleReconnect() {
      if (isCancelled) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        backoffMs = Math.min(backoffMs * 1.5, 10000);
        connectWS();
      }, backoffMs);
    }

    connectWS();

    return () => {
      isCancelled = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
      if (sse) sse.close();
    };
  }, [apiBaseUrl, token]);

  return { status, lastEvent, eventHistory };
}

export function RealtimeStatusIndicator({ status }: { status: ConnectionStatus }): JSX.Element {
  let label = "Menyambungkan…";
  let dotColor = "var(--color-primary-amber, #d97706)";

  if (status === "connected") {
    label = "Live (WebSocket)";
    dotColor = "#10b981"; // green
  } else if (status === "fallback_sse") {
    label = "Live (SSE)";
    dotColor = "#3b82f6"; // blue
  } else if (status === "disconnected") {
    label = "Terputus";
    dotColor = "#ef4444"; // red
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        backgroundColor: "rgba(0, 0, 0, 0.04)",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "var(--color-heading-secondary, #374151)",
      }}
      title={`Status koneksi real-time: ${label}`}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: dotColor,
          display: "inline-block",
          animation: status === "connecting" ? "pulse 1.5s infinite" : "none",
        }}
      />
      <span>{label}</span>
    </div>
  );
}
