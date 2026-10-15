/**
 * End-to-end proof of the sign-in admission path (FR-1, FR-3, FR-4, FR-7) against a real database:
 * build a fixture, resolve attempts through the production `resolveSignIn`, and assert both the
 * decisions and that every refusal was **audited with its precise reason** while the client only
 * ever sees one generic message.
 *
 * Run the domain seed first:  pnpm --filter @pi-core/db db:seed:domains
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-signin.ts
 */
import { GENERIC_SIGN_IN_DENIAL, type SignInDenialReason } from "@pi-core/shared";
import { eq, inArray, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { auditLogs, members } from "../src/schema";
import { findMemberForSignIn, loadAllowedDomains, resolveSignIn } from "../src/sign-in";

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

const TAG = `verify-signin-${Date.now()}`;

try {
  const domains = await loadAllowedDomains(db);
  if (domains.length === 0) {
    console.log("SKIP: no allowlist rows — run `pnpm --filter @pi-core/db db:seed:domains` first.");
    process.exit(0);
  }
  console.log(`allowlist loaded: ${domains.map((d) => d.domain).join(", ")}\n`);

  const [active, inactive, subLinked] = await db
    .insert(members)
    .values([
      { email: `${TAG}-active@student.itera.ac.id`, fullName: "Active" },
      { email: `${TAG}-inactive@student.itera.ac.id`, fullName: "Inactive", status: "inactive" },
      { email: `${TAG}-sub@student.itera.ac.id`, fullName: "Sub linked", googleSub: `${TAG}-sub` },
    ])
    .returning({ id: members.id });

  const before = (
    await db.select({ n: sql<number>`count(*)::int` }).from(auditLogs).where(eq(auditLogs.action, "auth.denied"))
  )[0]!.n;

  // ---- FR-1: the happy path -------------------------------------------------
  console.log("FR-1 — an allowed, verified, active member is admitted");
  const admitted = await resolveSignIn(db, {
    email: `${TAG}-active@student.itera.ac.id`,
    emailVerified: true,
    request: { requestId: TAG },
  });
  check("admitted", admitted.decision, { allowed: true, memberId: active!.id, linkGoogleSub: true });
  check("the member row is returned", admitted.member?.id, active!.id);

  const alreadyLinked = await resolveSignIn(db, {
    email: `${TAG}-sub@student.itera.ac.id`,
    emailVerified: true,
    request: { requestId: TAG },
  });
  check("an existing google_sub is not relinked", alreadyLinked.decision, {
    allowed: true,
    memberId: subLinked!.id,
    linkGoogleSub: false,
  });

  // ---- FR-4: google_sub is preferred for matching ---------------------------
  console.log("\nFR-4 — google_sub is preferred over the email");
  const bySub = await resolveSignIn(db, {
    // A DIFFERENT, still-allowlisted email, but the google_sub belongs to `subLinked`.
    email: `${TAG}-renamed@student.itera.ac.id`,
    emailVerified: true,
    googleSub: `${TAG}-sub`,
    request: { requestId: TAG },
  });
  check("matched by google_sub, not by the new email", bySub.decision, {
    allowed: true,
    memberId: subLinked!.id,
    linkGoogleSub: false,
  });

  const lookupBySub = await findMemberForSignIn(db, { email: "nobody@student.itera.ac.id", googleSub: `${TAG}-sub` });
  check("findMemberForSignIn prefers google_sub", lookupBySub?.id, subLinked!.id);

  // ---- refusals (FR-3, FR-4, NFR-1) ----------------------------------------
  console.log("\nRefusals — each with a precise reason, audited");
  const cases: Array<{ label: string; input: Parameters<typeof resolveSignIn>[1]; reason: SignInDenialReason }> = [
    {
      label: "non-allowlisted domain (FR-3)",
      input: { email: `${TAG}@gmail.com`, emailVerified: true, request: { requestId: TAG } },
      reason: "domain_not_allowed",
    },
    {
      label: "pmkitera.web.id is not allowlisted (ADR-0005)",
      input: { email: `${TAG}@pmkitera.web.id`, emailVerified: true, request: { requestId: TAG } },
      reason: "domain_not_allowed",
    },
    {
      label: "unknown member — invite-only (FR-4)",
      input: { email: `${TAG}-ghost@student.itera.ac.id`, emailVerified: true, request: { requestId: TAG } },
      reason: "member_unknown",
    },
    {
      label: "inactive member (FR-4)",
      input: { email: `${TAG}-inactive@student.itera.ac.id`, emailVerified: true, request: { requestId: TAG } },
      reason: "member_inactive",
    },
    {
      label: "email_verified = false (NFR-1)",
      input: { email: `${TAG}-active@student.itera.ac.id`, emailVerified: false, request: { requestId: TAG } },
      reason: "email_not_verified",
    },
    {
      label: "no email claim",
      input: { emailVerified: true, request: { requestId: TAG } },
      reason: "email_missing",
    },
  ];

  for (const testCase of cases) {
    const result = await resolveSignIn(db, testCase.input);
    const reason = result.decision.allowed ? "(allowed)" : result.decision.reason;
    check(testCase.label, reason, testCase.reason);
    check(`${testCase.label} → generic message only (NFR-3)`, result.message, GENERIC_SIGN_IN_DENIAL);
    check(`${testCase.label} → audited (FR-7)`, typeof result.auditId === "string", true);
  }

  const after = (
    await db.select({ n: sql<number>`count(*)::int` }).from(auditLogs).where(eq(auditLogs.action, "auth.denied"))
  )[0]!.n;
  check("exactly the 6 refusals were audited", after - before, 6);

  const rows = await db
    .select({ after: auditLogs.after, ip: auditLogs.ip, actorMemberId: auditLogs.actorMemberId })
    .from(auditLogs)
    .where(eq(auditLogs.requestId, TAG))
    .orderBy(sql`${auditLogs.at} asc`);

  const reasons = rows
    .map((row) => (row.after as Record<string, unknown>)["reason"])
    .filter((r): r is string => typeof r === "string");
  check("the audit rows carry the six precise reasons", reasons.sort(), [
    "domain_not_allowed",
    "domain_not_allowed",
    "email_missing",
    "email_not_verified",
    "member_inactive",
    "member_unknown",
  ]);

  const serialised = JSON.stringify(rows);
  check("no full email address is stored in the audit rows", serialised.includes("@"), false);
  check("the audit rows record the domain instead", reasons.length === 6 && serialised.includes("student.itera.ac.id"), true);

  // ---- cleanup -------------------------------------------------------------
  await db.delete(members).where(inArray(members.id, [active!.id, inactive!.id, subLinked!.id]));
  console.log("\nfixture cleaned up (audit rows stay — append-only by design)");

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"}: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
