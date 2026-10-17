import { Pressable, StyleSheet, Text, View } from "react-native";

import { tokens } from "../theme/tokens";

type ScreenStateKind = "loading" | "error" | "forbidden" | "offline";

const copy: Record<ScreenStateKind, { title: string; body: string }> = {
  loading: { title: "Memuat data…", body: "Mohon tunggu sebentar." },
  error: { title: "Data belum tersedia", body: "Terjadi kendala saat mengambil data." },
  forbidden: { title: "Akses ditolak", body: "Anda tidak memiliki izin untuk melihat halaman ini." },
  offline: { title: "Tidak ada koneksi", body: "Periksa koneksi internet lalu coba lagi." },
};

export function ScreenState({ kind, onRetry }: { kind: ScreenStateKind; onRetry?: () => void }) {
  const text = copy[kind];
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.body}>{text.body}</Text>
      {kind !== "loading" && onRetry ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Coba lagi" onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>Coba lagi</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 420, alignItems: "center", justifyContent: "center", gap: tokens.spacing.sm, padding: tokens.spacing.screen },
  title: { color: tokens.colors.heading, fontSize: tokens.typography.title, fontWeight: "700", textAlign: "center" },
  body: { color: tokens.colors.body, fontSize: tokens.typography.body, textAlign: "center" },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 24, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.brown, marginTop: tokens.spacing.sm },
  retryText: { color: tokens.colors.white, fontSize: tokens.typography.body, fontWeight: "700" },
});
