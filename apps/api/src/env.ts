import type { Actor } from "@pi-core/shared";

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
    /** Correlation id, propagated to logs and audit rows. */
    requestId?: string;
  };
}
