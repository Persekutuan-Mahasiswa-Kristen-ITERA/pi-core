/**
 * The mobile sign-in hand-off, client side (story 3.3, FR-2, NFR-16).
 *
 * Three properties the acceptance criteria ask for, and how each is met:
 *
 * 1. **The system browser, not an embedded web view.** `WebBrowser.openAuthSessionAsync` opens Safari
 *    or Chrome, so the Google credentials never pass through app-controlled UI, and the OS shows the
 *    real origin. An embedded view could read the password field.
 * 2. **PKCE.** We generate a verifier, keep it in memory, and send only its SHA-256 challenge. The code
 *    that comes back through the deep link is useless without the verifier, which matters because a
 *    custom scheme can be observed by other apps on the device.
 * 3. **Tokens only in `expo-secure-store`.** The session token goes straight into the OS keychain /
 *    keystore. Nothing is written to `AsyncStorage`, which is plain text on disk.
 */
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { API_URL, MOBILE_REDIRECT_URI } from "../config";

/** Keychain entry for the bearer token. */
const TOKEN_KEY = "pi-core.session-token";

/** `base64url` without padding, per RFC 7636. */
function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A 43-character verifier from the unreserved set, inside the 43–128 range PKCE allows. */
function newVerifier(): string {
  const bytes = Crypto.getRandomBytes(32);
  return base64Url(bytes);
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  // `digestStringAsync` returns standard base64; PKCE wants base64url without padding.
  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface SignedInSession {
  token: string;
  expiresAt: string;
}

/**
 * Runs the whole hand-off and returns the session, or `null` when the user dismissed the browser.
 *
 * Throws `MobileSignInError` for anything else, so the caller can show one generic message — the
 * server already refuses without explaining why (NFR-3), and the app must not add detail it does not
 * have.
 */
export async function signInWithGoogle(): Promise<SignedInSession | null> {
  const verifier = newVerifier();
  const challenge = await challengeFor(verifier);
  const state = base64Url(Crypto.getRandomBytes(16));

  const startUrl =
    `${API_URL}/sign-in?` +
    new URLSearchParams({
      redirect_uri: MOBILE_REDIRECT_URI,
      code_challenge: challenge,
      state,
    }).toString();

  const result = await WebBrowser.openAuthSessionAsync(startUrl, MOBILE_REDIRECT_URI);
  if (result.type !== "success") return null; // dismissed or cancelled — not an error

  const returned = new URL(result.url);
  if (returned.searchParams.get("state") !== state) {
    // A deep link we did not initiate. Refusing it is the point of carrying `state` through.
    throw new MobileSignInError("state_mismatch");
  }

  const code = returned.searchParams.get("code");
  if (code === null || code === "") throw new MobileSignInError("missing_code");

  const response = await fetch(`${API_URL}/api/v1/auth/mobile/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, verifier, redirectUri: MOBILE_REDIRECT_URI }),
  });

  if (!response.ok) throw new MobileSignInError("exchange_failed");

  const body = (await response.json()) as { token?: string; expiresAt?: string };
  if (typeof body.token !== "string" || body.token === "") throw new MobileSignInError("exchange_failed");

  const session: SignedInSession = {
    token: body.token,
    expiresAt: body.expiresAt ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
  };
  await saveSession(session);
  return session;
}

export class MobileSignInError extends Error {
  constructor(readonly reason: string) {
    super("sign-in failed");
    this.name = "MobileSignInError";
  }
}

// ---------------------------------------------------------------------------
// Session storage — the only place a token is written on the device
// ---------------------------------------------------------------------------

/** The three operations the session needs, so the target can be swapped by platform. */
interface SessionStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/**
 * Where the token lives: the OS keychain/keystore on native.
 *
 * **Web is a preview surface, not a shipped target**, and it gets a memory-only store. Two reasons:
 * `expo-secure-store` has no web implementation — calling it there rejects, which is what broke the
 * preview build — and the obvious substitute, `localStorage`, is plain text readable by any script on
 * the origin, exactly what point 3 above exists to avoid. A browser session therefore lasts as long as
 * the tab, and a token is never written to disk.
 */
const storage: SessionStorage =
  Platform.OS === "web"
    ? (() => {
        let value: string | null = null;
        return {
          getItemAsync: async (): Promise<string | null> => value,
          setItemAsync: async (_key: string, next: string): Promise<void> => {
            value = next;
          },
          deleteItemAsync: async (): Promise<void> => {
            value = null;
          },
        };
      })()
    : SecureStore;

export async function saveSession(session: SignedInSession): Promise<void> {
  await storage.setItemAsync(TOKEN_KEY, JSON.stringify(session));
}

/** The stored session, or `null`. Expired tokens are cleared rather than handed out. */
export async function loadSession(): Promise<SignedInSession | null> {
  const raw = await storage.getItemAsync(TOKEN_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as SignedInSession;
    if (typeof parsed.token !== "string" || parsed.token === "") return null;
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      await clearSession();
      return null;
    }
    return parsed;
  } catch {
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await storage.deleteItemAsync(TOKEN_KEY);
}

/** Headers for an authenticated call. Kept in one place so no request forgets the scheme. */
export async function authHeaders(): Promise<Record<string, string>> {
  const session = await loadSession();
  return session === null ? {} : { authorization: `Bearer ${session.token}` };
}

/** Ends the session server-side too, then forgets it locally — even if the server call fails. */
export async function signOut(): Promise<void> {
  const session = await loadSession();
  try {
    if (session !== null) {
      await fetch(`${API_URL}/api/v1/auth/mobile/sign-out`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}` },
      });
    }
  } finally {
    await clearSession();
  }
}
