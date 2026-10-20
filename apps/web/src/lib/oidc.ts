/**
 * The admin web as an OIDC client (ADR-0018).
 *
 * PI-CORE's own provider issues the token; this module only drives the browser half of the
 * authorization-code + PKCE flow. It exists because the web and the API are two different
 * `*.workers.dev` sites: `workers.dev` is a public suffix, so the `SameSite=Lax` session cookie is
 * never sent on the page's cross-site `fetch`, and a cookie-based admin UI simply cannot work there.
 * A bearer token has no such constraint.
 *
 * Everything here is `client_secret`-free on purpose: a browser cannot keep a secret, so the client
 * is registered as *public* (`token_endpoint_auth_method: "none"`, `require_pkce: true`) and PKCE is
 * what binds the code to this tab.
 */

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "https://pi-core-api-staging.pmkitera.workers.dev"
).replace(/\/$/, "");

/** Better Auth's issuer: the origin plus its auth base path. */
export const ISSUER = `${API_BASE_URL}/api/auth`;

/** Registered by `scripts/register-web-client.ts` as a public, PKCE-only client. */
export const CLIENT_ID =
  process.env.NEXT_PUBLIC_OIDC_CLIENT_ID ?? "pi-core-admin-web";

export const SCOPE = "openid profile email pmk:access";

const VERIFIER_KEY = "picore.pkce.verifier";
const STATE_KEY = "picore.pkce.state";
const REFRESH_KEY = "picore.refresh";

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch ms; the provider's `expires_in` applied to the moment the token arrived. */
  expiresAt: number;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

/** Exactly what is registered as a redirect URI for this client. */
export function callbackUrl(): string {
  return `${window.location.origin}/callback`;
}

/**
 * Builds the authorize URL and parks the PKCE verifier + state in `sessionStorage`.
 *
 * `resource` is not decorative: without it the provider mints an **opaque** access token, and
 * `/api/v1/*` would have nothing to verify (see `docs/INTEGRATION-CONTRACT.md`). Its value becomes the
 * token's `aud` **verbatim** (`@better-auth/oauth-provider` → `aud: resource`), and `/api/v1/access`
 * verifies `aud === <API origin>` — so this must be the origin, not the issuer. Sending the issuer here
 * produced a token the API correctly rejected, and the sign-in bounced back with no session.
 */
export async function beginSignIn(): Promise<string> {
  const verifier = randomToken(48);
  const state = randomToken(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: callbackUrl(),
    scope: SCOPE,
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    resource: API_BASE_URL,
  });

  return `${ISSUER}/oauth2/authorize?${params.toString()}`;
}

export function readPendingState(): string | null {
  return sessionStorage.getItem(STATE_KEY);
}

function takePendingVerifier(): string | null {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return verifier;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const response = await fetch(`${ISSUER}/oauth2/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ ...body, resource: API_BASE_URL }).toString(),
  });

  if (!response.ok) {
    // Never surface the body: it can echo a client or token value into the page.
    throw new Error(`token request failed (${String(response.status)})`);
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof payload.access_token !== "string") {
    throw new Error("token response carried no access_token");
  }

  const expiresIn =
    typeof payload.expires_in === "number" ? payload.expires_in : 900;
  const tokens: TokenSet = {
    accessToken: payload.access_token,
    refreshToken:
      typeof payload.refresh_token === "string" ? payload.refresh_token : null,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  persistTokens(tokens);
  return tokens;
}

/** Exchanges the authorization code. The verifier is consumed whatever the outcome. */
export async function completeSignIn(
  code: string,
  state: string | null,
): Promise<TokenSet> {
  const expected = readPendingState();
  const verifier = takePendingVerifier();
  if (verifier === null) {
    throw new Error("no pending authorization in this tab");
  }
  if (expected !== null && state !== expected) {
    throw new Error("state mismatch");
  }

  return tokenRequest({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code,
    code_verifier: verifier,
    redirect_uri: callbackUrl(),
  });
}

export async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  return tokenRequest({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  });
}

export function persistTokens(tokens: TokenSet): void {
  if (tokens.refreshToken !== null) {
    sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }
}

export function storedRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function clearTokens(): void {
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
}
