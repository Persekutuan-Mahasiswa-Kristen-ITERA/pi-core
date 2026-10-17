import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { members } from "./members";

/** Better Auth OAuth provider persistence. Client secrets are stored hashed by the provider plugin. */
export const oauthClients = pgTable(
  "oauth_clients",
  {
    clientId: text("client_id").primaryKey(),
    clientSecret: text("client_secret"),
    disabled: boolean("disabled").notNull().default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    userId: uuid("user_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    public: boolean("public"),
    type: text("type"),
    requirePKCE: boolean("require_pkce"),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (table) => [index("oauth_clients_user_idx").on(table.userId)],
);

export const oauthRefreshTokens = pgTable(
  "oauth_refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    clientId: text("client_id").notNull().references(() => oauthClients.clientId, { onDelete: "cascade" }),
    sessionId: uuid("session_id"),
    userId: uuid("user_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revoked: timestamp("revoked", { withTimezone: true }),
    authTime: timestamp("auth_time", { withTimezone: true }),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [index("oauth_refresh_tokens_client_idx").on(table.clientId), index("oauth_refresh_tokens_user_idx").on(table.userId)],
);

export const oauthAccessTokens = pgTable(
  "oauth_access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    clientId: text("client_id").notNull().references(() => oauthClients.clientId, { onDelete: "cascade" }),
    sessionId: uuid("session_id"),
    userId: uuid("user_id").references(() => members.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    refreshId: uuid("refresh_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [index("oauth_access_tokens_client_idx").on(table.clientId), index("oauth_access_tokens_user_idx").on(table.userId)],
);

export const oauthConsents = pgTable(
  "oauth_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id").notNull().references(() => oauthClients.clientId, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => members.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("oauth_consents_client_idx").on(table.clientId), index("oauth_consents_user_idx").on(table.userId)],
);

export type OAuthClient = typeof oauthClients.$inferSelect;
