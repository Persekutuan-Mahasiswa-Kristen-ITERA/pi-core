/**
 * Creates the first `members` row and grants it `super_admin` — the one-off bootstrap (FR-6).
 *
 * Needed because the product is **invite-only**: Better Auth has sign-up disabled, so a Google
 * account with no matching member row cannot sign in at all (FR-4). Someone has to seed the first
 * member, and there is no admin UI yet — that arrives in Epic 4. This is that bootstrap, and it is
 * also what will be used once for production.
 *
 * The address comes from the **environment**, never from source (FR-6: no email is hardcoded), and
 * the grant is **audited** (FR-7) like any other privilege change.
 *
 *   BOOTSTRAP_SUPER_ADMIN_EMAIL="someone@student.itera.ac.id" \
 *   BOOTSTRAP_SUPER_ADMIN_NAME="Full Name" \
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/bootstrap-super-admin.ts
 *
 * Idempotent: re-running updates the name, and grants `super_admin` only if not already held.
 *
 * `email_verified` is deliberately left **false**: it means "Google has confirmed this address", and
 * that only becomes true after the first successful sign-in, where `syncGoogleIdentity` records it
 * from the provider's own verified claim (NFR-1).
 */
import { and, eq } from "drizzle-orm";
import { createDb } from "../src/client";
import { writeAudit } from "../src/access";
import { members, systemGrants } from "../src/schema";

const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim();
const fullName = process.env.BOOTSTRAP_SUPER_ADMIN_NAME?.trim();

if (email === undefined || email === "" || fullName === undefined || fullName === "") {
  console.error(
    "BOOTSTRAP_SUPER_ADMIN_EMAIL and BOOTSTRAP_SUPER_ADMIN_NAME are required (FR-6: no hardcoded email).",
  );
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
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, email))
    .limit(1);

  let memberId: string;
  let created = false;
  if (existing[0] === undefined) {
    const inserted = await db
      .insert(members)
      .values({ email, fullName, status: "active" })
      .returning({ id: members.id });
    memberId = inserted[0]!.id;
    created = true;
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

  // Audited on every run, not only the first: the log should record when the bootstrap was executed
  // and whether it changed anything, which is what FR-7 asks of a privilege change.
  await writeAudit(db, {
    actorMemberId: memberId,
    action: "bootstrap.super_admin",
    entityType: "member",
    entityId: memberId,
    after: { email, createdMember: created, roleKey: "super_admin" },
  });
  console.log("audited bootstrap.super_admin");

  console.log("\nready — sign in at https://pi-core-api-staging.pmkitera.workers.dev/sign-in");
} finally {
  await pool.end();
}
