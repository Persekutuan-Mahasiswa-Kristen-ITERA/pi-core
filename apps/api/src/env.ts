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
}
