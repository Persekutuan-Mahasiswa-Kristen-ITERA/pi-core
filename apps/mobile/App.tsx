import { useCallback, useEffect, useState, type JSX } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ROLES } from "@pi-core/shared";

import { ScreenState } from "./src/components/ScreenState";

import { loadSession, MobileSignInError, saveSession, signInWithGoogle, signOut, type SignedInSession } from "./src/auth/session";
import { AppIcon, type IconName } from "./src/components/AppIcon";
import { AuthScreen } from "./src/auth/AuthScreen";
import { DirectoryScreen } from "./src/screens/DirectoryScreen";
import { IntegrationsScreen } from "./src/screens/IntegrationsScreen";
import {
  AssignmentsScreen,
  PeriodsScreen,
  RolesScreen,
  SettingsScreen,
} from "./src/screens/ManagementScreens";
import {
  ApiError,
  fetchAssignmentStats,
  fetchDashboardSummary,
  fetchMe,
  updateOwnPhone,
  type AssignmentStats,
  type DashboardSummary,
  type OwnProfile,
} from "./src/api/resources";

import { tokens, type AppTab, tabLabels } from "./src/theme/tokens";

/**
 * Demo sign-in writes a fake local session ("demo_super_admin_session_token") and shows the signed-in
 * shell. It exists so the UI can be reviewed on a device without a Google round-trip, so it is
 * enabled **only** in development or when a build opts in explicitly — a release build must never be
 * able to present itself as a signed-in super admin while every API call is in fact unauthenticated.
 */
const DEMO_MODE_ENABLED =
  __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === "true";

type AuthState =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "working" }
  | { kind: "signed-in"; session: SignedInSession }
  | { kind: "error"; message: string };

type ActiveScreen = "tab" | "integrations" | "roles" | "periods" | "assignments" | "settings";

const drawerItems: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: "Dashboard", icon: "home-outline" },
  { label: "Direktori Anggota", icon: "people-outline" },
  { label: "Peran & Akses (RBAC)", icon: "shield-checkmark-outline" },
  { label: "Periode Kepengurusan", icon: "calendar-outline" },
  { label: "Penugasan Pengurus", icon: "briefcase-outline" },
  { label: "Integrasi OIDC Client", icon: "key-outline" },
  { label: "Pengaturan Organisasi", icon: "settings-outline" },
];

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ kind: "checking" });
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("tab");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    void loadSession().then((session) => setAuth(session === null ? { kind: "signed-out" } : { kind: "signed-in", session }));
  }, []);

  const onSignIn = useCallback(async () => {
    setAuth({ kind: "working" });
    try {
      const session = await signInWithGoogle();
      setAuth(session === null ? { kind: "signed-out" } : { kind: "signed-in", session });
    } catch (error) {
      const reason = error instanceof MobileSignInError ? error.reason : "unexpected";
      setAuth({ kind: "error", message: `Tidak bisa masuk (${reason}).` });
    }
  }, []);

  const onDemoSignIn = useCallback(async () => {
    // The demo session is a fake local token: it must never exist in a release build, where it would
    // look like a signed-in super admin while every API call fails. Opt in explicitly instead.
    if (!DEMO_MODE_ENABLED) return;
    setAuth({ kind: "working" });
    const demoSession: SignedInSession = {
      token: "demo_super_admin_session_token",
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
    await saveSession(demoSession);
    setAuth({ kind: "signed-in", session: demoSession });
  }, []);

  const onSignOut = useCallback(async () => {
    setAuth({ kind: "working" });
    await signOut();
    setAuth({ kind: "signed-out" });
  }, []);

  if (auth.kind !== "signed-in") {
    return (
      <AuthScreen
        errorMessage={auth.kind === "error" ? auth.message : undefined}
        loading={auth.kind === "checking" || auth.kind === "working"}
        onGooglePress={() => void onSignIn()}
        {...(DEMO_MODE_ENABLED ? { onDemoPress: () => void onDemoSignIn() } : {})}
      />
    );
  }

  const getScreenTitle = () => {
    if (activeScreen === "integrations") return "Integrasi SSO & OIDC";
    if (activeScreen === "roles") return "Peran & Hak Akses";
    if (activeScreen === "periods") return "Periode Kepengurusan";
    if (activeScreen === "assignments") return "Penugasan Pengurus";
    if (activeScreen === "settings") return "Pengaturan Organisasi";
    if (activeTab === "home") return "Dashboard";
    return tabLabels[activeTab];
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#2D1E0C" />
      <View style={styles.app}>
        {/* Modern App Header */}
        <View style={styles.header}>
          <Pressable accessibilityLabel="Buka menu" hitSlop={10} onPress={() => setDrawerOpen(true)} style={styles.iconButton}>
            <Ionicons name="menu" size={24} color={tokens.colors.white} />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.headerTitle}>{getScreenTitle()}</Text>
            <Text style={styles.headerSubtitle}>PI-CORE · PMK ITERA</Text>
          </View>
          <Pressable
            accessibilityLabel="Dashboard"
            hitSlop={10}
            onPress={() => { setActiveScreen("tab"); setActiveTab("home"); }}
            style={styles.iconButton}
          >
            <Ionicons name="notifications-outline" size={22} color={tokens.colors.white} />
          </Pressable>
        </View>

        {/* Screen Routing */}
        {activeScreen === "integrations" ? (
          <IntegrationsScreen />
        ) : activeScreen === "roles" ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <RolesScreen />
          </ScrollView>
        ) : activeScreen === "periods" ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <PeriodsScreen />
          </ScrollView>
        ) : activeScreen === "assignments" ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <AssignmentsScreen />
          </ScrollView>
        ) : activeScreen === "settings" ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SettingsScreen />
          </ScrollView>
        ) : activeTab === "directory" ? (
          <DirectoryScreen />
        ) : activeTab === "home" ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Dashboard onOpenDirectory={() => setActiveTab("directory")} />
          </ScrollView>
        ) : activeTab === "reports" ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ReportsScreen />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ProfileScreen onSignOut={() => void onSignOut()} />
          </ScrollView>
        )}

        {/* Modern Bottom Navigation */}
        <View accessibilityLabel="Navigasi utama" style={styles.bottomNav}>
          {(Object.keys(tabLabels) as AppTab[]).map((tab) => {
            const isSelected = activeScreen === "tab" && activeTab === tab;
            return (
              <Pressable
                accessibilityLabel={tabLabels[tab]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                key={tab}
                onPress={() => {
                  setActiveScreen("tab");
                  setActiveTab(tab);
                }}
                style={styles.navItem}
              >
                <AppIcon name={tab} active={isSelected} size={22} />
                <Text style={[styles.navLabel, isSelected && styles.navLabelActive]}>
                  {tabLabels[tab]}
                </Text>
                {isSelected && <View style={styles.navDot} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Modern Drawer Modal */}
      <Modal animationType="slide" transparent visible={drawerOpen} onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerBackdrop}>
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.brandIconCircle}>
                  <Ionicons name="sparkles" size={18} color="#2D1E0C" />
                </View>
                <View>
                  <Text style={styles.drawerBrand}>PI-CORE</Text>
                  <Text style={styles.drawerSub}>PMK ITERA Portal</Text>
                </View>
              </View>
              <Pressable accessibilityLabel="Tutup menu" onPress={() => setDrawerOpen(false)} style={styles.drawerClose}>
                <Ionicons name="close" size={24} color="#2D1E0C" />
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {drawerItems.map((item, index) => {
                const isItemActive =
                  (index === 0 && activeScreen === "tab" && activeTab === "home") ||
                  (index === 1 && activeScreen === "tab" && activeTab === "directory") ||
                  (index === 2 && activeScreen === "roles") ||
                  (index === 3 && activeScreen === "periods") ||
                  (index === 4 && activeScreen === "assignments") ||
                  (index === 5 && activeScreen === "integrations") ||
                  (index === 6 && activeScreen === "settings");

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item.label}
                    onPress={() => {
                      setDrawerOpen(false);
                      if (index === 0) { setActiveScreen("tab"); setActiveTab("home"); }
                      else if (index === 1) { setActiveScreen("tab"); setActiveTab("directory"); }
                      else if (index === 2) { setActiveScreen("roles"); }
                      else if (index === 3) { setActiveScreen("periods"); }
                      else if (index === 4) { setActiveScreen("assignments"); }
                      else if (index === 5) { setActiveScreen("integrations"); }
                      else if (index === 6) { setActiveScreen("settings"); }
                    }}
                    style={[styles.drawerItem, isItemActive && styles.drawerItemActive]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Ionicons name={item.icon} size={20} color={isItemActive ? tokens.colors.brown : "#4A3215"} />
                      <Text style={[styles.drawerItemText, isItemActive && styles.drawerItemTextActive]}>
                        {item.label}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="rgba(74, 50, 21, 0.4)" />
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable onPress={() => void onSignOut()} style={styles.drawerSignOut}>
              <Ionicons name="log-out-outline" size={18} color={tokens.colors.danger} />
              <Text style={styles.drawerSignOutText}>Keluar Akun</Text>
            </Pressable>
          </View>
          <Pressable accessibilityLabel="Tutup drawer" onPress={() => setDrawerOpen(false)} style={styles.backdropPressable} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Dashboard({ onOpenDirectory }: { onOpenDirectory: () => void }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void fetchDashboardSummary()
      .then(setSummary)
      .catch(() => setFailed(true));
  }, []);

  // Three states, never a guess: still loading, could not load, or the real count.
  const placeholder = failed ? "—" : "…";
  const memberValue =
    summary === null ? placeholder : `${String(summary.memberCount)}${summary.memberCountIsFloor ? "+" : ""}`;
  const periodValue = summary === null ? placeholder : (summary.activePeriodLabel ?? "Belum ada");
  const roleValue = summary === null ? placeholder : `${String(summary.roleCount)} Peran`;
  const permissionValue =
    summary === null
      ? failed
        ? "Tidak dapat dimuat"
        : "Memuat…"
      : `${String(summary.permissionCount)} izin pada peran aktif`;

  return (
    <>
      <View style={styles.welcome}>
        <Text style={styles.welcomeEyebrow}>PORTAL RESMI PMK ITERA</Text>
        <Text style={styles.welcomeTitle}>Shalom, Admin!</Text>
        <Text style={styles.welcomeBody}>
          Kelola seluruh anggota, peran otorisasi, dan penugasan jabatan dari satu genggaman.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Ringkasan Sistem</Text>
      <View style={styles.statGrid}>
        <StatCard
          label="Total Anggota"
          value={memberValue}
          delta={
            summary === null
              ? failed
                ? "Tidak dapat dimuat"
                : "Memuat…"
              : `${String(summary.activeMemberCount)} aktif`
          }
          icon="people"
        />
        <StatCard
          label="Periode Kepengurusan"
          value={periodValue}
          delta={summary === null ? (failed ? "Tidak dapat dimuat" : "Memuat…") : "Sedang berjalan"}
          icon="calendar"
        />
        <StatCard label="Peran Otorisasi (RBAC)" value={roleValue} delta={permissionValue} icon="shield-checkmark" />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Akses Cepat</Text>
        <Pressable onPress={onOpenDirectory}>
          <Text style={styles.seeAll}>Buka Direktori →</Text>
        </Pressable>
      </View>

      <View style={styles.quickCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="people" size={20} color={tokens.colors.brown} />
          <Text style={styles.quickTitle}>Direktori Anggota</Text>
        </View>
        <Text style={styles.quickBody}>
          Cari dan lihat informasi kontak pengurus, mahasiswa ITERA, serta status penugasan unit.
        </Text>
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={onOpenDirectory}>
          <Text style={styles.primaryButtonText}>Buka Direktori Anggota</Text>
        </Pressable>
      </View>
    </>
  );
}

function ReportsScreen() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [assignments, setAssignments] = useState<AssignmentStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void Promise.all([fetchDashboardSummary(), fetchAssignmentStats()])
      .then(([dashboard, stats]) => {
        setSummary(dashboard);
        setAssignments(stats);
      })
      .catch(() => setFailed(true));
  }, []);

  const units = summary?.unitsByType ?? {};
  const countOf = (type: string): string => {
    if (summary === null) return failed ? "—" : "…";
    return `${String(units[type] ?? 0)} unit`;
  };

  // "3 unit · 12 penugasan", counted server-side so it is a total, not one page of one.
  const detailOf = (type: string): string => {
    if (summary === null || assignments === null) {
      return failed ? "Tidak dapat dimuat" : "Memuat…";
    }
    return `${String(assignments.byUnitType[type] ?? 0)} penugasan`;
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.sectionTitle}>Laporan Struktur Organisasi</Text>
      <Text style={{ color: tokens.colors.muted, fontSize: 13, lineHeight: 18 }}>
        Struktur resmi organisasi PMK ITERA berdasarkan ADR-0002, dihitung dari unit dan penugasan yang
        terdaftar.
      </Text>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>BADAN PENGURUS HARIAN (BPH)</Text>
        <Text style={styles.statValue}>{countOf("bph")}</Text>
        <Text style={{ color: tokens.colors.body, fontSize: 12.5, marginTop: 4 }}>
          {detailOf("bph")} — Ketua Umum, Wakil Ketua, Sekretaris Umum, Bendahara Umum.
        </Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>DEPARTEMEN</Text>
        <Text style={styles.statValue}>{countOf("department")}</Text>
        <Text style={{ color: tokens.colors.body, fontSize: 12.5, marginTop: 4 }}>
          {detailOf("department")} — unit pelaksana di bawah BPH.
        </Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>BIRO</Text>
        <Text style={styles.statValue}>{countOf("bureau")}</Text>
        <Text style={{ color: tokens.colors.body, fontSize: 12.5, marginTop: 4 }}>
          {detailOf("bureau")} — unit setingkat departemen dengan fungsi pendukung.
        </Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>DIVISI OPERASIONAL</Text>
        <Text style={styles.statValue}>{countOf("division")}</Text>
        <Text style={{ color: tokens.colors.body, fontSize: 12.5, marginTop: 4 }}>
          {detailOf("division")} — divisi di bawah departemen atau biro.
        </Text>
      </View>
    </View>
  );
}

function ProfileScreen({ onSignOut }: { onSignOut: () => void }) {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "offline" | "unauthorized" | "error">("loading");

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const me = await fetchMe();
      setProfile(me);
      setPhone(me.member.phone ?? "");
      setState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState("unauthorized");
        return;
      }
      setState(error instanceof ApiError ? "error" : "offline");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePhone(): Promise<void> {
    if (profile === null) return;
    setBusy(true);
    setWriteError(null);
    try {
      await updateOwnPhone(profile.member.id, phone.trim());
      setNotice("Nomor WhatsApp disimpan.");
      setEditing(false);
      await load();
    } catch (error) {
      // The API decides what a member may change; a refusal is shown, never swallowed.
      setWriteError(error instanceof ApiError && error.status === 403 ? "Server menolak perubahan ini." : "Gagal menyimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const member = profile?.member ?? null;
  const initials =
    member === null
      ? "…"
      : member.fullName
          .split(" ")
          .slice(0, 2)
          .map((part) => part.slice(0, 1).toUpperCase())
          .join("");

  const field = (label: string, value: string | null): JSX.Element => (
    <View style={styles.profileRow}>
      <Text style={styles.profileField}>{label}</Text>
      <Text style={styles.profileValue}>{value === null || value === "" ? "Belum diisi" : value}</Text>
    </View>
  );

  return (
    <View style={{ gap: 14 }}>
      {state !== "ready" ? (
        <ScreenState kind={state} onRetry={() => void load()} />
      ) : (
        <>
          <View style={{ alignItems: "center", paddingVertical: 18 }}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{initials}</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: tokens.colors.heading, marginTop: 10 }}>
              {member?.fullName ?? "—"}
            </Text>
            <Text style={{ fontSize: 12.5, color: tokens.colors.muted, marginTop: 2 }}>
              {member?.email ?? ""}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, justifyContent: "center" }}>
              {(profile?.roles ?? []).map((role) => (
                <View key={role} style={styles.roleBadgeContainer}>
                  <Ionicons name="shield-checkmark" size={13} color="#2563eb" />
                  <Text style={styles.roleBadgeText}>{roleLabel(role)}</Text>
                </View>
              ))}
            </View>
          </View>

          {notice !== null ? (
            <Text style={{ color: tokens.colors.success, fontSize: 12.5, textAlign: "center" }}>{notice}</Text>
          ) : null}

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>IDENTITAS AKADEMIK &amp; KONTAK</Text>
            <View style={{ gap: 10, marginTop: 10 }}>
              {field("NIM ITERA", member?.nim ?? null)}
              {field("Program Studi", member?.studyProgram ?? null)}
              {field("Fakultas", member?.faculty ?? null)}
              {field("Tahun Angkatan", member?.cohortYear === null || member?.cohortYear === undefined ? null : String(member.cohortYear))}
              {field("Email ITERA", member?.email ?? null)}
              {field("Nomor WhatsApp", member?.phone ?? null)}
              {field("Status Keanggotaan", member?.status === "active" ? "Aktif" : member?.status === "inactive" ? "Nonaktif" : null)}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            style={styles.editContactButton}
            onPress={() => {
              setWriteError(null);
              setNotice(null);
              setEditing(true);
            }}
          >
            <Ionicons name="create-outline" size={17} color={tokens.colors.brown} />
            <Text style={styles.editContactText}>Perbarui Kontak WhatsApp</Text>
          </Pressable>
        </>
      )}

      <Pressable accessibilityRole="button" style={styles.signOutButton} onPress={onSignOut}>
        <Ionicons name="log-out-outline" size={17} color={tokens.colors.white} />
        <Text style={styles.signOutText}>Keluar dari Aplikasi</Text>
      </Pressable>

      {editing && (
        <Modal animationType="fade" transparent visible={editing} onRequestClose={() => setEditing(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 24 }}>
            <View style={{ backgroundColor: tokens.colors.white, borderRadius: 16, padding: 24, gap: 14 }}>
              <Text style={styles.sectionTitle}>Ubah Nomor WhatsApp</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                style={{ borderWidth: 1, borderColor: tokens.colors.warmBorder, borderRadius: 8, padding: 12, fontSize: 14 }}
                placeholder="+62 8..."
                keyboardType="phone-pad"
              />
              <Text style={{ fontSize: 11.5, color: tokens.colors.muted }}>
                Anda hanya dapat mengubah nomor sendiri. Nama, email dan NIM diubah admin.
              </Text>
              {writeError !== null && <Text style={{ color: tokens.colors.danger, fontSize: 12 }}>{writeError}</Text>}
              <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <Pressable style={{ padding: 10 }} onPress={() => setEditing(false)}>
                  <Text style={{ color: tokens.colors.muted }}>Batal</Text>
                </Pressable>
                <Pressable
                  style={{ backgroundColor: tokens.colors.brown, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
                  onPress={() => void savePhone()}
                  disabled={busy}
                >
                  <Text style={{ color: tokens.colors.white, fontWeight: "700" }}>
                    {busy ? "Menyimpan…" : "Simpan"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

/** Role keys are snake_case (`super_admin`); the matrix already carries a display name. */
function roleLabel(key: string): string {
  const definition = ROLES.find((role) => role.key === key);
  return definition?.name ?? key;
}

function StatCard({ label, value, delta, icon }: { label: string; value: string; delta: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Ionicons name={icon} size={16} color={tokens.colors.muted} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statDelta}>{delta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#2D1E0C" },
  app: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    backgroundColor: "#2D1E0C",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(230, 198, 92, 0.15)",
  },
  headerTitle: { color: tokens.colors.white, fontSize: 17, fontWeight: "800" },
  headerSubtitle: { color: tokens.colors.gold, fontSize: 10.5, fontWeight: "600", marginTop: 2, letterSpacing: 0.5 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: tokens.spacing.screen, paddingBottom: 28, gap: 14 },
  welcome: {
    backgroundColor: "#2D1E0C",
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    marginHorizontal: -tokens.spacing.screen,
    marginTop: -tokens.spacing.screen,
    paddingHorizontal: tokens.spacing.screen + 4,
    paddingTop: 20,
    paddingBottom: 28,
  },
  welcomeEyebrow: { color: tokens.colors.gold, fontSize: 11, letterSpacing: 1, fontWeight: "700" },
  welcomeTitle: { color: tokens.colors.white, fontSize: 24, fontWeight: "800", marginTop: 4 },
  welcomeBody: { color: "rgba(255, 255, 255, 0.8)", fontSize: 13, lineHeight: 19, marginTop: 6 },
  sectionTitle: { color: tokens.colors.heading, fontSize: 17, fontWeight: "800" },
  statGrid: { gap: 10 },
  statCard: {
    backgroundColor: tokens.colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statLabel: { color: tokens.colors.muted, fontSize: 11.5, fontWeight: "700", textTransform: "uppercase" },
  statValue: { color: tokens.colors.heading, fontSize: 22, fontWeight: "800", marginTop: 4 },
  statDelta: { fontSize: 12, color: tokens.colors.success, fontWeight: "600", marginTop: 4 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  seeAll: { color: tokens.colors.accent, fontSize: 13, fontWeight: "700" },
  quickCard: {
    backgroundColor: tokens.colors.white,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  quickTitle: { color: tokens.colors.heading, fontSize: 16, fontWeight: "700" },
  quickBody: { color: tokens.colors.body, fontSize: 13, lineHeight: 19, marginTop: 6 },
  primaryButton: {
    backgroundColor: tokens.colors.brown,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 14,
  },
  primaryButtonText: { color: tokens.colors.white, fontSize: 13.5, fontWeight: "700" },
  bottomNav: {
    backgroundColor: tokens.colors.white,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingBottom: 8,
  },
  navItem: { minHeight: 46, minWidth: 64, alignItems: "center", justifyContent: "center", gap: 2 },
  navLabel: { color: tokens.colors.muted, fontSize: 11, fontWeight: "500" },
  navLabelActive: { color: tokens.colors.brown, fontWeight: "700" },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: tokens.colors.brown, marginTop: 2 },
  drawerBackdrop: { flex: 1, flexDirection: "row", backgroundColor: "rgba(15,23,42,0.45)" },
  drawer: { width: 280, backgroundColor: "#FFFBF2", padding: 20, paddingTop: 45 },
  backdropPressable: { flex: 1 },
  drawerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(90,62,27,0.1)" },
  brandIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: tokens.colors.gold, alignItems: "center", justifyContent: "center" },
  drawerBrand: { color: "#2D1E0C", fontSize: 18, fontWeight: "800" },
  drawerSub: { color: tokens.colors.accent, fontSize: 11, fontWeight: "600" },
  drawerClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  drawerItem: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, paddingHorizontal: 12, marginBottom: 4 },
  drawerItemActive: { backgroundColor: "rgba(230, 198, 92, 0.3)" },
  drawerItemText: { color: "#3D2810", fontSize: 14, fontWeight: "600" },
  drawerItemTextActive: { color: "#2D1E0C", fontWeight: "800" },
  drawerSignOut: { marginTop: 14, borderTopWidth: 1, borderTopColor: "rgba(90,62,27,0.1)", paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  drawerSignOutText: { color: tokens.colors.danger, fontSize: 14, fontWeight: "700" },
  profileAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(230, 198, 92, 0.25)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: tokens.colors.gold },
  profileAvatarText: { fontSize: 26, fontWeight: "800", color: tokens.colors.brown },
  roleBadgeContainer: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(37, 99, 235, 0.08)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 6 },
  roleBadgeText: { fontSize: 12, color: "#1d4ed8", fontWeight: "700" },
  profileRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  profileField: { color: tokens.colors.muted, fontSize: 12.5 },
  profileValue: { color: tokens.colors.heading, fontSize: 13, fontWeight: "700" },
  editContactButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: tokens.colors.white, borderWidth: 1, borderColor: tokens.colors.warmBorder, borderRadius: tokens.radius.pill, paddingVertical: 12 },
  editContactText: { color: tokens.colors.brown, fontSize: 13.5, fontWeight: "700" },
  signOutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: tokens.colors.danger, borderRadius: tokens.radius.pill, paddingVertical: 12 },
  signOutText: { color: tokens.colors.white, fontSize: 13.5, fontWeight: "700" },
});
