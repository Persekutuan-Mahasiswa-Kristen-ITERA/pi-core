/**
 * Proof of the invite-only guard (story 3.2) and session revocation (story 3.5) against a real
 * database.
 *
 * The guard is `newMemberGuard` — the body of Better Auth's `databaseHooks.user.create.before`. It is
 * exercised **directly** because the live path needs a Google account that is not on the ITERA
 * allowlist, and creating one is not something this project can do for itself. What that leaves
 * unproven is only the library's own plumbing (that it calls the hook and turns the thrown error into
 * its error page); the decision, the audit row and the message are all verified here.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/api exec tsx scripts/verify-signin-guard.ts
 */
import { createDb, countSessionsForMember, revokeSessionsForMember } from "@pi-core/db";
import { auditLogs, authSessions, members } from "@pi-core/db/schema";
import { GENERIC_SIGN_IN_DENIAL } from "@pi-core/shared";
import { eq, inArray } from "drizzle-orm";
import { newMemberGuard } from "../src/auth";

const url = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DIRECT_DATABASE_URL) is required");
  process.exit(1);
}

const { db, pool } = createDb(url);
let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failed += 1;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`}`,
  );
}

const TAG = `verify-guard-${Date.now()}`;
const guard = newMemberGuard(db);
const ids: string[] = [];

/** Run the guard and report what it did, without letting the throw escape. */
async function attempt(email: string, emailVerified = true): Promise<{ threw: boolean; message?: string }> {
  try {
    await guard({ email, emailVerified });
    return { threw: false };
  } catch (error) {
    return { threw: true, message: (error as { body?: { message?: string } }).body?.message };
  }
}

try {
  const denialsBefore = (
    await db.select({ n: auditLogs.id }).from(auditLogs).where(eq(auditLogs.action, "auth.denied"))
  ).length;

  // ---- 3.2: an unknown address is refused, generically, and audited ----------
  console.log("FR-4/FR-7/NFR-3 — an allowlisted domain with no member row is refused and audited");
  const unknown = await attempt(`${TAG}-stranger@student.itera.ac.id`);
  check("the guard throws", unknown.threw, true);
  check("with the single generic message", unknown.message, GENERIC_SIGN_IN_DENIAL);

  console.log("\nFR-3 — a non-allowlisted domain is refused, with the same message");
  const offList = await attempt(`${TAG}-someone@example.com`);
  check("the guard throws", offList.threw, true);
  check("same generic message, so the two cases are indistinguishable", offList.message, unknown.message);

  const denials = await db
    .select({ after: auditLogs.after })
    .from(auditLogs)
    .where(eq(auditLogs.action, "auth.denied"))
    .orderBy(auditLogs.at);
  // Take the two most recent rather than filtering by our TAG: the audit deliberately stores only the
  // **domain**, never the full address, so the TAG cannot appear in the payload at all (which the
  // next check asserts). Filtering by it would make this assertion untestable.
  const lastTwo = denials.slice(-2);
  check("two new audit rows", denials.length - denialsBefore, 2);
  check(
    "the reasons are recorded precisely in the log",
    lastTwo
      .map((d) => (d.after as { reason?: string } | null)?.reason)
      .sort()
      .filter((r): r is string => r !== undefined),
    ["domain_not_allowed", "member_unknown"],
  );
  check(
    "no full address anywhere in the audit payload",
    denials.some((d) => JSON.stringify(d.after ?? "").includes(TAG)),
    false,
  );

  // ---- the invite-only invariant: an existing member is not refused ----------
  console.log("\nFR-4 — an address that DOES have an active member row is not refused by the guard");
  const existing = await db
    .insert(members)
    .values({ email: `${TAG}-member@student.itera.ac.id`, fullName: "Existing", emailVerified: true })
    .returning({ id: members.id });
  ids.push(existing[0]!.id);
  const admitted = await attempt(`${TAG}-member@student.itera.ac.id`);
  check("the guard does not throw (Better Auth would have linked, not created)", admitted.threw, false);

  // ---- 3.5: revocation is immediate and audited -----------------------------
  console.log("\nFR-5 — revoking ends access now, and the revocation is audited");
  const memberId = ids[0]!;
  await db.insert(authSessions).values([
    {
      token: `${TAG}-token-1`,
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: memberId,
    },
    {
      token: `${TAG}-token-2`,
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: memberId,
    },
  ]);
  check("two sessions exist", await countSessionsForMember(db, memberId), 2);

  const removed = await revokeSessionsForMember(db, memberId, { reason: "member_deactivated" });
  check("both were revoked", removed, 2);
  check("none remain — the window is zero, not the token lifetime", await countSessionsForMember(db, memberId), 0);

  const revocationAudit = await db
    .select({ after: auditLogs.after })
    .from(auditLogs)
    .where(eq(auditLogs.action, "auth.sessions_revoked"))
    .orderBy(auditLogs.at);
  check("the revocation was audited", revocationAudit.length >= 1, true);
  check(
    "and it says how many sessions went",
    (revocationAudit.at(-1)?.after as { sessionsRevoked?: number } | undefined)?.sessionsRevoked,
    2,
  );
} finally {
  if (ids.length > 0) {
    await db.delete(authSessions).where(inArray(authSessions.userId, ids));
    await db.delete(members).where(inArray(members.id, ids));
  }
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
