/**
 * Directory of members, roles and periods — read from the API.
 *
 * This screen used to render five invented people ("Jonathan Sitorus", NIM 121140001 …) and three
 * invented periods while calling itself a directory. Every row now comes from `/api/v1/*` with the
 * stored bearer token, and each failure has its own state: no session, refused, offline, or empty.
 *
 * Fields the API does not return are not shown. `nim` is absent unless the actor holds
 * `member:read_sensitive`; the row says "tidak berhak" rather than leaving a blank that reads as
 * missing data.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenState } from "../components/ScreenState";
import {
  ApiError,
  fetchMembers,
  fetchPeriods,
  fetchRoles,
  type MemberSummary,
  type PeriodSummary,
  type RoleSummary,
} from "../api/resources";
import { useMobileRealtime } from "../realtime/useRealtime";
import { tokens } from "../theme/tokens";

type DirectoryTab = "Members" | "Roles" | "Periods";

type ViewState = "loading" | "ready" | "error" | "forbidden" | "offline" | "unauthorized";

function stateForError(error: unknown): ViewState {
  if (error instanceof ApiError) {
    if (error.status === 401) return "unauthorized";
    if (error.status === 403) return "forbidden";
    return "error";
  }
  // A thrown fetch is a transport failure, not an API answer.
  return "offline";
}

export function DirectoryScreen() {
  const [tab, setTab] = useState<DirectoryTab>("Members");
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [query, setQuery] = useState("");

  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [sensitiveIncluded, setSensitiveIncluded] = useState(true);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);

  const load = useCallback(async (): Promise<void> => {
    setViewState((current) => (current === "ready" ? current : "loading"));
    try {
      const [memberPage, rolePage, periodPage] = await Promise.all([
        fetchMembers(),
        fetchRoles(),
        fetchPeriods(),
      ]);
      setMembers(memberPage.items);
      setSensitiveIncluded(memberPage.sensitiveIncluded);
      setRoles(rolePage.items);
      setPeriods(periodPage.items);
      setViewState("ready");
    } catch (error) {
      setViewState(stateForError(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Any membership/role/period mutation elsewhere invalidates this screen; a reconnect resyncs too.
  const realtime = useMobileRealtime({
    onEvent: (event) => {
      if (
        event.topic.startsWith("members") ||
        event.topic.startsWith("roles") ||
        event.topic.startsWith("periods")
      ) {
        void load();
      }
    },
    onResync: () => void load(),
  });

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return members;
    return members.filter(
      (member) =>
        member.fullName.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle) ||
        (member.nim ?? "").includes(needle),
    );
  }, [members, query]);

  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return roles;
    return roles.filter(
      (role) => role.name.toLowerCase().includes(needle) || role.key.includes(needle),
    );
  }, [roles, query]);

  const activePeriod = periods.find((period) => period.isActive) ?? null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Struktur Organisasi</Text>
          <Text style={styles.title}>Direktori PMK ITERA</Text>
          <Text style={styles.subtitle}>
            {activePeriod === null ? "Belum ada periode aktif." : `Periode aktif: ${activePeriod.label}`}
            {realtime.status === "connected" ? " · tersinkron" : ""}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Muat ulang direktori"
          onPress={() => void load()}
          style={styles.refresh}
        >
          <Ionicons name="refresh" size={18} color={tokens.colors.brown} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(["Members", "Roles", "Periods"] as DirectoryTab[]).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === item }}
            onPress={() => {
              setTab(item);
              setQuery("");
            }}
            style={[styles.tab, tab === item ? styles.tabActive : undefined]}
          >
            <Text style={[styles.tabLabel, tab === item ? styles.tabLabelActive : undefined]}>
              {item === "Members" ? "Anggota" : item === "Roles" ? "Peran" : "Periode"}
            </Text>
          </Pressable>
        ))}
      </View>

      {viewState !== "ready" ? (
        <ScreenState kind={viewState} onRetry={() => void load()} />
      ) : (
        <>
          {tab !== "Periods" ? (
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={tokens.colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder={tab === "Members" ? "Cari nama, email, atau NIM" : "Cari peran atau key"}
                placeholderTextColor={tokens.colors.muted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
          ) : null}

          {tab === "Members" ? (
            <>
              <Text style={styles.countLabel}>
                {`${String(filteredMembers.length)} anggota`}
                {sensitiveIncluded ? "" : " · NIM dibatasi izin"}
              </Text>
              {filteredMembers.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {query === "" ? "Belum ada anggota terdaftar." : "Tidak ada anggota yang cocok."}
                  </Text>
                </View>
              ) : (
                filteredMembers.map((member) => (
                  <View key={member.id} style={styles.row}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{member.fullName.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{member.fullName}</Text>
                      <Text style={styles.rowMeta}>{member.email}</Text>
                      <Text style={styles.rowMeta}>
                        {sensitiveIncluded ? (member.nim ?? "NIM belum diisi") : "NIM tidak berhak dilihat"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        member.status === "active" ? styles.badgeActive : styles.badgeInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          member.status === "active" ? styles.badgeTextActive : styles.badgeTextInactive,
                        ]}
                      >
                        {member.status === "active" ? "Aktif" : "Nonaktif"}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : null}

          {tab === "Roles" ? (
            <>
              <Text style={styles.countLabel}>{`${String(filteredRoles.length)} peran`}</Text>
              {filteredRoles.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {query === "" ? "Belum ada peran." : "Tidak ada peran yang cocok."}
                  </Text>
                </View>
              ) : (
                filteredRoles.map((role) => (
                  <View key={role.id} style={styles.row}>
                    <View style={styles.roleIcon}>
                      <Ionicons name="shield-checkmark" size={16} color={tokens.colors.brown} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{role.name}</Text>
                      <Text style={styles.rowMeta}>{role.key}</Text>
                      <Text style={styles.rowMeta}>{`${String(role.permissions.length)} izin`}</Text>
                    </View>
                    <View style={[styles.badge, role.isSystem ? styles.badgeSystem : styles.badgeCustom]}>
                      <Text style={styles.badgeTextSystem}>{role.isSystem ? "Sistem" : "Kustom"}</Text>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : null}

          {tab === "Periods" ? (
            <>
              <Text style={styles.countLabel}>{`${String(periods.length)} periode`}</Text>
              {periods.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Belum ada periode kepengurusan.</Text>
                </View>
              ) : (
                periods.map((period) => (
                  <View key={period.id} style={styles.row}>
                    <View style={styles.roleIcon}>
                      <Ionicons name="calendar" size={16} color={tokens.colors.brown} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{period.label}</Text>
                      <Text style={styles.rowMeta}>{`${period.startDate} — ${period.endDate}`}</Text>
                    </View>
                    {period.isActive ? (
                      <View style={[styles.badge, styles.badgeActive]}>
                        <Text style={[styles.badgeText, styles.badgeTextActive]}>Aktif</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.colors.cream },
  container: { padding: tokens.spacing.screen, gap: tokens.spacing.md, paddingBottom: 40 },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  eyebrow: {
    color: tokens.colors.accent,
    fontSize: tokens.typography.meta,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    color: tokens.colors.heading,
    fontSize: tokens.typography.title,
    fontWeight: "800",
    marginTop: 2,
  },
  subtitle: { color: tokens.colors.muted, fontSize: tokens.typography.small, marginTop: 4 },
  refresh: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
  },
  tabActive: { backgroundColor: tokens.colors.brown },
  tabLabel: { color: tokens.colors.body, fontSize: tokens.typography.small, fontWeight: "700" },
  tabLabelActive: { color: tokens.colors.white },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.small,
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    color: tokens.colors.heading,
    fontSize: tokens.typography.body,
    paddingVertical: 8,
  },
  countLabel: { color: tokens.colors.muted, fontSize: tokens.typography.small, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
    padding: tokens.spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.warmTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: tokens.colors.brown, fontWeight: "800", fontSize: 16 },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tokens.colors.warmTint,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: tokens.colors.heading, fontSize: tokens.typography.body, fontWeight: "700" },
  rowMeta: { color: tokens.colors.muted, fontSize: tokens.typography.meta, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: tokens.radius.pill, borderWidth: 1 },
  badgeActive: { backgroundColor: "rgba(5,150,105,0.08)", borderColor: "rgba(5,150,105,0.25)" },
  badgeInactive: { backgroundColor: "rgba(100,116,139,0.08)", borderColor: "rgba(100,116,139,0.25)" },
  badgeSystem: { backgroundColor: "rgba(90,62,27,0.08)", borderColor: "rgba(90,62,27,0.25)" },
  badgeCustom: { backgroundColor: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.25)" },
  badgeText: { fontSize: tokens.typography.meta, fontWeight: "700" },
  badgeTextActive: { color: tokens.colors.success },
  badgeTextInactive: { color: tokens.colors.muted },
  badgeTextSystem: { color: tokens.colors.brown, fontSize: tokens.typography.meta, fontWeight: "700" },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { color: tokens.colors.muted, fontSize: tokens.typography.body, textAlign: "center" },
});
