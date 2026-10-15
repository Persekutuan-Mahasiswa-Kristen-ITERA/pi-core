/**
 * Proof of the **session** admission path (FR-3, FR-5, FR-7) against a real database.
 *
 * `resolveSessionAdmission` runs on every request, not just at sign-in, because admission can change
 * after a session was issued: a member can be deactivated, or an email domain removed from the
 * allowlist. This asserts the decisions *and* that each refusal is audited with `stage: "session"`,
 * which is what distinguishes it from a sign-in refusal in the audit log.
 *
 * Run the domain seed first:  pnpm --filter @pi-core/db db:seed:domains
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-session-admission.ts
 */
import type { SignInDecision } from "@pi-core/shared";
import { eq, inArray, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { auditLogs, members } from "../src/schema";
import { loadAllowedDomains, resolveSessionAdmission } from "../src/sign-in";

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

const TAG = `verify-session-${Date.now()}`;
const ids: string[] = [];

/** `SignInDecision` is a discriminated union, so the reason only exists on the refusal branch. */
const reasonOf = (decision: SignInDecision): string => (decision.allowed ? "allowed" : decision.reason);

try {
  const domains = await loadAllowedDomains(db);
  if (domains.length === 0) {
    console.log("SKIP: no allowlist rows — run `pnpm --filter @pi-core/db db:seed:domains` first.");
    process.exit(0);
  }
  console.log(`allowlist loaded: ${domains.map((d) => d.domain).join(", ")}\n`);

  const rows = await db
    .insert(members)
    .values([
      {
        email: `${TAG}-active@student.itera.ac.id`,
        fullName: "Active",
        emailVerified: true,
      },
      {
        email: `${TAG}-inactive@student.itera.ac.id`,
        fullName: "Inactive",
        emailVerified: true,
        status: "inactive",
      },
      {
        email: `${TAG}-unverified@student.itera.ac.id`,
        fullName: "Unverified",
        emailVerified: false,
      },
      {
        email: `${TAG}-outsider@example.com`,
        fullName: "Outside the allowlist",
        emailVerified: true,
      },
    ])
    .returning({ id: members.id });
  ids.push(...rows.map((r) => r.id));
  const [activeId, inactiveId, unverifiedId, outsiderId] = ids as [string, string, string, string];

  const countDenials = async (): Promise<number> =>
    (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(eq(auditLogs.action, "auth.denied"))
    )[0]!.n;
  const denialsBefore = await countDenials();

  // ---- the happy path -------------------------------------------------------
  console.log("FR-3 — an active, verified, allowlisted member is admitted");
  const ok = await resolveSessionAdmission(db, activeId);
  check("allowed", ok.decision.allowed, true);
  check("member resolved", ok.member?.id, activeId);
  check("no audit row for an admission", await countDenials(), denialsBefore);

  // ---- the refusals ---------------------------------------------------------
  console.log("\nFR-5 — a member deactivated *after* the session was issued is refused");
  const inactive = await resolveSessionAdmission(db, inactiveId, { ip: "203.0.113.9", userAgent: "verify/1.0" });
  check("allowed", inactive.decision.allowed, false);
  check("reason", reasonOf(inactive.decision), "member_inactive");

  console.log("\nNFR-1 — an unverified address is refused");
  const unverified = await resolveSessionAdmission(db, unverifiedId);
  check("allowed", unverified.decision.allowed, false);
  check("reason", reasonOf(unverified.decision), "email_not_verified");

  console.log("\nFR-3 — a domain that is not on the allowlist is refused");
  const outsider = await resolveSessionAdmission(db, outsiderId);
  check("allowed", outsider.decision.allowed, false);
  check("reason", reasonOf(outsider.decision), "domain_not_allowed");

  console.log("\nFR-7 — every refusal is audited, tagged as a *session* refusal");
  // Filter to this run's fixtures: `audit_logs` is append-only, so earlier runs' denial rows are
  // still present and would otherwise be picked up. And order by `created_at`, not by `id` — the id
  // is a random uuid, so ordering by it is not chronological (this test caught exactly that).
  const denials = await db
    .select({ after: auditLogs.after, ip: auditLogs.ip })
    .from(auditLogs)
    .where(inArray(auditLogs.entityId, ids))
    .orderBy(auditLogs.at);
  check("three new denials", (await countDenials()) - denialsBefore, 3);
  check(
    "stage is 'session' on all three",
    denials.map((d) => (d.after as { stage?: string } | null)?.stage),
    ["session", "session", "session"],
  );
  check(
    "reasons recorded precisely",
    denials
      .map((d) => (d.after as { reason?: string } | null)?.reason)
      .sort(),
    ["domain_not_allowed", "email_not_verified", "member_inactive"],
  );
  check(
    "the request metadata is kept",
    denials.some((d) => d.ip === "203.0.113.9"),
    true,
  );
  check(
    "only the domain is stored, never the full address",
    denials.some((d) => JSON.stringify(d.after ?? {}).includes("outsider@")),
    false,
  );

  console.log("\nFR-7 — an unknown member id is refused, not crashed on");
  const ghost = await resolveSessionAdmission(db, "00000000-0000-0000-0000-000000000000");
  check("allowed", ghost.decision.allowed, false);
  check("member", ghost.member, null);
} finally {
  if (ids.length > 0) {
    // `audit_logs` is append-only by trigger (FR-43), so the denial rows this script produced are
    // deliberately left behind — that is the behaviour under test, not an oversight. Only the
    // fixture members are removed.
    await db.delete(members).where(inArray(members.id, ids));
  }
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
