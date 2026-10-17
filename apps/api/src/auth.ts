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
import { loadActor, resolveSignIn, type Database } from "@pi-core/db";
import * as schema from "@pi-core/db/schema";
import { can, GENERIC_SIGN_IN_DENIAL } from "@pi-core/shared";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { bearer, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
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

/** The shape of the user object Better Auth hands to the `user.create.before` hook. */
export interface NewMemberCandidate {
  email?: unknown;
  emailVerified?: unknown;
}

/**
 * The invite-only guard behind `databaseHooks.user.create.before`.
 *
 * Exported separately from the config so it can be exercised directly against a real database
 * (`apps/api/scripts/verify-signin-guard.ts`) instead of only through a live Google consent — a
 * non-ITERA Google account is not something this project can create on its own.
 *
 * Throws `APIError(FORBIDDEN)` carrying {@link GENERIC_SIGN_IN_DENIAL} when refused. That is
 * deliberate: `resolveSignIn` audits the refusal, and the client sees one generic message regardless
 * of *why* it was refused (NFR-3).
 */
export function newMemberGuard<T extends NewMemberCandidate>(db: Database) {
  return async (user: T): Promise<{ data: T }> => {
    const email = typeof user.email === "string" ? user.email : null;
    const resolution = await resolveSignIn(db, {
      email,
      emailVerified: user.emailVerified === true,
    });

    if (!resolution.decision.allowed) {
      throw new APIError("FORBIDDEN", { message: GENERIC_SIGN_IN_DENIAL });
    }

    return { data: user };
  };
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
    oauthClient: schema.oauthClients,
    oauthRefreshToken: schema.oauthRefreshTokens,
    oauthAccessToken: schema.oauthAccessTokens,
    oauthConsent: schema.oauthConsents,
    jwks: schema.jwks,
  };
}

export function createAuth(db: Database, env: Env): AuthInstance {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, { provider: "pg", schema: authSchema() }),

    databaseHooks: {
      user: {
        create: {
          /**
           * Invite-only, enforced where it can actually be observed (FR-4, FR-7, NFR-3).
           *
           * Better Auth reaches this hook only when a sign-in found **no** member row for the address
           * — precisely the case the org must refuse (a member row exists ⇒ it takes the linking
           * path instead). `resolveSignIn` writes the audit row (precise reason, **domain only**,
           * never the full address) and we answer with the single generic message, so the response
           * cannot be used to enumerate who is a member.
           *
           * Returning `false` would abort silently and leave no trace; throwing is what both records
           * the refusal and surfaces one generic error (FR-7 + NFR-3).
           */
          before: newMemberGuard(db),
        },
      },
    },

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
       *
       * `requireLocalEmailVerified: false` — our `members.email_verified` is set **after** linking,
       * not before; demanding it be set **before** linking would deadlock the first sign-in.
       */
      accountLinking: {
        enabled: true,
        requireLocalEmailVerified: false,
      },
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
        /** Invite-only: unknown Google accounts cannot create members. */
        disableSignUp: true,
        disableImplicitSignUp: true,
      },
    },

    // No password sign-in exists in this product (FR-1).
    emailAndPassword: { enabled: false },

    /**
     * OAuth 2.1 provider: OIDC discovery, authorization code + mandatory PKCE,
     * JWT/JWKS, UserInfo, revocation and introspection are supplied by the pinned plugin.
     */
    plugins: [
      bearer(),
      jwt({
        schema: {
          jwks: {
            modelName: "jwks",
            fields: {
              publicKey: "publicKey",
              privateKey: "privateKey",
              createdAt: "createdAt",
              expiresAt: "expiresAt",
            },
          },
        },
      }),
      oauthProvider({
        loginPage: "/sign-in",
        consentPage: "/consent",
        scopes: ["openid", "profile", "email", "pmk:access"],
        grantTypes: ["authorization_code", "refresh_token"],
        clientPrivileges: async ({ action, user }) => {
          if (user?.id === undefined) return false;
          const loaded = await loadActor(db, user.id);
          const permission = action === "read" || action === "list" ? "integration:read" : "integration:manage";
          return can(loaded.actor, permission);
        },
      }),
    ],
  });
}
