import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenState } from "../components/ScreenState";
import { checkApiHealth } from "../api/client";
import { tokens } from "../theme/tokens";

type DirectoryTab = "Members" | "Roles" | "Periods";

type Member = { name: string; role: string; period: string };

const members: Member[] = [
  { name: "Jonathan Sitorus", role: "Super Admin", period: "2026/2027" },
  { name: "Maria Simanjuntak", role: "Kepala Departemen", period: "2026/2027" },
  { name: "Daniel Sembiring", role: "Sekretaris", period: "2026/2027" },
  { name: "Ruth Lumbantobing", role: "Staff", period: "2026/2027" },
  { name: "Samuel Sinaga", role: "Anggota", period: "2026/2027" },
];

export function DirectoryScreen({ canManage = true }: { canManage?: boolean }) {
  const [tab, setTab] = useState<DirectoryTab>("Members");
  const [viewState, setViewState] = useState<"ready" | "loading" | "error" | "forbidden" | "offline">("loading");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("2026/2027");
  const [roleFilter, setRoleFilter] = useState("Semua");

  const filteredMembers = useMemo(() => members.filter((member) => {
    const matchesQuery = member.name.toLowerCase().includes(query.toLowerCase());
    const matchesPeriod = period === "Semua" || member.period === period;
    const matchesRole = roleFilter === "Semua" || member.role === roleFilter;
    return matchesQuery && matchesPeriod && matchesRole;
  }), [period, query, roleFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    void checkApiHealth(controller.signal).then(() => setViewState("ready")).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return;
      setViewState(error instanceof Error && error.name === "ApiHealthError" ? "error" : "offline");
    }).finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  function retryHealthCheck() {
    setViewState("loading");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    void checkApiHealth(controller.signal).then(() => setViewState("ready")).catch((error: unknown) => {
      if (!(error instanceof Error && error.name === "AbortError")) setViewState("offline");
    }).finally(() => clearTimeout(timeout));
  }

  if (viewState !== "ready") {
    return <ScreenState kind={viewState} onRetry={retryHealthCheck} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(["Members", "Roles", "Periods"] as DirectoryTab[]).map((item) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            key={item}
            onPress={() => setTab(item)}
            style={[styles.tab, tab === item && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "Members" ? (
        <>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon} accessibilityLabel="Cari">⌕</Text>
            <TextInput
              accessibilityLabel="Cari anggota"
              onChangeText={setQuery}
              placeholder="Cari anggota..."
              placeholderTextColor={tokens.colors.muted}
              style={styles.searchInput}
              value={query}
            />
          </View>
          <View style={styles.filterRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Filter periode, saat ini ${period}`} accessibilityHint="Ketuk untuk mengganti filter periode" onPress={() => setPeriod(period === "2026/2027" ? "Semua" : "2026/2027")} style={styles.filterChip}>
              <Text style={styles.filterText}>Periode: {period}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Filter peran, saat ini ${roleFilter}`} accessibilityHint="Ketuk untuk mengganti filter peran" onPress={() => setRoleFilter(roleFilter === "Semua" ? "Staff" : "Semua")} style={styles.filterChip}>
              <Text style={styles.filterText}>Peran: {roleFilter}</Text>
            </Pressable>
          </View>
          {canManage ? (
            <Pressable accessibilityRole="button" onPress={() => undefined} style={styles.createButton}>
              <Text style={styles.createButtonText}>+ Tambah Anggota</Text>
            </Pressable>
          ) : (
            <View style={styles.forbiddenBanner}><Text style={styles.forbiddenText}>Anda tidak memiliki izin mengelola anggota.</Text></View>
          )}
          <View style={styles.listCard}>
            {filteredMembers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Anggota tidak ditemukan</Text>
                <Text style={styles.emptyBody}>Coba ubah kata kunci atau filter.</Text>
              </View>
            ) : filteredMembers.map((member) => (
              <View key={member.name} style={styles.memberRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{member.name.slice(0, 1)}</Text></View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberMeta}>{member.role} · {member.period}</Text>
                </View>
                <View style={styles.actions}>
                  {canManage ? <>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Ubah ${member.name}`} accessibilityHint="Membuka formulir ubah anggota" hitSlop={8} onPress={() => undefined} style={styles.actionButton}><Text style={styles.actionText}>✎</Text></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Nonaktifkan ${member.name}`} accessibilityHint="Memulai konfirmasi nonaktifkan anggota" hitSlop={8} onPress={() => undefined} style={styles.actionButton}><Text style={styles.deleteText}>×</Text></Pressable>
                  </> : null}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>{tab}</Text>
          <Text style={styles.placeholderBody}>{tab === "Roles" ? "Daftar roles akan tersedia di story berikutnya." : "Daftar periode akan tersedia di story berikutnya."}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { gap: tokens.spacing.md, padding: tokens.spacing.screen, paddingBottom: 28 },
  demoStateRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  demoLabel: { color: tokens.colors.muted, fontSize: tokens.typography.meta },
  demoState: { color: tokens.colors.accent, fontSize: tokens.typography.meta, fontWeight: "700" },
  permissionToggle: { minHeight: 36, justifyContent: "center", alignItems: "center", borderRadius: tokens.radius.small, backgroundColor: tokens.colors.white, borderWidth: 1, borderColor: tokens.colors.warmBorder },
  statePanel: { minHeight: 420, alignItems: "center", justifyContent: "center", gap: tokens.spacing.sm, padding: tokens.spacing.screen },
  retryButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 24, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.brown, marginTop: 8 },
  retryText: { color: tokens.colors.white, fontSize: tokens.typography.body, fontWeight: "700" },
  forbiddenBanner: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: tokens.radius.small, backgroundColor: tokens.colors.warmTint, borderWidth: 1, borderColor: tokens.colors.warmBorder },
  forbiddenText: { color: tokens.colors.danger, fontSize: tokens.typography.small },
  tabs: { flexDirection: "row", justifyContent: "center", gap: 26, minHeight: 44, alignItems: "center" },
  tab: { minHeight: 44, justifyContent: "center", paddingHorizontal: 3, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: tokens.colors.accent },
  tabText: { color: tokens.colors.muted, fontSize: tokens.typography.screenTitle, fontWeight: "600" },
  tabTextActive: { color: tokens.colors.accent, fontWeight: "700" },
  searchBox: { height: 44, borderRadius: tokens.radius.card, backgroundColor: tokens.colors.warmTint, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: tokens.colors.warmBorder },
  searchIcon: { color: tokens.colors.muted, fontSize: 22, marginRight: 8 },
  searchInput: { flex: 1, color: tokens.colors.body, fontSize: tokens.typography.body, minHeight: 44 },
  filterRow: { flexDirection: "row", gap: tokens.spacing.sm, flexWrap: "wrap" },
  filterChip: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.white, borderWidth: 1, borderColor: tokens.colors.warmBorder },
  filterText: { color: tokens.colors.body, fontSize: tokens.typography.meta },
  createButton: { minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: tokens.radius.card, backgroundColor: tokens.colors.warmTint, borderWidth: 2, borderColor: tokens.colors.warmBorder },
  createButtonText: { color: tokens.colors.brown, fontSize: tokens.typography.body, fontWeight: "700" },
  listCard: { backgroundColor: tokens.colors.white, borderRadius: tokens.radius.card, borderWidth: 1, borderColor: tokens.colors.warmBorder, paddingHorizontal: 12 },
  memberRow: { minHeight: 70, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: tokens.colors.warmBorder, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.gold },
  avatarText: { color: tokens.colors.brown, fontSize: 17, fontWeight: "700" },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { color: tokens.colors.secondaryHeading, fontSize: tokens.typography.body, fontWeight: "700" },
  memberMeta: { color: tokens.colors.muted, fontSize: tokens.typography.meta, marginTop: 4 },
  actions: { flexDirection: "row", gap: 4 },
  actionButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  actionText: { color: tokens.colors.accent, fontSize: 20 },
  deleteText: { color: tokens.colors.danger, fontSize: 23 },
  empty: { padding: 28, alignItems: "center" },
  emptyTitle: { color: tokens.colors.secondaryHeading, fontSize: tokens.typography.body, fontWeight: "700" },
  emptyBody: { color: tokens.colors.muted, fontSize: tokens.typography.small, marginTop: 5 },
  placeholder: { minHeight: 300, justifyContent: "center", alignItems: "center", gap: 8 },
  placeholderTitle: { color: tokens.colors.heading, fontSize: tokens.typography.title, fontWeight: "700" },
  placeholderBody: { color: tokens.colors.body, fontSize: tokens.typography.body, textAlign: "center" },
});
