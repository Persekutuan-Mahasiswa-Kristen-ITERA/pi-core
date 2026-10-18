import { useEffect, useRef, useState } from "react";
import type { RealtimeEvent } from "@pi-core/shared";
import { loadSession } from "../auth/session";
import { API_URL } from "../config";

export type MobileRealtimeStatus = "connecting" | "connected" | "disconnected";

export interface UseMobileRealtimeOptions {
  onEvent?: (event: RealtimeEvent) => void;
  onResync?: () => void;
}

export function useMobileRealtime({ onEvent, onResync }: UseMobileRealtimeOptions = {}) {
  const [status, setStatus] = useState<MobileRealtimeStatus>("connecting");
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onResyncRef = useRef(onResync);
  onResyncRef.current = onResync;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1500;
    let isCancelled = false;
    let hasConnectedOnce = false;

    async function connect() {
      if (isCancelled) return;
      setStatus("connecting");

      const session = await loadSession();
      if (session === null) {
        setStatus("disconnected");
        return;
      }

      const wsProtocol = API_URL.startsWith("https") ? "wss:" : "ws:";
      const host = API_URL.replace(/^https?:\/\//, "");
      const url = `${wsProtocol}//${host}/api/v1/realtime/ws?token=${encodeURIComponent(session.token)}`;

      try {
        ws = new WebSocket(url);

        ws.onopen = () => {
          setStatus("connected");
          backoffMs = 1500;
          if (hasConnectedOnce && onResyncRef.current) {
            onResyncRef.current();
          }
          hasConnectedOnce = true;
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(String(msg.data)) as RealtimeEvent;
            if (data && data.topic && onEventRef.current) {
              onEventRef.current(data);
            }
          } catch {
            // Ignore pings or malformed frames
          }
        };

        ws.onerror = () => {
          if (ws) {
            ws.close();
            ws = null;
          }
          setStatus("disconnected");
          scheduleReconnect();
        };

        ws.onclose = () => {
          if (!isCancelled) {
            setStatus("disconnected");
            scheduleReconnect();
          }
        };
      } catch {
        setStatus("disconnected");
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (isCancelled) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        backoffMs = Math.min(backoffMs * 1.5, 12000);
        void connect();
      }, backoffMs);
    }

    void connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  return { status };
}
