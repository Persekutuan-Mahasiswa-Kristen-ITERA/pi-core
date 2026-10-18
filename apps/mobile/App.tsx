import { useCallback, useEffect, useState } from "react";
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

import { loadSession, MobileSignInError, saveSession, signInWithGoogle, signOut, type SignedInSession } from "./src/auth/session";
import { AppIcon } from "./src/components/AppIcon";
import { AuthScreen } from "./src/auth/AuthScreen";
import { DirectoryScreen } from "./src/screens/DirectoryScreen";
import { IntegrationsScreen } from "./src/screens/IntegrationsScreen";

import { tokens, type AppTab, tabLabels } from "./src/theme/tokens";

type AuthState =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "working" }
  | { kind: "signed-in"; session: SignedInSession }
  | { kind: "error"; message: string };

type ActiveScreen = "tab" | "integrations" | "roles" | "periods" | "assignments" | "settings";

const drawerItems = ["Dashboard", "Members", "Roles", "Periods", "Assignments", "Integrations", "Settings"];

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
        onDemoPress={() => void onDemoSignIn()}
      />
    );
  }

  const getScreenTitle = () => {
    if (activeScreen === "integrations") return "Integrations (OIDC)";
    if (activeScreen === "roles") return "Peran & Akses";
    if (activeScreen === "periods") return "Periode Kepengurusan";
    if (activeScreen === "assignments") return "Penugasan";
    if (activeScreen === "settings") return "Pengaturan Organisasi";
    if (activeTab === "home") return "Dashboard";
    return tabLabels[activeTab];
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={tokens.colors.dashboardBrown} />
      <View style={styles.app}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable accessibilityLabel="Buka menu" hitSlop={10} onPress={() => setDrawerOpen(true)} style={styles.iconButton}>
            <AppIcon name="menu" />
          </Pressable>
          <Text style={styles.headerTitle}>{getScreenTitle()}</Text>
          <Pressable accessibilityLabel="Home" hitSlop={10} onPress={() => { setActiveScreen("tab"); setActiveTab("home"); }} style={styles.iconButton}>
            <AppIcon name="bell" />
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

        {/* Bottom Navigation */}
        <View accessibilityLabel="Navigasi utama" style={styles.bottomNav}>
          {(Object.keys(tabLabels) as AppTab[]).map((tab) => (
            <Pressable
              accessibilityLabel={tabLabels[tab]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeScreen === "tab" && activeTab === tab }}
              key={tab}
              onPress={() => {
                setActiveScreen("tab");
                setActiveTab(tab);
              }}
              style={styles.navItem}
            >
              <AppIcon name={tab} active={activeScreen === "tab" && activeTab === tab} />
              <Text style={[styles.navLabel, activeScreen === "tab" && activeTab === tab && styles.navLabelActive]}>
                {tabLabels[tab]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Drawer Modal */}
      <Modal animationType="slide" transparent visible={drawerOpen} onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerBackdrop}>
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerBrand}>PI-CORE</Text>
              <Pressable accessibilityLabel="Tutup menu" onPress={() => setDrawerOpen(false)} style={styles.drawerClose}>
                <AppIcon name="close" />
              </Pressable>
            </View>
            {drawerItems.map((item, index) => (
              <Pressable
                accessibilityRole="button"
                key={item}
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
                style={[
                  styles.drawerItem,
                  ((index === 0 && activeScreen === "tab" && activeTab === "home") ||
                   (index === 1 && activeScreen === "tab" && activeTab === "directory") ||
                   (index === 2 && activeScreen === "roles") ||
                   (index === 3 && activeScreen === "periods") ||
                   (index === 4 && activeScreen === "assignments") ||
                   (index === 5 && activeScreen === "integrations") ||
                   (index === 6 && activeScreen === "settings")) && styles.drawerItemActive
                ]}
              >
                <Text style={styles.drawerItemText}>{item}</Text>
                <AppIcon name="chevron" />
              </Pressable>
            ))}
            <Pressable onPress={() => void onSignOut()} style={styles.drawerSignOut}>
              <Text style={styles.drawerSignOutText}>Keluar</Text>
            </Pressable>
          </View>
          <Pressable accessibilityLabel="Tutup drawer" onPress={() => setDrawerOpen(false)} style={styles.backdropPressable} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Dashboard({ onOpenDirectory }: { onOpenDirectory: () => void }) {
  return (
    <>
      <View style={styles.welcome}>
        <Text style={styles.welcomeEyebrow}>WELCOME BACK</Text>
        <Text style={styles.welcomeTitle}>Shalom, Admin!</Text>
        <Text style={styles.welcomeBody}>Kelola organisasi PMK ITERA dengan mudah.</Text>
      </View>
      <Text style={styles.sectionTitle}>Ringkasan</Text>
      <View style={styles.statGrid}>
        <StatCard label="Total Members" value="128" delta="Terdaftar" positive />
        <StatCard label="Active Period" value="2026/2027" delta="Aktif" positive />
        <StatCard label="Available Roles" value="10" delta="100% System" positive />
      </View>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <Pressable onPress={onOpenDirectory}>
          <Text style={styles.seeAll}>Buka Direktori →</Text>
        </Pressable>
      </View>
      <View style={styles.quickCard}>
        <Text style={styles.quickTitle}>Direktori Anggota</Text>
        <Text style={styles.quickBody}>Cari dan hubungi rekan pengurus serta anggota PMK ITERA.</Text>
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={onOpenDirectory}>
          <Text style={styles.primaryButtonText}>Buka Direktori Anggota</Text>
        </Pressable>
      </View>
    </>
  );
}

function ReportsScreen() {
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.sectionTitle}>Laporan Struktur Organisasi</Text>
      <Text style={{ color: tokens.colors.muted, fontSize: 13 }}>
        Struktur hierarki resmi PMK ITERA berdasarkan ADR-0002.
      </Text>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>BADAN PENGURUS HARIAN (BPH)</Text>
        <Text style={styles.statValue}>1 Unit Pusat</Text>
        <Text style={{ color: tokens.colors.body, fontSize: 12, marginTop: 4 }}>
          Ketua Umum, Wakil Ketua, Sekretaris Umum, Bendahara Umum.
        </Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>DEPARTEMEN & BIRO</Text>
        <Text style={styles.statValue}>8 Unit Pelaksana</Text>
        <Text style={{ color: tokens.colors.body, fontSize: 12, marginTop: 4 }}>
          7 Departemen (Pelayanan, Media, Musik, dll.) + 1 Biro Bendahara.
        </Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>DIVISI OPERASIONAL</Text>
        <Text style={styles.statValue}>16 Divisi</Text>
        <Text style={{ color: tokens.colors.body, fontSize: 12, marginTop: 4 }}>
          Mencakup Divisi Ibadah, Doa, Kreatif, Sound, Humas, dan Harmonisasi.
        </Text>
      </View>
    </View>
  );
}

function ProfileScreen({ onSignOut }: { onSignOut: () => void }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("+62 812-3456-7890");
  const [saved, setSaved] = useState(false);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: tokens.colors.gold, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: tokens.colors.brown }}>FY</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: tokens.colors.heading, marginTop: 10 }}>Febryan Yoel</Text>
        <Text style={{ fontSize: 13, color: tokens.colors.accent, fontWeight: "600" }}>Super Admin (BPH)</Text>
      </View>

      <View style={styles.statCard}>
        <Text style={styles.statLabel}>IDENTITAS ANGGOTA</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={{ color: tokens.colors.body, fontSize: 13 }}>NIM: <Text style={{ fontWeight: "700", color: tokens.colors.heading }}>121140001</Text></Text>
          <Text style={{ color: tokens.colors.body, fontSize: 13 }}>Fakultas: <Text style={{ fontWeight: "700", color: tokens.colors.heading }}>FTI</Text></Text>
          <Text style={{ color: tokens.colors.body, fontSize: 13 }}>Program Studi: <Text style={{ fontWeight: "700", color: tokens.colors.heading }}>Teknik Informatika</Text></Text>
          <Text style={{ color: tokens.colors.body, fontSize: 13 }}>Angkatan: <Text style={{ fontWeight: "700", color: tokens.colors.heading }}>2021</Text></Text>
          <Text style={{ color: tokens.colors.body, fontSize: 13 }}>Email: <Text style={{ fontWeight: "700", color: tokens.colors.heading }}>febryan.admin@itera.ac.id</Text></Text>
          <Text style={{ color: tokens.colors.body, fontSize: 13 }}>Nomor WhatsApp: <Text style={{ fontWeight: "700", color: tokens.colors.heading }}>{phone}</Text></Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => setEditing(true)}>
        <Text style={styles.primaryButtonText}>Ubah Kontak Mandiri</Text>
      </Pressable>

      <Pressable accessibilityRole="button" style={[styles.primaryButton, { backgroundColor: tokens.colors.danger, marginTop: 4 }]} onPress={onSignOut}>
        <Text style={styles.primaryButtonText}>Keluar dari Aplikasi</Text>
      </Pressable>

      {editing && (
        <Modal animationType="fade" transparent visible={editing} onRequestClose={() => setEditing(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
            <View style={{ backgroundColor: tokens.colors.white, borderRadius: 16, padding: 24, gap: 14 }}>
              <Text style={styles.sectionTitle}>Ubah Nomor WhatsApp</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                style={{ borderWidth: 1, borderColor: tokens.colors.warmBorder, borderRadius: 8, padding: 12, fontSize: 14 }}
                placeholder="+62 8..."
              />
              {saved && <Text style={{ color: tokens.colors.success, fontSize: 12 }}>✓ Berhasil disimpan!</Text>}
              <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <Pressable style={{ padding: 10 }} onPress={() => setEditing(false)}>
                  <Text style={{ color: tokens.colors.muted }}>Batal</Text>
                </Pressable>
                <Pressable
                  style={{ backgroundColor: tokens.colors.brown, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
                  onPress={() => {
                    setSaved(true);
                    setTimeout(() => {
                      setSaved(false);
                      setEditing(false);
                    }, 600);
                  }}
                >
                  <Text style={{ color: tokens.colors.white, fontWeight: "700" }}>Simpan</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function RolesScreen() {
  const roles = [
    { name: "Super Admin", scope: "O (Full)", grants: "22 Izin" },
    { name: "Organization Admin", scope: "O (Organisasi)", grants: "17 Izin" },
    { name: "BPH", scope: "O (Organisasi)", grants: "7 Izin" },
    { name: "Kepala Departemen", scope: "U (Subtree)", grants: "7 Izin" },
    { name: "Sekretaris Departemen", scope: "U (Subtree)", grants: "9 Izin" },
    { name: "Kepala Divisi", scope: "U (Divisi)", grants: "6 Izin" },
    { name: "Staff Divisi", scope: "U (Divisi)", grants: "5 Izin" },
    { name: "Bendahara", scope: "U (Biro Kas)", grants: "4 Izin" },
    { name: "Panitia", scope: "U (Event)", grants: "4 Izin" },
    { name: "Anggota Biasa", scope: "S (Mandiri)", grants: "4 Izin" },
  ];
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.sectionTitle}>10 Peran Resmi PMK ITERA</Text>
      {roles.map((r) => (
        <View key={r.name} style={styles.statCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.colors.heading }}>{r.name}</Text>
            <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.colors.accent }}>{r.grants}</Text>
          </View>
          <Text style={{ fontSize: 12, color: tokens.colors.muted, marginTop: 4 }}>Lingkup Otorisasi: {r.scope}</Text>
        </View>
      ))}
    </View>
  );
}

function PeriodsScreen() {
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.sectionTitle}>Periode Kepengurusan</Text>
      <View style={[styles.statCard, { borderColor: tokens.colors.accent, borderWidth: 1 }]}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.colors.success }}>● PERIODE AKTIF</Text>
        <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.colors.heading, marginTop: 4 }}>2026/2027</Text>
        <Text style={{ fontSize: 12, color: tokens.colors.muted }}>01 Agu 2026 s/d 31 Jul 2027</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.colors.muted }}>ARSIP MASA BAKTI</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: tokens.colors.heading, marginTop: 4 }}>2025/2026</Text>
        <Text style={{ fontSize: 12, color: tokens.colors.muted }}>01 Agu 2025 s/d 31 Jul 2026 (Selesai)</Text>
      </View>
    </View>
  );
}

function AssignmentsScreen() {
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.sectionTitle}>Penugasan Pengurus</Text>
      <View style={styles.statCard}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.colors.heading }}>Jonathan Sitorus</Text>
        <Text style={{ fontSize: 12, color: tokens.colors.accent }}>BPH · Ketua Umum (Rank 10)</Text>
        <Text style={{ fontSize: 11, color: tokens.colors.muted, marginTop: 4 }}>Periode 2026/2027 · Aktif</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.colors.heading }}>Daniel Hutapea</Text>
        <Text style={{ fontSize: 12, color: tokens.colors.accent }}>Divisi Ibadah · Kepala Divisi (Rank 60)</Text>
        <Text style={{ fontSize: 11, color: tokens.colors.muted, marginTop: 4 }}>Periode 2026/2027 · Aktif</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.colors.heading }}>Grace Lumbantoruan</Text>
        <Text style={{ fontSize: 12, color: tokens.colors.accent }}>Divisi Media & Kreatif · Staff (Rank 70)</Text>
        <Text style={{ fontSize: 11, color: tokens.colors.muted, marginTop: 4 }}>Periode 2026/2027 · Aktif</Text>
      </View>
    </View>
  );
}

function SettingsScreen() {
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.sectionTitle}>Pengaturan Organisasi</Text>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>PROFIL ORGANISASI</Text>
        <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.colors.heading, marginTop: 4 }}>PMK ITERA</Text>
        <Text style={{ fontSize: 12, color: tokens.colors.muted, marginTop: 2 }}>Persekutuan Mahasiswa Kristen Institut Teknologi Sumatera</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>DOMAIN EMAIL DIIZINKAN</Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.colors.accent, marginTop: 4 }}>@itera.ac.id, @student.itera.ac.id</Text>
        <Text style={{ fontSize: 11, color: tokens.colors.muted, marginTop: 2 }}>Hanya akun berdomain resmi yang diizinkan masuk.</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value, delta, positive }: { label: string; value: string; delta: string; positive: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statDelta, positive ? styles.positive : styles.negative]}>{delta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.colors.cream },
  app: { flex: 1, backgroundColor: tokens.colors.cream },
  header: { backgroundColor: tokens.colors.dashboardBrown, paddingHorizontal: tokens.spacing.screen, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: tokens.colors.white, fontSize: tokens.typography.screenTitle, fontWeight: "700" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: tokens.spacing.screen, paddingBottom: 24, gap: tokens.spacing.md },
  welcome: { backgroundColor: tokens.colors.dashboardBrown, borderBottomLeftRadius: 124, marginHorizontal: -tokens.spacing.screen, marginTop: -tokens.spacing.screen, paddingHorizontal: tokens.spacing.screen, paddingTop: 24, paddingBottom: 34 },
  welcomeEyebrow: { color: tokens.colors.welcomeEyebrow, fontSize: tokens.typography.small, letterSpacing: 0.7 },
  welcomeTitle: { color: tokens.colors.white, fontSize: tokens.typography.title, fontWeight: "700", marginTop: 5 },
  welcomeBody: { color: tokens.colors.welcomeBody, fontSize: tokens.typography.body, marginTop: 7 },
  sectionTitle: { color: tokens.colors.heading, fontSize: tokens.typography.screenTitle, fontWeight: "700" },
  statGrid: { gap: tokens.spacing.sm },
  statCard: { backgroundColor: tokens.colors.white, borderRadius: tokens.radius.card, padding: tokens.spacing.card, shadowColor: tokens.colors.black, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  statLabel: { color: tokens.colors.muted, fontSize: tokens.typography.small },
  statValue: { color: tokens.colors.heading, fontSize: 21, fontWeight: "700", marginTop: 7 },
  statDelta: { fontSize: tokens.typography.small, marginTop: 5 },
  positive: { color: tokens.colors.success },
  negative: { color: tokens.colors.danger },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 7 },
  seeAll: { color: tokens.colors.accent, fontSize: tokens.typography.small, fontWeight: "600" },
  quickCard: { backgroundColor: tokens.colors.warmTint, borderRadius: tokens.radius.card, padding: tokens.spacing.card, borderWidth: 1, borderColor: tokens.colors.warmBorder },
  quickTitle: { color: tokens.colors.secondaryHeading, fontSize: tokens.typography.screenTitle, fontWeight: "700" },
  quickBody: { color: tokens.colors.body, fontSize: tokens.typography.body, lineHeight: 21, marginTop: 5 },
  primaryButton: { backgroundColor: tokens.colors.brown, borderRadius: tokens.radius.pill, alignItems: "center", paddingVertical: 12, marginTop: 12 },
  primaryButtonText: { color: tokens.colors.white, fontSize: tokens.typography.body, fontWeight: "600" },
  bottomNav: { backgroundColor: tokens.colors.white, borderTopWidth: 1, borderTopColor: tokens.colors.warmBorder, flexDirection: "row", justifyContent: "space-around", paddingTop: 8, paddingBottom: 6 },
  navItem: { minHeight: 44, minWidth: 64, alignItems: "center", justifyContent: "center", gap: 2 },
  navLabel: { color: tokens.colors.muted, fontSize: tokens.typography.small },
  navLabelActive: { color: tokens.colors.accent, fontWeight: "700" },
  drawerBackdrop: { flex: 1, flexDirection: "row", backgroundColor: tokens.colors.drawerOverlay },
  drawer: { width: 250, backgroundColor: tokens.colors.gold, padding: tokens.spacing.screen, paddingTop: 45 },
  backdropPressable: { flex: 1 },
  drawerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  drawerBrand: { color: tokens.colors.brown, fontSize: 20, fontWeight: "800" },
  drawerClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  drawerItem: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: tokens.radius.small, paddingHorizontal: 12 },
  drawerItemActive: { backgroundColor: tokens.colors.drawerActive },
  drawerItemText: { color: tokens.colors.brown, fontSize: tokens.typography.screenTitle, fontWeight: "600" },
  drawerSignOut: { marginTop: 18, borderTopWidth: 1, borderTopColor: tokens.colors.drawerBorder, paddingTop: 20 },
  drawerSignOutText: { color: tokens.colors.brown, fontSize: tokens.typography.body, fontWeight: "700" },
});
