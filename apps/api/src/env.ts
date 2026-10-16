import type { Database } from "@pi-core/db";
import type { Actor } from "@pi-core/shared";
import type { AuthInstance } from "./auth";

/** Cloudflare Hyperdrive binding, narrowed to what `@pi-core/db` needs. */
export interface HyperdriveBinding {
  connectionString: string;
}

/** Bindings and vars available to the API Worker. */
export interface Env {
  /** Postgres via Hyperdrive (ADR-0009). Never a raw connection string in code. */
  HYPERDRIVE: HyperdriveBinding;
  /** `staging` | `production`; absent locally. */
  ENVIRONMENT?: string;
  /** The API's own origin; Better Auth builds the OAuth callback from it (ADR-0015). */
  BETTER_AUTH_URL: string;
  /** Better Auth signing secret (`wrangler secret put`). */
  BETTER_AUTH_SECRET: string;
  /** Google OAuth client id — not a secret, but kept out of the repo like the rest. */
  GOOGLE_CLIENT_ID: string;
  /** Google OAuth client secret. */
  GOOGLE_CLIENT_SECRET: string;
  /**
   * Comma-separated deep links the mobile hand-off may redirect to (story 3.3), e.g.
   * `picore://auth`. Configured per environment so a crafted `redirect_uri` cannot make the endpoint
   * an open redirector. Empty means the mobile hand-off is refused.
   */
  MOBILE_REDIRECT_URIS?: string;
  /**
   * Comma-separated extra origins allowed to make **credentialed** cross-origin requests (FR-54) — in
   * practice the admin web app. `BETTER_AUTH_URL` is always allowed, so the API's own origin needs no
   * entry here. There is no wildcard: an unlisted origin gets neither CORS headers nor permission to
   * mutate.
   */
  CORS_ORIGINS?: string;
  /** Cloudflare account id — the R2 S3 endpoint is `<account>.r2.cloudflarestorage.com`. Not a secret. */
  R2_ACCOUNT_ID?: string;
  /** The bucket avatars live in. A var, not a secret. */
  AVATAR_BUCKET: string;
  /** R2 S3 credentials for presigning (story 4.4). Secrets; set with `wrangler secret put`. */
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  /** R2 binding, used to serve avatars back without a round trip through S3. */
  AVATARS?: R2Bucket;
}

/** Hono environment for this app. */
export interface AppEnv {
  Bindings: Env;
  Variables: {
    /**
     * The resolved actor. Set by the session middleware (Epic 3) and read by `requirePermission`
     * (FR-25); absent until then, which makes guarded routes answer 401.
     */
    actor?: Actor;
    /**
     * The Better Auth instance for this request, created once per request because the Drizzle
     * client is per request (ADR-0015). Set by `authMiddleware`.
     */
    auth?: AuthInstance;
    /**
     * The request's Drizzle client, opened by `sessionMiddleware` and closed when the request ends.
     * Routes use this rather than opening a second connection: Hyperdrive owns pooling (ADR-0009), and
     * one client per request is the rule the whole Worker is built around.
     */
    db?: Database;
    /**
     * The signed-in member's email, set alongside `actor`. Kept separate because it is display data
     * (the sign-in page shows it) while `actor` is authorization data.
     */
    sessionEmail?: string;
    /** Correlation id, propagated to logs and audit rows. */
    requestId?: string;
  };
}
