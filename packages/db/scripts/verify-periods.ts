/**
 * Proof of the period invariants — story 4.6 (FR-19, FR-20, FR-21) — against a real database.
 *
 * The assertion that matters is the last one. FR-21's testable consequence is not "a flag flipped" but
 * "after activation, all access derives from the new period's assignments". So this builds a real
 * assignment in one period, activates it, and checks that `loadActor` confers the role — then activates
 * the other period and checks the role is **gone**, without touching the assignment.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-periods.ts
 */
import type { Actor } from "@pi-core/shared";
import { eq, inArray } from "drizzle-orm";
import { loadActor } from "../src/access";
import { createDb } from "../src/client";
import { activatePeriod, createPeriod, listPeriods, PeriodError, updatePeriod } from "../src/periods";
import { assignments, auditLogs, members, orgUnits, periods, positions } from "../src/schema";

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

const TAG = `verify-periods-${Date.now()}`;
const admin: Actor = { memberId: "00000000-0000-0000-0000-000000000001", roles: ["super_admin"] };
const created: string[] = [];
const memberIds: string[] = [];
let previousActive: string[] = [];

try {
  previousActive = (await db.select({ id: periods.id }).from(periods).where(eq(periods.isActive, true))).map(
    (r) => r.id,
  );
  await db.update(periods).set({ isActive: false }).where(eq(periods.isActive, true));

  // ---- FR-19: create, validated and audited --------------------------------
  console.log("FR-19 — creating a period validates the range and writes an audit row");
  const a = await createPeriod(db, {
    actor: admin,
    input: { label: `${TAG}-A`, startDate: "2026-01-01", endDate: "2026-06-30" },
  });
  const b = await createPeriod(db, {
    actor: admin,
    input: { label: `${TAG}-B`, startDate: "2026-07-01", endDate: "2026-12-31" },
  });
  created.push(a.id, b.id);
  check("a new period is not active on creation", [a.isActive, b.isActive], [false, false]);
  check(
    "the creation is audited",
    (await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.entityId, a.id))).length >= 1,
    true,
  );

  let badRange: string = "no error";
  try {
    await createPeriod(db, {
      actor: admin,
      input: { label: `${TAG}-bad`, startDate: "2026-12-31", endDate: "2026-01-01" },
    });
  } catch (error) {
    badRange = error instanceof PeriodError ? error.code : "wrong error";
  }
  check("an end before the start is refused", badRange, "invalid_range");

  let duplicate: string = "no error";
  try {
    await createPeriod(db, {
      actor: admin,
      input: { label: `${TAG}-A`, startDate: "2027-01-01", endDate: "2027-06-30" },
    });
  } catch (error) {
    duplicate = error instanceof PeriodError ? error.code : "wrong error";
  }
  check("a duplicate label is a conflict", duplicate, "conflict");

  // ---- FR-20/21: exactly one active, audited, in one transaction ------------
  console.log("\nFR-20/FR-21 — activating leaves exactly one active period, and is audited");
  const first = await activatePeriod(db, { actor: admin, id: a.id });
  check("A is active", first.activated.isActive, true);
  check("nothing was replaced", first.deactivated, null);
  check(
    "exactly one period is active",
    (await listPeriods(db)).filter((p) => p.isActive).map((p) => p.id),
    [a.id],
  );

  const second = await activatePeriod(db, { actor: admin, id: b.id });
  check("B is active", second.activated.isActive, true);
  check("and A was the one replaced", second.deactivated?.id, a.id);
  check(
    "still exactly one active",
    (await listPeriods(db)).filter((p) => p.isActive).map((p) => p.id),
    [b.id],
  );
  const activationAudit = (
    await db.select({ after: auditLogs.after }).from(auditLogs).where(eq(auditLogs.entityId, b.id))
  ).find((row) => (row.after as { activePeriodId?: string } | null)?.activePeriodId === b.id);
  check("the activation is audited", activationAudit !== undefined, true);

  // ---- FR-21's real consequence: access follows the active period -----------
  console.log("\nFR-21 — access derives from the ACTIVE period's assignments, not the others");
  const division = (await db.select({ id: orgUnits.id }).from(orgUnits).where(eq(orgUnits.type, "division")).limit(1))[0];
  const position = (
    await db
      .select({ id: positions.id })
      .from(positions)
      .where(eq(positions.unitType, "division"))
      .limit(1)
  )[0];
  if (division === undefined || position === undefined) {
    console.log("SKIP: no division or division position seeded");
  } else {
    const person = (
      await db
        .insert(members)
        .values({ email: `${TAG}@student.itera.ac.id`, fullName: `${TAG} Person` })
        .returning({ id: members.id })
    )[0]!;
    memberIds.push(person.id);

    // Assigned in A only. B is active right now, so nothing should be conferred yet.
    await db.insert(assignments).values({
      memberId: person.id,
      orgUnitId: division.id,
      positionId: position.id,
      periodId: a.id,
      unitType: "division",
    });

    const whileB = (await loadActor(db, person.id))?.actor;
    check("no roles while the OTHER period is active", whileB?.roles, ["anggota"]);

    await activatePeriod(db, { actor: admin, id: a.id });
    const whileA = (await loadActor(db, person.id))?.actor;
    check("the assignment confers a role once its period is active", (whileA?.roles.length ?? 0) > 1, true);
    check("and the unit scope is populated", (whileA?.unitScope?.length ?? 0) > 0, true);

    // Flip back: the assignment is untouched, yet access is gone. That is the whole point.
    await activatePeriod(db, { actor: admin, id: b.id });
    const backToB = (await loadActor(db, person.id))?.actor;
    check("flipping the active period revokes it again, with no change to the assignment", backToB?.roles, ["anggota"]);
  }

  console.log("\nFR-19 — editing re-checks the range after merging with the stored row");
  let partialBad: string = "no error";
  try {
    await updatePeriod(db, { actor: admin, id: a.id, input: { endDate: "2025-01-01" } });
  } catch (error) {
    partialBad = error instanceof PeriodError ? error.code : "wrong error";
  }
  check("a partial update cannot produce an end before the start", partialBad, "invalid_range");
} finally {
  if (memberIds.length > 0) {
    await db.delete(assignments).where(inArray(assignments.memberId, memberIds));
    await db.delete(members).where(inArray(members.id, memberIds));
  }
  if (created.length > 0) await db.delete(periods).where(inArray(periods.id, created));
  if (previousActive.length > 0) {
    await db.update(periods).set({ isActive: true }).where(inArray(periods.id, previousActive));
  }
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
