import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "../theme/tokens";
import { pmkLogoUri } from "./pmk-logo-uri";

const logo = { uri: pmkLogoUri };

type AuthScreenProps = {
  errorMessage?: string | undefined;
  loading?: boolean;
  onGooglePress: () => void;
  onDemoPress?: () => void;
};

/** Google-only admission screen for PMK ITERA. */
export function AuthScreen({ errorMessage, loading = false, onGooglePress, onDemoPress }: AuthScreenProps) {
  return (
    <View style={styles.screen}>
      {/* Curved Luxury Header */}
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Image accessibilityLabel="Logo PMK ITERA" resizeMode="contain" source={logo} style={styles.logo} />
        </View>
        <Text style={styles.brandTitle}>PI-CORE</Text>
        <Text style={styles.brandSubtitle}>PMK ITERA CENTRALIZED ENGINE</Text>
      </View>

      {/* Main Login Card */}
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Selamat Datang</Text>
        <Text style={styles.subtitle}>
          Masuk menggunakan akun Google ITERA resmi (@itera.ac.id atau @student.itera.ac.id) untuk mengakses portal.
        </Text>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={tokens.colors.danger} />
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {/* Primary Google Login Button */}
        <Pressable
          accessibilityLabel="Masuk dengan Google"
          accessibilityRole="button"
          accessibilityState={{ busy: loading }}
          disabled={loading}
          onPress={onGooglePress}
          style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, loading && styles.disabled]}
        >
          <View style={styles.googleMarkContainer}>
            <Ionicons name="logo-google" size={18} color="#EA4335" />
          </View>
          <Text style={styles.googleLabel}>
            {loading ? "Menghubungkan ke ITERA…" : "Masuk dengan Akun Google"}
          </Text>
        </Pressable>

        {/* Demo / QA Mode Button */}
        {onDemoPress ? (
          <Pressable
            accessibilityLabel="Masuk Mode Demo / QA"
            accessibilityRole="button"
            onPress={onDemoPress}
            style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}
          >
            <Ionicons name="flash" size={15} color={tokens.colors.accent} />
            <Text style={styles.demoLabel}>Masuk Mode Demo / QA (Bypass)</Text>
          </Pressable>
        ) : null}

        <View style={styles.trustBadge}>
          <Ionicons name="shield-checkmark" size={15} color={tokens.colors.success} />
          <Text style={styles.trustText}>SSO Terproteksi · OIDC Single Sign-On</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    height: 310,
    backgroundColor: tokens.colors.brown,
    borderBottomLeftRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: tokens.colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  logo: { width: 62, height: 62 },
  brandTitle: {
    color: tokens.colors.gold,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginTop: 4,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 36,
  },
  welcomeText: {
    color: tokens.colors.heading,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 13.5,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(225, 29, 72, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 18,
    width: "100%",
  },
  error: {
    color: tokens.colors.danger,
    fontSize: 12.5,
    fontWeight: "600",
    flex: 1,
  },
  googleButton: {
    minHeight: 52,
    width: "100%",
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 28,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: tokens.colors.warmBorder,
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  googleMarkContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  googleLabel: {
    color: tokens.colors.heading,
    fontSize: 15,
    fontWeight: "700",
  },
  demoButton: {
    minHeight: 46,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(161, 89, 18, 0.3)",
    backgroundColor: "rgba(161, 89, 18, 0.06)",
    borderRadius: tokens.radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 18,
  },
  demoLabel: {
    color: tokens.colors.accent,
    fontSize: 13.5,
    fontWeight: "700",
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    marginBottom: 24,
    paddingVertical: 8,
  },
  trustText: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 },
});
