/**
 * Sign-in screen for the mobile app (story 3.3).
 *
 * Deliberately one screen: Epic 5 builds the real screens from the Figma design. This exists so the
 * sign-in path is runnable and observable — press the button, complete Google consent in the system
 * browser, and see whether a session landed in the keychain.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { loadSession, MobileSignInError, signInWithGoogle, signOut, type SignedInSession } from "./src/auth/session";
import { API_URL } from "./src/config";

type State =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "working" }
  | { kind: "signed-in"; session: SignedInSession }
  | { kind: "error"; message: string };

export default function App() {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    void (async () => {
      const session = await loadSession();
      setState(session === null ? { kind: "signed-out" } : { kind: "signed-in", session });
    })();
  }, []);

  const onSignIn = useCallback(async () => {
    setState({ kind: "working" });
    try {
      const session = await signInWithGoogle();
      setState(session === null ? { kind: "signed-out" } : { kind: "signed-in", session });
    } catch (error) {
      // One message for every failure. The server does not explain its refusals (NFR-3) and the app
      // has nothing to add; the reason is only useful in a log.
      const reason = error instanceof MobileSignInError ? error.reason : "unexpected";
      setState({ kind: "error", message: `Tidak bisa masuk (${reason}).` });
    }
  }, []);

  const onSignOut = useCallback(async () => {
    setState({ kind: "working" });
    await signOut();
    setState({ kind: "signed-out" });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>PI-CORE</Text>

        {state.kind === "checking" ? <ActivityIndicator color="#924603" /> : null}

        {state.kind === "working" ? (
          <>
            <ActivityIndicator color="#924603" />
            <Text style={styles.note}>Menghubungi Google…</Text>
          </>
        ) : null}

        {state.kind === "signed-out" ? (
          <>
            <Text style={styles.body}>
              Masuk dengan akun Google ITERA Anda. Browser sistem akan terbuka — kata sandi tidak pernah
              melewati aplikasi ini.
            </Text>
            <Pressable style={styles.button} onPress={() => void onSignIn()}>
              <Text style={styles.buttonLabel}>Masuk dengan Google</Text>
            </Pressable>
          </>
        ) : null}

        {state.kind === "signed-in" ? (
          <>
            <Text style={styles.body}>Sudah masuk.</Text>
            <Text style={styles.mono}>token tersimpan di expo-secure-store</Text>
            <Text style={styles.mono}>kedaluwarsa {new Date(state.session.expiresAt).toLocaleString("id-ID")}</Text>
            <Pressable style={styles.button} onPress={() => void onSignOut()}>
              <Text style={styles.buttonLabel}>Keluar</Text>
            </Pressable>
          </>
        ) : null}

        {state.kind === "error" ? (
          <>
            <Text style={styles.error}>{state.message}</Text>
            <Pressable style={styles.button} onPress={() => void onSignIn()}>
              <Text style={styles.buttonLabel}>Coba lagi</Text>
            </Pressable>
          </>
        ) : null}

        <Text style={styles.note}>API: {API_URL}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F7F6", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E2E1DF", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#5A3E1B" },
  body: { fontSize: 15, lineHeight: 22, color: "#475569" },
  note: { fontSize: 12, color: "#64748B" },
  mono: { fontSize: 12, color: "#64748B", fontFamily: "monospace" },
  error: { fontSize: 14, color: "#E11D48" },
  button: { backgroundColor: "#924603", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  buttonLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});
