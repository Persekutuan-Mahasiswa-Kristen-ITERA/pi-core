import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { tokens } from "../theme/tokens";

import { pmkLogoUri } from "./pmk-logo-uri";

const logo = { uri: pmkLogoUri };


type AuthScreenProps = {
  errorMessage?: string | undefined;
  loading?: boolean;
  onGooglePress: () => void;
  onDemoPress?: () => void;
};

/** Google-only admission screen. Password/email fields are intentionally absent (D1). */
export function AuthScreen({ errorMessage, loading = false, onGooglePress, onDemoPress }: AuthScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Image accessibilityLabel="Logo PMK ITERA" resizeMode="contain" source={logo} style={styles.logo} />
        <Text style={styles.organization}>PMK ITERA CENTRALIZED ORGANIZATION & ROLE ENGINE</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.loginWordmark}>LOGIN</Text>
        <Text style={styles.subtitle}>Masuk untuk melanjutkan ke PI-CORE.</Text>
        {errorMessage ? <Text accessibilityLiveRegion="polite" style={styles.error}>{errorMessage}</Text> : null}
        <Pressable
          accessibilityLabel="Masuk dengan Google"
          accessibilityRole="button"
          accessibilityState={{ busy: loading }}
          disabled={loading}
          onPress={onGooglePress}
          style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, loading && styles.disabled]}
        >
          <Text style={styles.googleMark}>G</Text>
          <Text style={styles.googleLabel}>{loading ? "Menghubungkan…" : "Masuk dengan Google"}</Text>
        </Pressable>
        {onDemoPress ? (
          <Pressable
            accessibilityLabel="Masuk Mode Demo / QA"
            accessibilityRole="button"
            onPress={onDemoPress}
            style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}
          >
            <Text style={styles.demoLabel}>⚡ Masuk Mode Demo / QA (Bypass)</Text>
          </Pressable>
        ) : null}
        <Text style={styles.note}>Gunakan akun Google ITERA yang sudah diundang.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.white },
  header: {
    height: 299,
    backgroundColor: tokens.colors.brown,
    borderBottomLeftRadius: 124,
    alignItems: "center",
    paddingTop: 60,
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logo: { width: 100, height: 100 },
  organization: {
    color: tokens.colors.white,
    fontSize: 17,
    fontWeight: "400",
    letterSpacing: 1.4,
    lineHeight: 24,
    marginTop: 14,
    textAlign: "center",
    width: 290,
  },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 40, paddingTop: 40 },
  loginWordmark: { color: tokens.colors.onLogin, fontSize: 24, letterSpacing: 5.76, textShadowColor: tokens.colors.black, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 2 },
  subtitle: { color: tokens.colors.body, fontSize: 14, textAlign: "center", marginTop: 18 },
  error: { color: tokens.colors.danger, fontSize: 13, textAlign: "center", marginTop: 18 },
  googleButton: { minHeight: 49, width: "100%", backgroundColor: tokens.colors.brown, borderRadius: tokens.radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 28, paddingHorizontal: 18 },
  googleMark: { color: tokens.colors.white, fontSize: 18, fontWeight: "800" },
  googleLabel: { color: tokens.colors.white, fontSize: 14, fontWeight: "600" },
  demoButton: { minHeight: 45, width: "100%", borderWidth: 1, borderColor: tokens.colors.accent, backgroundColor: "rgba(161, 89, 18, 0.08)", borderRadius: tokens.radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12, paddingHorizontal: 18 },
  demoLabel: { color: tokens.colors.accent, fontSize: 13, fontWeight: "700" },
  note: { color: tokens.colors.muted, fontSize: 12, textAlign: "center", marginTop: 18 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 },
});
