/**
 * Creates the first `members` row and grants it `super_admin`.
 *
 * Needed because the product is **invite-only**: Better Auth has sign-up disabled, so a Google
 * account with no matching member row cannot sign in at all (FR-4). Someone has to seed the first
 * member, and there is no admin UI yet — that arrives in Epic 4. This is that bootstrap, and it is
 * also what will be used once for production.
 *
 * Idempotent: re-running updates the name, and grants `super_admin` only if it is not already held.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/bootstrap-super-admin.ts \
 *     "someone@student.itera.ac.id" "Full Name"
 *
 * `email_verified` is deliberately left **false**: it means "Google has confirmed this address", and
 * that only becomes true after the first successful sign-in, where `syncGoogleIdentity` records it
 * from the provider's own verified claim (NFR-1).
 */
import { and, eq } from "drizzle-orm";
import { createDb } from "../src/client";
import { systemGrants } from "../src/schema/audit";
import { members } from "../src/schema";

const [email, fullName] = process.argv.slice(2);
if (email === undefined || fullName === undefined) {
  console.error('usage: bootstrap-super-admin.ts "<email>" "<full name>"');
  process.exit(1);
}

const url = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DIRECT_DATABASE_URL) is required");
  process.exit(1);
}

const { db, pool } = createDb(url);

try {
  const existing = await db
    .select({ id: members.id, fullName: members.fullName })
    .from(members)
    .where(eq(members.email, email))
    .limit(1);

  let memberId: string;
  if (existing[0] === undefined) {
    const inserted = await db
      .insert(members)
      .values({ email, fullName, status: "active" })
      .returning({ id: members.id });
    memberId = inserted[0]!.id;
    console.log(`created member ${memberId} for ${email}`);
  } else {
    memberId = existing[0].id;
    await db.update(members).set({ fullName, updatedAt: new Date() }).where(eq(members.id, memberId));
    console.log(`member already existed: ${memberId} (name updated)`);
  }

  const grant = await db
    .select({ id: systemGrants.id })
    .from(systemGrants)
    .where(and(eq(systemGrants.memberId, memberId), eq(systemGrants.roleKey, "super_admin")))
    .limit(1);

  if (grant[0] === undefined) {
    await db.insert(systemGrants).values({ memberId, roleKey: "super_admin" });
    console.log("granted super_admin");
  } else {
    console.log("super_admin already granted");
  }

  console.log("\nready — sign in at https://pi-core-api-staging.pmkitera.workers.dev/sign-in");
} finally {
  await pool.end();
}
