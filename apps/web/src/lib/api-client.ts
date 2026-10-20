/**
 * The single place the admin web talks to the API.
 *
 * Every call goes to the API origin directly (not through this Worker) and carries
 * `Authorization: Bearer <access token>` — never `credentials: "include"`, because the cookie could
 * not be sent across `*.workers.dev` sites anyway (see `lib/oidc.ts`).
 *
 * The access token lives in memory only; the refresh token is in `sessionStorage`, so a reload can
 * recover a session without leaving a long-lived credential readable by any script that manages to
 * run in the page.
 */
import { API_BASE_URL, clearTokens, persistTokens, refreshTokens, storedRefreshToken, type TokenSet } from "./oidc";

let tokens: TokenSet | null = null;
let inFlightRefresh: Promise<boolean> | null = null;

export function setSessionTokens(next: TokenSet | null): void {
  tokens = next;
  if (next === null) clearTokens();
  else persistTokens(next);
}

export function hasSessionToken(): boolean {
  return tokens !== null;
}

/**
 * Renews the access token. Concurrent callers share one request: three widgets mounting at once must
 * not spend three refresh tokens (the provider rotates them, so the second would fail).
 */
export async function renewSession(): Promise<boolean> {
  if (inFlightRefresh !== null) return inFlightRefresh;

  const refreshToken = storedRefreshToken();
  if (refreshToken === null) return false;

  inFlightRefresh = (async () => {
    try {
      tokens = await refreshTokens(refreshToken);
      return true;
    } catch {
      tokens = null;
      clearTokens();
      return false;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

/**
 * `fetch` against the API with the bearer token applied and one transparent renewal on 401.
 *
 * The retry happens at most once: a second 401 means the credential is genuinely unusable, and
 * looping would hammer the token endpoint.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = async (): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (tokens !== null) {
      headers.set("authorization", `Bearer ${tokens.accessToken}`);
    }
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  };

  let response = await send();
  if (response.status === 401 && (await renewSession())) {
    response = await send();
  }
  return response;
}
