import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { citext } from "./citext";
import { members } from "./members";

/**
 * `allowed_email_domains` — the server-side sign-in allowlist (`docs/ARCHITECTURE.md` §4, FR-3).
 *
 * Enforced on the **verified** email; Google's `hd` parameter is never a control (NFR-2). Seeded
 * with the ITERA domains only (**ADR-0005**): `pmkitera.web.id` mailboxes are not Google accounts.
 *
 * `allow_subdomains` decides whether `anything.<domain>` is also admitted — which is exactly why
 * `student.itera.ac.id` is listed **separately** from `itera.ac.id` instead of relying on the flag.
 */
export const allowedEmailDomains = pgTable(
  "allowed_email_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** `citext`, so `ITERA.ac.id` and `itera.ac.id` cannot both exist. */
    domain: citext("domain").notNull(),
    allowSubdomains: boolean("allow_subdomains").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("allowed_email_domains_domain_uq").on(t.domain)],
);

export type AllowedEmailDomain = typeof allowedEmailDomains.$inferSelect;
export type NewAllowedEmailDomain = typeof allowedEmailDomains.$inferInsert;

// ---------------------------------------------------------------------------
// Better Auth's own tables (ADR-0015)
// ---------------------------------------------------------------------------

/**
 * Better Auth's `user` model is mapped onto **`members`**, so there is no `user` table here. These
 * three are auth infrastructure, written only by Better Auth.
 *
 * Column names are `snake_case` like the rest of the schema; the **Drizzle property names match
 * Better Auth's field names exactly** (`expiresAt`, `providerId`, …), which is what its drizzle
 * adapter maps on. Field lists were read from `@better-auth/core@1.6.33`'s `db/get-tables.mjs`,
 * not guessed.
 */

/** Better Auth `session`. */
export const authSessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** Better Auth `account` — one row per linked provider account (Google, later Apple). */
export const authAccounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    uniqueIndex("accounts_provider_account_uq").on(t.providerId, t.accountId),
  ],
);

/** Better Auth `verification` — short-lived tokens (state, OAuth state, email verification). */
export const authVerifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export type AuthSession = typeof authSessions.$inferSelect;
export type AuthAccount = typeof authAccounts.$inferSelect;
export type AuthVerification = typeof authVerifications.$inferSelect;

/**
 * One-time, single-use hand-off code for the mobile app (story 3.3).
 *
 * The flow: the app opens the **system browser** at our sign-in page with a PKCE challenge, Google
 * consent happens there, and the browser lands on `/api/v1/auth/mobile/finish` — which holds a normal
 * cookie session and therefore knows who just signed in. It mints one of these codes and redirects to
 * the app's deep link. The app then exchanges the code **plus its PKCE verifier** for a session token
 * and keeps that in `expo-secure-store`.
 *
 * Why not hand the session token straight to the deep link: a custom-scheme redirect is observable by
 * other apps on the device, so the value that travels through it must be useless without the verifier,
 * single-use, and short-lived. Hence: the **code is never stored** (only its SHA-256), the challenge is
 * bound at mint time, and the row is marked consumed on exchange — a replay finds nothing.
 */
export const mobileAuthCodes = pgTable(
  "mobile_auth_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SHA-256 of the code. The code itself never touches the database or the logs (NFR-16). */
    codeHash: text("code_hash").notNull().unique(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    /** The PKCE `S256` challenge the app generated; the verifier must hash to this. */
    codeChallenge: text("code_challenge").notNull(),
    /** The deep link the code may be delivered to — checked again at exchange time. */
    redirectUri: text("redirect_uri").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mobile_auth_codes_expires_idx").on(t.expiresAt),
    index("mobile_auth_codes_member_idx").on(t.memberId),
  ],
);

export type MobileAuthCode = typeof mobileAuthCodes.$inferSelect;
