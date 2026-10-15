import { boolean, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { citext } from "./citext";

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
