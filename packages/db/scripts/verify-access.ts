/**
 * End-to-end proof of FR-31 + FR-43 against a real database.
 *
 * Creates a small fixture (a period, members, assignments in the active and a non-active period,
 * and a system grant), resolves access with `loadActor`, checks the derived roles, the unit
 * subtree, the `U*` rank guard through `can()`, and that `writeAudit` redacts sensitive fields.
 * Cleans up everything except the audit row (which is append-only by design).
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-access.ts
 */
import { can } from "@pi-core/shared";
import { eq, inArray, sql } from "drizzle-orm";
import { loadActor, writeAudit } from "../src/access";
import { createDb } from "../src/client";
import {
  assignments,
  auditLogs,
  members,
  orgUnits,
  periods,
  positions,
  systemGrants,
} from "../src/schema";

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
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`}`);
}

const TAG = `verify-access-${Date.now()}`;
const KEEPER_EMAIL = "verify-keeper@student.itera.ac.id";

/**
 * FR-28 makes the *last* super_admin unremovable, so a verification run needs one that predates its
 * own fixture — otherwise cleanup cannot delete the grant it created. Idempotent by email.
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
  const activePeriods = await db.select({ id: periods.id }).from(periods).where(eq(periods.isActive, true));
  if (activePeriods.length > 0) {
    console.log(`SKIP: a period is already active (${activePeriods.length}); this script needs to own the active period.`);
    process.exit(0);
  }

  // ---- fixture -------------------------------------------------------------
  const dept = (
    await db.select({ id: orgUnits.id, path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.type, "department")).limit(1)
  )[0]!;
  const otherDept = (
    await db.select({ id: orgUnits.id, path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.type, "department")).limit(20)
  ).find((d) => d.id !== dept.id)!;
  const divisions = await db
    .select({ id: orgUnits.id })
    .from(orgUnits)
    .where(sql`${orgUnits.type} = 'division' and ${orgUnits.path} like ${`${dept.path}%`}`);
  const myDivision = divisions[0]!;
  const otherDivision = (
    await db.select({ id: orgUnits.id }).from(orgUnits).where(eq(orgUnits.type, "division")).limit(40)
  ).find((d) => !divisions.some((mine) => mine.id === d.id))!;

  const [activePeriod] = await db
    .insert(periods)
    .values({ label: `${TAG}-active`, startDate: "2026-01-01", endDate: "2026-12-31", isActive: true })
    .returning({ id: periods.id });
  const [pastPeriod] = await db
    .insert(periods)
    .values({ label: `${TAG}-past`, startDate: "2025-01-01", endDate: "2025-12-31", isActive: false })
    .returning({ id: periods.id });

  const [sekretarisMember, staffMember, adminMember, grantMember] = await db
    .insert(members)
    .values([
      { email: `${TAG}-sek@student.itera.ac.id`, fullName: "Sekretaris Verify" },
      { email: `${TAG}-staff@student.itera.ac.id`, fullName: "Staff Verify" },
      { email: `${TAG}-admin@student.itera.ac.id`, fullName: "Admin Verify" },
      { email: `${TAG}-grant@student.itera.ac.id`, fullName: "Grant Verify" },
    ])
    .returning({ id: members.id });

  const positionByKey = new Map(
    (await db.select({ id: positions.id, key: positions.key }).from(positions)).map((p) => [p.key, p.id]),
  );
  const pid = (key: string) => positionByKey.get(key)!;

  // `unit_type`/`is_unique_per_unit` are overwritten by the `assignments_fill_from_position`
  // trigger; they are passed here only to satisfy the insert type.
  await db.insert(assignments).values([
    // Active period: Sekretaris Departemen in the department, Staff in one of its divisions.
    { memberId: sekretarisMember!.id, orgUnitId: dept.id, positionId: pid("sekretaris_departemen"), periodId: activePeriod!.id, unitType: "department" },
    { memberId: staffMember!.id, orgUnitId: myDivision.id, positionId: pid("staff"), periodId: activePeriod!.id, unitType: "division" },
    // Kepala Departemen (also organization_admin via ADR-0002) — in the OTHER department.
    { memberId: adminMember!.id, orgUnitId: otherDept.id, positionId: pid("kepala_departemen"), periodId: activePeriod!.id, unitType: "department" },
    // A past-period assignment that must grant nothing.
    { memberId: sekretarisMember!.id, orgUnitId: myDivision.id, positionId: pid("kepala_divisi"), periodId: pastPeriod!.id, unitType: "division" },
  ]);

  // The system grant goes to a member with NO assignment, so it cannot mask the scope assertions.
  await ensureKeeperSuperAdmin();
  await db.insert(systemGrants).values({ memberId: grantMember!.id, roleKey: "super_admin", grantedBy: adminMember!.id });

  // ---- FR-31: effective roles ---------------------------------------------
  console.log("\nFR-31 — effective roles");
  const sek = await loadActor(db, sekretarisMember!.id, "2026-06-01");
  check("sekretaris roles = anggota + sekretaris (past-period kepala_divisi ignored)", sek.actor.roles, ["anggota", "sekretaris"]);
  check("sekretaris: 1 active assignment, 1 ignored", [sek.activeAssignments.length, sek.ignoredAssignments.length], [1, 1]);

  const staff = await loadActor(db, staffMember!.id, "2026-06-01");
  check("staff roles = anggota + staff", staff.actor.roles, ["anggota", "staff"]);

  const granted = await loadActor(db, grantMember!.id, "2026-06-01");
  check("system grant alone: roles = anggota + super_admin", granted.actor.roles, ["anggota", "super_admin"]);
  check("system grant holder has no unit scope", granted.actor.unitScope, []);

  const admin = await loadActor(db, adminMember!.id, "2026-06-01");
  check("kepala_departemen roles include organization_admin (ADR-0002)", admin.actor.roles, ["anggota", "kepala_departemen", "organization_admin"]);

  // ---- unit scope + rank ---------------------------------------------------
  console.log("\nU scope and the §3 U* rank guard");
  check("sekretaris unitScope = the department subtree", sek.actor.unitScope?.includes(dept.id), true);
  check("…and includes its divisions", sek.actor.unitScope?.includes(myDivision.id), true);
  check("…and NOT another department", sek.actor.unitScope?.includes(otherDept.id), false);
  check("sekretaris highestRankByUnit[department] = 50 (its own rank)", sek.actor.highestRankByUnit?.[dept.id], 50);

  const asg = (orgUnitId: string, positionRank: number) => ({ kind: "assignment" as const, orgUnitId, positionRank });
  check("sekretaris MAY manage a more junior assignment (staff 70 > 50)", can(sek.actor, "assignment:manage", asg(dept.id, 70)), true);
  check("sekretaris may NOT manage an equal-rank assignment (50)", can(sek.actor, "assignment:manage", asg(dept.id, 50)), false);
  check("sekretaris may NOT manage a more senior assignment (10)", can(sek.actor, "assignment:manage", asg(dept.id, 10)), false);
  check("sekretaris may NOT manage outside its subtree", can(sek.actor, "assignment:manage", asg(otherDept.id, 70)), false);

  console.log("\nscope O vs U");
  check("staff: member:read inside its division = allowed (U)", can(staff.actor, "member:read", { kind: "unit", orgUnitId: myDivision.id }), true);
  check("staff: member:read in another division = denied", can(staff.actor, "member:read", { kind: "unit", orgUnitId: otherDivision.id }), false);
  check("staff: member:create = denied (no grant)", can(staff.actor, "member:create", { kind: "org" }), false);
  check("super_admin grant: role:manage org-wide = allowed (O)", can(granted.actor, "role:manage", { kind: "org" }), true);
  check("super_admin grant: assignment:manage is O, so no rank guard applies", can(granted.actor, "assignment:manage", asg(dept.id, 10)), true);

  // ---- the ADR-0002 consequence -------------------------------------------
  console.log("\nFinding — ADR-0002 makes the U* rank guard inert for Kepala Departemen");
  check(
    "kepala_departemen: assignment:manage is O (organization_admin), so a rank-10 assignment elsewhere is ALLOWED",
    can(admin.actor, "assignment:manage", asg(dept.id, 10)),
    true,
  );

  // ---- FR-43: audit write + redaction -------------------------------------
  console.log("\nFR-43 — audit append + redaction");
  const auditId = await writeAudit(db, {
    actorMemberId: adminMember!.id,
    action: "verify.access",
    entityType: "member",
    entityId: staffMember!.id,
    before: { full_name: "Staff Verify", nim: "121140999", phone: "+6280000000" },
    after: { full_name: "Staff Verify", nim: "121140998", phone: "+6280000001" },
    requestId: TAG,
  });
  const [auditRow] = await db.select().from(auditLogs).where(eq(auditLogs.id, auditId));
  check("audit row written", auditRow !== undefined, true);
  check("before.nim redacted", (auditRow!.before as Record<string, unknown>)["nim"], "[redacted]");
  check("before.phone redacted", (auditRow!.before as Record<string, unknown>)["phone"], "[redacted]");
  check("before.full_name kept", (auditRow!.before as Record<string, unknown>)["full_name"], "Staff Verify");

  // ---- cleanup -------------------------------------------------------------
  await db.delete(systemGrants).where(inArray(systemGrants.memberId, [grantMember!.id]));
  await db.delete(assignments).where(inArray(assignments.memberId, [sekretarisMember!.id, staffMember!.id, adminMember!.id, grantMember!.id]));
  await db.delete(members).where(inArray(members.id, [sekretarisMember!.id, staffMember!.id, adminMember!.id, grantMember!.id]));
  await db.delete(periods).where(inArray(periods.id, [activePeriod!.id, pastPeriod!.id]));
  console.log("\nfixture cleaned up (the audit row stays — append-only by design)");

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"}: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
