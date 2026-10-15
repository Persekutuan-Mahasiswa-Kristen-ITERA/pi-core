/**
 * Where the app points.
 *
 * `EXPO_PUBLIC_*` variables are inlined at build time by Expo, so this is the only place the API
 * origin is decided. There is no secret here: the app holds no client secret by design — the OAuth
 * handshake happens in the system browser and the app only ever receives a one-time code (story 3.3).
 */

/** Staging by default so a dev build works without configuration. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://pi-core-api-staging.pmkitera.workers.dev";

/**
 * The deep link the server may redirect to. Must appear in the API's `MOBILE_REDIRECT_URIS` or the
 * hand-off refuses — that allowlist is what stops `finish` being an open redirector.
 */
export const MOBILE_REDIRECT_URI = process.env.EXPO_PUBLIC_REDIRECT_URI ?? "picore://auth";
