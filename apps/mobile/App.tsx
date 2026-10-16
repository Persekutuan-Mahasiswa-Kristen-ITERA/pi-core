import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { loadSession, MobileSignInError, signInWithGoogle, signOut, type SignedInSession } from "./src/auth/session";
import { AppIcon } from "./src/components/AppIcon";
import { AuthScreen } from "./src/auth/AuthScreen";

import { tokens, type AppTab, tabLabels } from "./src/theme/tokens"

type AuthState =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "working" }
  | { kind: "signed-in"; session: SignedInSession }
  | { kind: "error"; message: string };

const drawerItems = ["Dashboard", "Members", "Roles", "Periods", "Assignments", "Integrations", "Settings"];

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ kind: "checking" });
  const [activeTab, setActiveTab] = useState<AppTab>("home");
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
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={tokens.colors.dashboardBrown} />
      <View style={styles.app}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Buka menu" hitSlop={10} onPress={() => setDrawerOpen(true)} style={styles.iconButton}>
            <AppIcon name="menu" />
          </Pressable>
          <Text style={styles.headerTitle}>{activeTab === "home" ? "Dashboard" : tabLabels[activeTab]}</Text>
          <Pressable accessibilityLabel="Notifikasi" hitSlop={10} onPress={() => undefined} style={styles.iconButton}>
            <AppIcon name="bell" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === "home" ? <Dashboard /> : <PlaceholderScreen title={tabLabels[activeTab]} />}
        </ScrollView>

        <View accessibilityLabel="Navigasi utama" style={styles.bottomNav}>
          {(Object.keys(tabLabels) as AppTab[]).map((tab) => (
            <Pressable
              accessibilityLabel={tabLabels[tab]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={styles.navItem}
            >
              <AppIcon name={tab} active={activeTab === tab} />
              <Text style={[styles.navLabel, activeTab === tab && styles.navLabelActive]}>{tabLabels[tab]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

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
                  if (index === 0) setActiveTab("home");
                }}
                style={[styles.drawerItem, index === 0 && styles.drawerItemActive]}
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

function Dashboard() {
  return (
    <>
      <View style={styles.welcome}>
        <Text style={styles.welcomeEyebrow}>WELCOME BACK</Text>
        <Text style={styles.welcomeTitle}>Shalom, Admin!</Text>
        <Text style={styles.welcomeBody}>Kelola organisasi PMK ITERA dengan mudah.</Text>
      </View>
      <Text style={styles.sectionTitle}>Ringkasan</Text>
      <View style={styles.statGrid}>
        <StatCard label="Total Members" value="124" delta="+5%" positive />
        <StatCard label="Active Period" value="2026/2027" delta="Aktif" positive />
        <StatCard label="Available Roles" value="10" delta="Semua" positive />
      </View>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <Text style={styles.seeAll}>Lihat semua</Text>
      </View>
      <View style={styles.quickCard}>
        <Text style={styles.quickTitle}>Anggota terbaru</Text>
        <Text style={styles.quickBody}>Pantau anggota dan assignment terbaru organisasi.</Text>
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => undefined}>
          <Text style={styles.primaryButtonText}>Buka Directory</Text>
        </Pressable>
      </View>
    </>
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

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.placeholderBody}>Screen {title} akan tersedia pada story berikutnya.</Text>
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
  primaryButton: { backgroundColor: tokens.colors.brown, borderRadius: tokens.radius.pill, alignItems: "center", paddingVertical: 12, marginTop: 16 },
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
  placeholder: { minHeight: 300, justifyContent: "center", alignItems: "center", gap: 10 },
  placeholderBody: { color: tokens.colors.body, fontSize: tokens.typography.body, textAlign: "center" },
});
