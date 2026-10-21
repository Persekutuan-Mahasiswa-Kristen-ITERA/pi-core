import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { authHeaders } from "../auth/session";
import { ScreenState } from "../components/ScreenState";
import { API_URL } from "../config";
import { useMobileRealtime } from "../realtime/useRealtime";
import { tokens } from "../theme/tokens";

type Integration = {
  clientId: string;
  name: string | null;
  redirectUris: string[];
  scopes: string[] | null;
  enabled: boolean;
  status: "connected" | "not_connected" | "disabled";
  lastAuthorizedAt: string | null;
};

type IntegrationState = "loading" | "ready" | "error" | "forbidden" | "offline" | "unauthorized";

export function IntegrationsScreen() {
  const [state, setState] = useState<IntegrationState>("loading");
  const [items, setItems] = useState<Integration[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api/v1/integrations`, { headers });
      // 401 and 403 are different answers and deserve different sentences: an expired session is fixed
      // by signing in again, a refusal is not. Reporting 401 as "data unavailable" sends the reader to
      // retry a request that will never succeed.
      if (response.status === 401) {
        setState("unauthorized");
        return;
      }
      if (response.status === 403) {
        setState("forbidden");
        return;
      }
      if (!response.ok) {
        // A 5xx means the request arrived and failed, which is not the same as no connection — saying
        // "periksa koneksi" for a server error sends the reader to fix something that is not broken.
        setState("error");
        return;
      }
      const body = (await response.json()) as { items?: Integration[] };
      setItems(body.items ?? []);
      setState("ready");
    } catch {
      setState("offline");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useMobileRealtime({
    onEvent: (event) => {
      if (event.topic === "integrations") {
        void load();
      }
    },
    onResync: () => {
      void load();
    },
  });

  if (state !== "ready") return <ScreenState kind={state} onRetry={() => void load()} />;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl onRefresh={() => void load()} refreshing={false} />}
    >
      <Text style={styles.eyebrow}>SSO & OIDC</Text>
      <Text style={styles.title}>Integrasi</Text>
      <Text style={styles.subtitle}>Status koneksi aplikasi dalam 30 hari terakhir.</Text>
      {items.length === 0 ? (
        <View style={styles.empty}><Text style={styles.cardTitle}>Belum ada integrasi</Text><Text style={styles.body}>Integrasi yang terdaftar akan muncul di sini.</Text></View>
      ) : items.map((item) => (
        <View key={item.clientId} style={styles.card}>
          <View style={styles.headingRow}>
            <View style={styles.nameBlock}><Text style={styles.cardTitle}>{item.name ?? "Aplikasi tanpa nama"}</Text><Text style={styles.clientId}>{item.clientId}</Text></View>
            <Text style={[styles.status, styles[item.status]]}>{item.status === "connected" ? "Terhubung" : item.status === "disabled" ? "Nonaktif" : "Belum terhubung"}</Text>
          </View>
          <Text style={styles.label}>Scopes</Text><Text style={styles.body}>{item.scopes?.join(", ") || "—"}</Text>
          <Text style={styles.label}>Terakhir diotorisasi</Text><Text style={styles.body}>{item.lastAuthorizedAt === null ? "Belum pernah" : new Date(item.lastAuthorizedAt).toLocaleString("id-ID")}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.spacing.md, padding: tokens.spacing.screen, paddingBottom: 32 },
  eyebrow: { color: tokens.colors.accent, fontSize: tokens.typography.small, fontWeight: "800", letterSpacing: 0.7 },
  title: { color: tokens.colors.heading, fontSize: tokens.typography.title, fontWeight: "700" },
  subtitle: { color: tokens.colors.muted, fontSize: tokens.typography.body },
  card: { gap: 8, backgroundColor: tokens.colors.white, borderColor: tokens.colors.warmBorder, borderRadius: tokens.radius.card, borderWidth: 1, padding: tokens.spacing.card },
  empty: { gap: 6, backgroundColor: tokens.colors.warmTint, borderColor: tokens.colors.warmBorder, borderRadius: tokens.radius.card, borderWidth: 1, padding: tokens.spacing.card },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  nameBlock: { flex: 1 },
  cardTitle: { color: tokens.colors.secondaryHeading, fontSize: tokens.typography.screenTitle, fontWeight: "700" },
  clientId: { color: tokens.colors.muted, fontSize: tokens.typography.small, marginTop: 3 },
  status: { borderRadius: tokens.radius.pill, fontSize: tokens.typography.small, fontWeight: "800", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  connected: { backgroundColor: "rgba(5,150,105,0.1)", color: tokens.colors.success },
  not_connected: { backgroundColor: tokens.colors.warmTint, color: tokens.colors.accent },
  disabled: { backgroundColor: "rgba(225,29,72,0.1)", color: tokens.colors.danger },
  label: { color: tokens.colors.muted, fontSize: tokens.typography.small, fontWeight: "800", marginTop: 8, textTransform: "uppercase" },
  body: { color: tokens.colors.body, fontSize: tokens.typography.body },
});
