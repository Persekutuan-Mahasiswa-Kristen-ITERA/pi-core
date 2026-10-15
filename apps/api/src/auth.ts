/**
 * The Better Auth instance (ADR-0007, ADR-0015).
 *
 * Built **per request** from the request's own Drizzle client, because the Worker opens one
 * short-lived Postgres connection per request (ADR-0009) — a module-scope instance would hold a
 * client across requests and workerd cancels such requests (found in story 1.6).
 *
 * Better Auth's `user` model is mapped onto our `members` table, so there is one identity record
 * rather than two; see ADR-0015 for why, and `packages/db/src/schema/auth.ts` for the field map.
 *
 * Only the Google provider is enabled: no email/password anywhere (FR-1, DESIGN deviation D1).
 * The admission rules (allowlist, invite-only, `email_verified`) are enforced by `resolveSignIn`
 * around the callback, not here — Better Auth's job is the handshake and the session.
 */
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Database } from "@pi-core/db";
import * as schema from "@pi-core/db/schema";
import { betterAuth } from "better-auth";
import type { Env } from "./env";

export type Auth = ReturnType<typeof createAuth>;

/**
 * The shape the API actually needs from Better Auth. Declared structurally on purpose: Better Auth's
 * inferred instance type references `@better-auth/core` internals that TypeScript cannot name
 * portably (`TS2742`), and pinning our own narrow interface also keeps the rest of the Worker from
 * depending on library internals. The compiler still checks that `betterAuth(...)` satisfies it.
 */
export interface AuthInstance {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (input: { headers: Headers }) => Promise<AuthSessionLike | null>;
  };
}

export interface AuthSessionLike {
  user: { id: string; email: string };
  session: { id: string };
}

/**
 * Models Better Auth must find, mapped onto our tables and columns (ADR-0015).
 *
 * The adapter looks a model up by its **`modelName`**, so the keys here must be the model names we
 * configured below (`members`, `sessions`, `accounts`, `verifications`) — not Better Auth's singular
 * defaults. Getting this wrong throws at request time, not at construction:
 * `[# Drizzle Adapter]: The model "verifications" was not found in the schema object.`
 */
function authSchema() {
  return {
    ...schema,
    members: schema.members,
    sessions: schema.authSessions,
    accounts: schema.authAccounts,
    verifications: schema.authVerifications,
  };
}

export function createAuth(db: Database, env: Env): AuthInstance {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, { provider: "pg", schema: authSchema() }),

    user: {
      modelName: "members",
      fields: {
        // `name` is Better Auth's field; our column is `full_name`.
        name: "fullName",
        // `image` holds the member's picture reference (our R2 key).
        image: "avatarKey",
      },
    },
    session: { modelName: "sessions" },
    account: {
      modelName: "accounts",
      /**
       * Links a Google account to the member row that already exists for that address, which is how
       * an invited member's first sign-in works (FR-4).
       *
       * `trustedProviders` is deliberately **left unset**: Better Auth defaults it to `[]`, and with
       * an empty list linking additionally requires Google to report the address as verified
       * (`!trusted && !emailVerified` refuses). Adding "google" here would skip that check — so NFR-1
       * is enforced by the library rather than by us remembering to.
       */
      accountLinking: { enabled: true },
    },
    verification: { modelName: "verifications" },

    // Our ids are uuids; Better Auth's default is an opaque string, which would not fit.
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        /**
         * Invite-only (FR-4). A Google account with no matching `members` row must **not** get one:
         * every member is created deliberately by an admin, never by signing in. With sign-up
         * disabled Better Auth refuses instead of inserting, so `members` stays a curated list.
         */
        disableSignUp: true,
        disableImplicitSignUp: true,
      },
    },

    // No password sign-in exists in this product (FR-1).
    emailAndPassword: { enabled: false },
  });
}
