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
    /** Correlation id, propagated to logs and audit rows. */
    requestId?: string;
  };
}
