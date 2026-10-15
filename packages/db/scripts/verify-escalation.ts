/**
 * End-to-end proof of FR-27 (rank-based escalation guard, self-edit) and FR-28 (last super_admin)
 * against a real database: build a fixture, resolve the actors with the production `loadActor`, and
 * assert that each escalation attempt is **refused and audited**, that the last `super_admin` cannot
 * be removed (both through `revokeSystemGrant` and by a raw DELETE, which the trigger blocks), and
 * that a legitimate revoke still works.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-escalation.ts
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  enforceAssignmentChange,
  loadActor,
  revokeSystemGrant,
} from "../src/access";
import { createDb } from "../src/client";
import { assignments, auditLogs, members, orgUnits, periods, positions, systemGrants } from "../src/schema";

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

const TAG = `verify-escalation-${Date.now()}`;
const KEEPER_EMAIL = "verify-keeper@student.itera.ac.id";

/**
 * FR-28 makes the *last* super_admin unremovable, so the run needs one that predates its fixture —
 * otherwise its own grants could never be cleaned up. Idempotent by email.
 */
async function ensureKeeperSuperAdmin(): Promise<string> {
  await db.insert(members).values({ email: KEEPER_EMAIL, fullName: "Verification Keeper" }).onConflictDoNothing();
  const [row] = await db.select({ id: members.id }).from(members).where(eq(members.email, KEEPER_EMAIL));
  await db
    .insert(systemGrants)
    .values({ memberId: row!.id, roleKey: "super_admin", grantedBy: null })
    .onConflictDoNothing();
  return row!.id;
}

try {
  const active = await db.select({ id: periods.id }).from(periods).where(eq(periods.isActive, true));
  if (active.length > 0) {
    console.log("SKIP: a period is already active; this script needs to own the active period.");
    process.exit(0);
  }

  // ---- fixture -------------------------------------------------------------
  const dept = (
    await db.select({ id: orgUnits.id, path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.type, "department")).limit(1)
  )[0]!;
  const otherDept = (
    await db.select({ id: orgUnits.id, path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.type, "department")).limit(20)
  ).find((d) => d.id !== dept.id)!;
  const myDivision = (
    await db
      .select({ id: orgUnits.id })
      .from(orgUnits)
      .where(sql`${orgUnits.type} = 'division' and ${orgUnits.path} like ${`${dept.path}%`}`)
  )[0]!;

  const [period] = await db
    .insert(periods)
    .values({ label: `${TAG}-p`, startDate: "2026-01-01", endDate: "2026-12-31", isActive: true })
    .returning({ id: periods.id });

  const [sekretarisM, kadepM, superM, targetM] = await db
    .insert(members)
    .values([
      { email: `${TAG}-sek@student.itera.ac.id`, fullName: "Sekretaris" },
      { email: `${TAG}-kadep@student.itera.ac.id`, fullName: "Kadep" },
      { email: `${TAG}-super@student.itera.ac.id`, fullName: "Super" },
      { email: `${TAG}-target@student.itera.ac.id`, fullName: "Target" },
    ])
    .returning({ id: members.id });

  const pid = new Map(
    (await db.select({ id: positions.id, key: positions.key }).from(positions)).map((p) => [p.key, p.id]),
  );

  await db.insert(assignments).values([
    // Sekretaris Departemen: assignment:manage at U, rank 50, inside this department.
    { memberId: sekretarisM!.id, orgUnitId: dept.id, positionId: pid.get("sekretaris_departemen")!, periodId: period!.id, unitType: "department" },
    // A Kepala Departemen in the OTHER department, to show O scope is not rank-limited (ADR-0002).
    { memberId: kadepM!.id, orgUnitId: otherDept.id, positionId: pid.get("kepala_departemen")!, periodId: period!.id, unitType: "department" },
  ]);

  // Two super_admins are added by the fixture, on top of the keeper and whatever already exists.
  const keeperId = await ensureKeeperSuperAdmin();
  const preexisting = (
    await db.select({ n: sql<number>`count(*)::int` }).from(systemGrants).where(eq(systemGrants.roleKey, "super_admin"))
  )[0]!.n;
  await db.insert(systemGrants).values([
    { memberId: superM!.id, roleKey: "super_admin", grantedBy: null },
    { memberId: kadepM!.id, roleKey: "super_admin", grantedBy: null },
  ]);

  const sekretaris = (await loadActor(db, sekretarisM!.id, "2026-06-01")).actor;
  const kadep = (await loadActor(db, kadepM!.id, "2026-06-01")).actor;
  const superActor = (await loadActor(db, superM!.id, "2026-06-01")).actor;

  const denialsBefore = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(eq(auditLogs.action, "authorization.denied"));
  const denials0 = denialsBefore[0]!.n;

  // ---- FR-27 ---------------------------------------------------------------
  console.log("\nFR-27 — a U-scoped manager cannot escalate");
  const junior = await enforceAssignmentChange(db, {
    actor: sekretaris,
    target: { orgUnitId: myDivision.id, positionRank: 70, memberId: targetM!.id },
    request: { requestId: TAG },
  });
  check("junior position inside the subtree is allowed", junior, { allowed: true });

  const senior = await enforceAssignmentChange(db, {
    actor: sekretaris,
    target: { orgUnitId: dept.id, positionRank: 10, memberId: targetM!.id },
    request: { requestId: TAG },
  });
  check("more senior position refused, with reason", senior.allowed === false && senior.reason, "rank_not_junior");
  check("refusal returned an audit id", typeof (senior as { auditId?: string }).auditId === "string", true);

  const outside = await enforceAssignmentChange(db, {
    actor: sekretaris,
    target: { orgUnitId: otherDept.id, positionRank: 70, memberId: targetM!.id },
    request: { requestId: TAG },
  });
  check("unit outside the subtree refused, with reason", outside.allowed === false && outside.reason, "target_outside_scope");

  const selfEdit = await enforceAssignmentChange(db, {
    actor: sekretaris,
    target: { orgUnitId: myDivision.id, positionRank: 70, memberId: sekretarisM!.id },
    request: { requestId: TAG },
  });
  check("editing your own assignment refused, with reason", selfEdit.allowed === false && selfEdit.reason, "self_edit_forbidden");

  const adminOutside = await enforceAssignmentChange(db, {
    actor: kadep,
    target: { orgUnitId: dept.id, positionRank: 10, memberId: targetM!.id },
    request: { requestId: TAG },
  });
  check("org admin (ADR-0002) is NOT rank-limited — allowed, by owner decision", adminOutside, { allowed: true });

  const denialsAfter = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(eq(auditLogs.action, "authorization.denied"));
  check("exactly the 3 refusals were audited", denialsAfter[0]!.n - denials0, 3);

  const latest = await db
    .select({ after: auditLogs.after, actorMemberId: auditLogs.actorMemberId })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "authorization.denied"), eq(auditLogs.requestId, TAG)))
    .orderBy(sql`${auditLogs.at} desc`)
    .limit(1);
  check("the audit row names the actor", latest[0]!.actorMemberId, sekretarisM!.id);
  check(
    "the audit row carries the machine-readable reason",
    (latest[0]!.after as Record<string, unknown>)["reason"],
    "self_edit_forbidden",
  );

  // ---- FR-28 ---------------------------------------------------------------
  console.log("\nFR-28 — the last super_admin cannot be removed");
  const okRevoke = await revokeSystemGrant(db, { actor: superActor, memberId: kadepM!.id, roleKey: "super_admin", request: { requestId: TAG } });
  check("revoking while another super_admin remains is allowed", okRevoke, { allowed: true });

  const okRevoke2 = await revokeSystemGrant(db, { actor: superActor, memberId: superM!.id, roleKey: "super_admin", request: { requestId: TAG } });
  check("revoking the second-to-last is still allowed", okRevoke2, { allowed: true });

  // Only the keeper is left, so this is the last one.
  const lastRevoke = await revokeSystemGrant(db, { actor: superActor, memberId: keeperId, roleKey: "super_admin", request: { requestId: TAG } });
  check("revoking the last super_admin refused, with reason", lastRevoke.allowed === false && lastRevoke.reason, "last_super_admin");

  // A raw DELETE must also be refused — by the trigger, not by application code. Drizzle wraps the
  // driver error, so look through the `cause` chain for the RAISE message.
  let triggerError: string | null = null;
  try {
    await db.delete(systemGrants).where(and(eq(systemGrants.memberId, keeperId), eq(systemGrants.roleKey, "super_admin")));
  } catch (error) {
    const parts: string[] = [];
    for (let current: unknown = error; current !== null && current !== undefined; ) {
      if (current instanceof Error) {
        parts.push(current.message);
        current = (current as { cause?: unknown }).cause;
      } else {
        parts.push(String(current));
        break;
      }
    }
    triggerError = parts.join(" | ");
  }
  check("a raw DELETE of the last super_admin is refused by the DB trigger", triggerError !== null && /last super_admin/.test(triggerError), true);
  if (triggerError === null) console.log("         (no error was thrown — the delete went through)");
  else console.log(`         trigger said: ${triggerError.slice(0, 140)}`);

  const remaining = await db.select({ n: sql<number>`count(*)::int` }).from(systemGrants).where(eq(systemGrants.roleKey, "super_admin"));
  check("the keeper is the only super_admin left", remaining[0]!.n, preexisting);

  // ---- cleanup -------------------------------------------------------------
  // The keeper super_admin stays (FR-28 makes the last one unremovable); everything else goes.
  await db.delete(systemGrants).where(inArray(systemGrants.memberId, [kadepM!.id, superM!.id]));
  await db.delete(assignments).where(inArray(assignments.memberId, [sekretarisM!.id, kadepM!.id]));
  await db.delete(members).where(inArray(members.id, [sekretarisM!.id, kadepM!.id, superM!.id, targetM!.id]));
  await db.delete(periods).where(eq(periods.id, period!.id));
  console.log("\nfixture cleaned up — the keeper super_admin and the audit rows stay by design");

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"}: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
