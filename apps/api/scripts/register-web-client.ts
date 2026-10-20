/**
 * Registers the admin web as a **public** OIDC client (ADR-0018).
 *
 * A browser cannot keep a `client_secret`, so this client is `token_endpoint_auth_method: "none"`
 * with PKCE mandatory — the code is bound to the tab that started the flow by the verifier, not by a
 * shared secret. That is the same shape any SPA uses, and it is why this row can be committed to the
 * repository as a script instead of being created through the admin UI (which mints secrets).
 *
 * Idempotent: re-running updates the redirect URIs, scopes and flags in place.
 *
 * Usage:
 *   pnpm --filter @pi-core/api exec tsx --env-file-if-exists=../../packages/db/.env \
 *     scripts/register-web-client.ts
 */
import { createDb } from "@pi-core/db";
import { oauthClients } from "@pi-core/db/schema";

const CLIENT_ID = process.env.WEB_CLIENT_ID ?? "pi-core-admin-web";
const REDIRECT_URIS = (
  process.env.WEB_REDIRECT_URIS ??
  "https://pi-core-web-staging.pmkitera.workers.dev/callback,http://localhost:3000/callback"
)
  .split(",")
  .map((uri) => uri.trim())
  .filter(Boolean);

const url = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DIRECT_DATABASE_URL) is required");
  process.exit(1);
}

const { db, pool } = createDb(url);

try {
  const [row] = await db
    .insert(oauthClients)
    .values({
      clientId: CLIENT_ID,
      clientSecret: null,
      public: true,
      type: "user-agent-based",
      tokenEndpointAuthMethod: "none",
      requirePKCE: true,
      disabled: false,
      skipConsent: false,
      enableEndSession: true,
      name: "PI-CORE Admin Web",
      uri: "https://pi-core-web-staging.pmkitera.workers.dev",
      redirectUris: REDIRECT_URIS,
      postLogoutRedirectUris: REDIRECT_URIS.map((uri) => uri.replace(/\/callback$/, "")),
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      scopes: ["openid", "profile", "email", "pmk:access"],
      subjectType: "public",
    })
    .onConflictDoUpdate({
      target: oauthClients.clientId,
      set: {
        public: true,
        type: "user-agent-based",
        tokenEndpointAuthMethod: "none",
        requirePKCE: true,
        disabled: false,
        redirectUris: REDIRECT_URIS,
        postLogoutRedirectUris: REDIRECT_URIS.map((uri) => uri.replace(/\/callback$/, "")),
        grantTypes: ["authorization_code", "refresh_token"],
        responseTypes: ["code"],
        scopes: ["openid", "profile", "email", "pmk:access"],
        updatedAt: new Date(),
      },
    })
    .returning({
      clientId: oauthClients.clientId,
      redirectUris: oauthClients.redirectUris,
      public: oauthClients.public,
      requirePKCE: oauthClients.requirePKCE,
    });

  console.log("registered public client:", JSON.stringify(row, null, 2));
} finally {
  await pool.end();
}
