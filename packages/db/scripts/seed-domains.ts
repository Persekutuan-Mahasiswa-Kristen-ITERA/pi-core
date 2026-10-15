/**
 * Idempotent seed of the sign-in allowlist (FR-3, ADR-0005).
 *
 * Upserts by `domain` (citext, so case cannot create a duplicate) and **reports** any allowlisted
 * row the source no longer describes instead of deleting it — removing an allowlist entry is a
 * security decision, not a cleanup.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db db:seed:domains
 */
import { notInArray, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { allowedEmailDomains } from "../src/schema";
import { ALLOWED_EMAIL_DOMAINS, FORBIDDEN_EMAIL_DOMAINS } from "../src/seed/email-domains";

const url = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DIRECT_DATABASE_URL) is required");
  process.exit(1);
}

const { db, pool } = createDb(url);
let created = 0;
let updated = 0;

try {
  for (const entry of ALLOWED_EMAIL_DOMAINS) {
    const res = await db
      .insert(allowedEmailDomains)
      .values({ domain: entry.domain, allowSubdomains: entry.allowSubdomains, isActive: true })
      .onConflictDoUpdate({
        target: allowedEmailDomains.domain,
        set: { allowSubdomains: entry.allowSubdomains, isActive: true, updatedAt: new Date() },
      })
      .returning({ created: sql<boolean>`xmax = 0` });
    if (res[0]?.created) created += 1;
    else updated += 1;
  }

  const rows = await db
    .select({ domain: allowedEmailDomains.domain, allowSubdomains: allowedEmailDomains.allowSubdomains, isActive: allowedEmailDomains.isActive })
    .from(allowedEmailDomains)
    .orderBy(allowedEmailDomains.domain);

  console.log(`seed:domains created=${created} updated=${updated} total=${rows.length}`);
  for (const row of rows) {
    console.log(`  ${row.domain.padEnd(24)} allow_subdomains=${row.allowSubdomains} active=${row.isActive}`);
  }

  let bad = false;

  // ADR-0005: these must never be allowlisted.
  for (const forbidden of FORBIDDEN_EMAIL_DOMAINS) {
    if (rows.some((row) => row.domain.toLowerCase() === forbidden.toLowerCase())) {
      console.error(`  FORBIDDEN domain present: ${forbidden}`);
      bad = true;
    }
  }

  // Drift: an allowlisted row the source no longer describes. Reported, never auto-deleted.
  const seeded = ALLOWED_EMAIL_DOMAINS.map((entry) => entry.domain);
  const drift = await db
    .select({ domain: allowedEmailDomains.domain, isActive: allowedEmailDomains.isActive })
    .from(allowedEmailDomains)
    .where(notInArray(allowedEmailDomains.domain, seeded));
  for (const row of drift) {
    console.log(`  drift: ${row.domain} (active=${row.isActive}) is in the database but not in the seed source`);
  }

  if (bad) process.exitCode = 1;
} finally {
  await pool.end();
}
