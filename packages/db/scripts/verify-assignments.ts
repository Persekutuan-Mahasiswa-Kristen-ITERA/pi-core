/**
 * Proof of the assignment rules — story 4.8 (FR-27, FR-31, FR-32, FR-33) — against a real database.
 *
 * The assertion that matters most is FR-31/FR-33 together: an assignment only grants access through the
 * ACTIVE period, and ending one must actually take the access away. Those are properties of
 * `effectiveRoles`, so this script feeds it the same facts the runtime does (`assignmentFactsFor`) rather
 * than a hand-written imitation — an imitation would pass while the real path was broken.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-assignments.ts
 */
import { effectiveRoles, type RoleKey } from "@pi-core/shared";
import { and, eq, inArray, isNull, like } from "drizzle-orm";
import { createDb } from "../src/client";
import {
  assignmentFactsFor,
  AssignmentError,
  createAssignment,
  derivedRolesForPosition,
  listAssignments,
  listPositions,
  updateAssignment,
} from "../src/assignments";
import { assignments, auditLogs, members, orgUnits, periods, positionRoles, roles } from "../src/schema";

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

async function failureOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "no error";
  } catch (error) {
    return error instanceof AssignmentError ? error.code : `wrong error: ${String(error).slice(0, 90)}`;
  }
}

const TAG = `verify-assignments-${Date.now()}`;
const createdMembers: string[] = [];
let createdPeriodId: string | null = null;
const createdAssignmentIds: string[] = [];

try {
  const [root] = await db.select().from(orgUnits).where(isNull(orgUnits.parentId)).limit(1);
  const [department] = await db.select().from(orgUnits).where(eq(orgUnits.type, "department")).limit(1);
  if (root === undefined || department === undefined) {
    console.log("SKIP: the organization tree is not seeded");
    process.exit(0);
  }

  /**
   * The acting admin must be a REAL member row, not a made-up uuid.
   *
   * `assignments.created_by` has a foreign key to `members`, so an invented actor id fails the insert
   * with a foreign-key violation — which the create path then reported as `unit_type_mismatch`, sending
   * me looking at unit types for a problem that was a missing member. The audit table has no such FK, so
   * the other scripts get away with a placeholder; this one cannot.
   */
  const [adminMember] = await db
    .insert(members)
    .values({ email: `${TAG}-admin@student.itera.ac.id`, fullName: "Verification Admin" })
    .returning({ id: members.id });
  createdMembers.push(adminMember!.id);
  const admin = { memberId: adminMember!.id, roles: ["super_admin"] as const };

  // ---- FR-32: the role is derived from the position, never supplied -------------
  console.log("FR-32 — the role is derived from the position");
  const positions = await listPositions(db);
  check("positions are listed with their derived roles", positions.length > 0, true);
  // Pick by UNIT TYPE, not by role: the point of the next assertions is that the unit and the position
  // agree, so choosing the position by the role it happens to carry would beg the question.
  const kadep = positions.find((p) => p.unitType === "department");
  check("a department position exists", kadep !== undefined, true);
  check("and it derives kepala_departemen", kadep!.roles.includes("kepala_departemen"), true);

  const derived = await derivedRolesForPosition(db, kadep!.id);
  const expectedRoles = await db
    .select({ key: roles.key })
    .from(positionRoles)
    .innerJoin(roles, eq(roles.id, positionRoles.roleId))
    .where(eq(positionRoles.positionId, kadep!.id));
  check(
    "the API's derivation is exactly what position_roles says — not a second implementation",
    derived,
    expectedRoles.map((r) => r.key).sort(),
  );
  check(
    "an unknown position is a not_found rather than an empty role list",
    await failureOf(() => derivedRolesForPosition(db, "00000000-0000-0000-0000-0000000000ff")),
    "not_found",
  );

  // ---- fixture ------------------------------------------------------------------
  const [member] = await db
    .insert(members)
    .values({ email: `${TAG}@student.itera.ac.id`, fullName: "Assignment Subject" })
    .returning({ id: members.id });
  createdMembers.push(member!.id);

  const [period] = await db
    .insert(periods)
    .values({ label: `${TAG}-p`, startDate: "2026-01-01", endDate: "2026-12-31", isActive: true })
    .returning({ id: periods.id });
  createdPeriodId = period!.id;

  const [otherPeriod] = await db
    .insert(periods)
    .values({ label: `${TAG}-p2`, startDate: "2025-01-01", endDate: "2025-12-31", isActive: false })
    .returning({ id: periods.id });

  // ---- FR-27 / create -----------------------------------------------------------
  console.log("\nFR-27 / FR-32 — creating an assignment");
  const created = await createAssignment(db, {
    actor: admin,
    input: { memberId: member!.id, orgUnitId: department.id, positionId: kadep!.id, periodId: period!.id },
  });
  createdAssignmentIds.push(created.id);
  check("the assignment is created", created.id.length > 0, true);
  check("it reports the derived role", created.derivedRoles, derived);
  check("it is marked as belonging to the active period", created.isActivePeriod, true);
  check(
    "the creation is audited",
    (await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.entityId, created.id))).length >= 1,
    true,
  );

  // The composite FK is the database's own guarantee that unit type matches the position.
  const [bureau] = await db.select().from(orgUnits).where(eq(orgUnits.type, "bureau")).limit(1);
  if (bureau !== undefined) {
    check(
      "a department position in a bureau is refused before the database has to say so",
      await failureOf(() =>
        createAssignment(db, {
          actor: admin,
          input: { memberId: member!.id, orgUnitId: bureau.id, positionId: kadep!.id, periodId: period!.id },
        }),
      ),
      "unit_type_mismatch",
    );
  }

  check(
    "an unknown period is refused",
    await failureOf(() =>
      createAssignment(db, {
        actor: admin,
        input: {
          memberId: member!.id,
          orgUnitId: department.id,
          positionId: kadep!.id,
          periodId: "00000000-0000-0000-0000-0000000000ff",
        },
      }),
    ),
    "period_not_found",
  );

  // ---- FR-31: only the ACTIVE period grants access ------------------------------
  console.log("\nFR-31 — only the active period grants access");
  const positionRolesMap = new Map<string, RoleKey[]>(
    (await listPositions(db)).map((p) => [p.id, p.roles]),
  );

  const activeFacts = await assignmentFactsFor(db, member!.id);
  const fromActive = effectiveRoles({
    memberId: member!.id,
    activePeriodId: period!.id,
    assignments: activeFacts,
    positionRoles: positionRolesMap,
    asOf: "2026-06-01",
  });
  check("the assignment in the active period grants its role", fromActive.roles.includes("kepala_departemen"), true);

  const fromOther = effectiveRoles({
    memberId: member!.id,
    activePeriodId: otherPeriod!.id,
    assignments: activeFacts,
    positionRoles: positionRolesMap,
    asOf: "2025-06-01",
  });
  check(
    "the same assignment grants NOTHING when another period is the active one",
    fromOther.roles.includes("kepala_departemen"),
    false,
  );
  check("but the member is still an anggota", fromOther.roles.includes("anggota"), true);

  // ---- FR-33: ending an assignment revokes access -------------------------------
  console.log("\nFR-33 — ending an assignment takes the access away");
  const ended = await updateAssignment(db, {
    actor: admin,
    id: created.id,
    input: { endsOn: "2026-05-31" },
  });
  check("the window is recorded", ended.endsOn, "2026-05-31");

  const afterEnd = effectiveRoles({
    memberId: member!.id,
    activePeriodId: period!.id,
    assignments: await assignmentFactsFor(db, member!.id),
    positionRoles: positionRolesMap,
    asOf: "2026-06-01",
  });
  check("the role is gone after the end date", afterEnd.roles.includes("kepala_departemen"), false);
  check(
    "and it was still granted BEFORE the end date — the window is a window, not a deletion",
    effectiveRoles({
      memberId: member!.id,
      activePeriodId: period!.id,
      assignments: await assignmentFactsFor(db, member!.id),
      positionRoles: positionRolesMap,
      asOf: "2026-05-01",
    }).roles.includes("kepala_departemen"),
    true,
  );
  check(
    "the ending is audited",
    (
      await db
        .select({ action: auditLogs.action })
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, "assignment.end")))
    ).length >= 1,
    true,
  );

  check(
    "an endsOn before startsOn is refused rather than stored",
    await failureOf(() => updateAssignment(db, { actor: admin, id: created.id, input: { startsOn: "2026-07-01" } })),
    "already_ended",
  );

  // ---- FR-33: a transfer re-runs the guard against the NEW destination ----------
  console.log("\nFR-33 — a transfer keeps the row's identity and re-checks the new destination");
  const [otherDepartment] = await db
    .select()
    .from(orgUnits)
    .where(and(eq(orgUnits.type, "department"), eq(orgUnits.isActive, true)))
    .limit(5);
  if (otherDepartment !== undefined && otherDepartment.id !== department.id) {
    const transferred = await updateAssignment(db, {
      actor: admin,
      id: created.id,
      input: { orgUnitId: otherDepartment.id, endsOn: null },
    });
    check("the row kept its id — a transfer is not a delete-and-recreate", transferred.id, created.id);
    check("the destination changed", transferred.orgUnitId, otherDepartment.id);
    check("the end date was cleared", transferred.endsOn, null);
    check(
      "the transfer is audited under its own action",
      (
        await db
          .select({ action: auditLogs.action })
          .from(auditLogs)
          .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, "assignment.transfer")))
      ).length >= 1,
      true,
    );
  }

  // ---- scoping -------------------------------------------------------------------
  console.log("\nFR-26 — an ordinary member sees only their own assignments");
  const asMember = await listAssignments(db, {
    actor: { memberId: member!.id, roles: ["anggota"], unitScope: [] },
  });
  check("their own assignment is visible", asMember.some((row) => row.id === created.id), true);
  check("and nobody else's", asMember.every((row) => row.memberId === member!.id), true);

  const asAdmin = await listAssignments(db, { actor: admin });
  check("an O-scoped admin sees at least what the member sees", asAdmin.length >= asMember.length, true);
  check("and specifically this assignment", asAdmin.some((row) => row.id === created.id), true);

  // The assertion that actually exercises the scope filter: a `U`-scoped actor whose subtree does NOT
  // contain this unit must not see the row. The actor is a DIFFERENT member, because self-visibility is
  // deliberate — a member always sees their own assignments, whatever their scope. (Getting that wrong
  // is how this assertion failed the first time.)
  const outsider = await listAssignments(db, {
    actor: {
      memberId: admin.memberId,
      roles: ["staff"],
      unitScope: ["00000000-0000-0000-0000-0000000000aa"],
    },
  });
  check(
    "a U-scoped actor outside the subtree does not see it",
    outsider.some((row) => row.id === created.id),
    false,
  );
} finally {
  // Order matters: assignments reference periods, so they go first or the period delete is refused.
  // (The append-only trigger refuses audit deletes by design, so those are best-effort.)
  await db.delete(auditLogs).where(like(auditLogs.requestId, `%${TAG}%`)).catch(() => undefined);
  await db
    .delete(assignments)
    .where(inArray(assignments.periodId, db.select({ id: periods.id }).from(periods).where(like(periods.label, `${TAG}%`))))
    .catch(() => undefined);
  await db.delete(periods).where(like(periods.label, `${TAG}%`));
  if (createdMembers.length > 0) {
    await db.delete(members).where(inArray(members.id, createdMembers));
  }
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
