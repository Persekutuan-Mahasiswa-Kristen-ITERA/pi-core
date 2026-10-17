import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Better Auth JWT signing keys. Private material is encrypted by the JWT plugin before persistence. */
export const jwks = pgTable("jwks", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export type JwksKey = typeof jwks.$inferSelect;
