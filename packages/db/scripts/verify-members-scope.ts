/**
 * Proof of the member-read scoping (FR-8, FR-26) and sensitive-field gating (FR-9) against a real
 * database.
 *
 * The claim under test is specifically that the **query** carries the scope. So the fixtures build a
 * realistic tree — two divisions under different departments, an active period, assignments — and the
 * actors are resolved through the production `loadActor`, not hand-built. Story 2.7's worst bug was
 * invisible to hand-built actors, which is why this goes through the real chain.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-members-scope.ts
 */
import { can, type Actor } from "@pi-core/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { loadActor } from "../src/access";
import { getMember, listMembers } from "../src/members";
import { assignments, members, orgUnits, periods, positions } from "../src/schema";

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

const TAG = `verify-scope-${Date.now()}`;
const memberIds: string[] = [];
let periodId: string | undefined;
let previousActive: string[] = [];

try {
  // ---- fixtures -------------------------------------------------------------
  const divisions = await db
    .select({ id: orgUnits.id, name: orgUnits.name, parentId: orgUnits.parentId })
    .from(orgUnits)
    .where(eq(orgUnits.type, "division"))
    .limit(10);

  // Two divisions with different parents, so "in my subtree" and "not in my subtree" are genuinely
  // different questions.
  const first = divisions.find((d) => divisions.some((o) => o.id !== d.id && o.parentId !== d.parentId));
  const second = divisions.find((d) => d.parentId !== first?.parentId && d.id !== first?.id);
  if (first === undefined || second === undefined) {
    console.log("SKIP: the org seed does not provide two divisions under different parents.");
    process.exit(0);
  }

  // A leads the division (a unique-per-unit position); D is a staff member of it. Two holders of the
  // SAME unique position in one unit is exactly what FR-30's constraint forbids — the first run of this
  // script proved that by being refused, which is the constraint doing its job.
  const leaderPosition = await db
    .select({ id: positions.id })
    .from(positions)
    .where(and(eq(positions.unitType, "division"), eq(positions.isUniquePerUnit, true)))
    .limit(1);
  const staffPosition = await db
    .select({ id: positions.id })
    .from(positions)
    .where(and(eq(positions.unitType, "division"), eq(positions.isUniquePerUnit, false)))
    .limit(1);
  const positionId = leaderPosition[0]?.id;
  if (positionId === undefined) {
    console.log("SKIP: no division position is seeded.");
    process.exit(0);
  }
  const secondPositionId = staffPosition[0]?.id ?? positionId;

  previousActive = (
    await db.select({ id: periods.id }).from(periods).where(eq(periods.isActive, true))
  ).map((r) => r.id);
  await db.update(periods).set({ isActive: false }).where(eq(periods.isActive, true));

  const insertedPeriod = await db
    .insert(periods)
    .values({ label: TAG, startDate: "2026-01-01", endDate: "2026-12-31", isActive: true })
    .returning({ id: periods.id });
  periodId = insertedPeriod[0]!.id;

  const people = await db
    .insert(members)
    .values([
      { email: `${TAG}-a@student.itera.ac.id`, fullName: `${TAG} A`, nim: "111", phone: "+62" },
      { email: `${TAG}-b@student.itera.ac.id`, fullName: `${TAG} B`, nim: "222", phone: "+62" },
      { email: `${TAG}-c@student.itera.ac.id`, fullName: `${TAG} C`, nim: "333", phone: "+62" },
      // D sits in A's own division, so "in my subtree" is provably more than "myself".
      { email: `${TAG}-d@student.itera.ac.id`, fullName: `${TAG} D`, nim: "444", phone: "+62" },
    ])
    .returning({ id: members.id, email: members.email });
  memberIds.push(...people.map((p) => p.id));
  const a = people[0]!;
  const b = people[1]!;
  const c = people[2]!;
  const d = people[3]!;

  // `unit_type` and `is_unique_per_unit` are derived columns kept consistent with the position by the
  // `assignments_fill_from_position` trigger (FR-30); the insert type still requires them.
  await db.insert(assignments).values([
    { memberId: a.id, orgUnitId: first.id, positionId, periodId, unitType: "division" },
    { memberId: b.id, orgUnitId: second.id, positionId, periodId, unitType: "division" },
    { memberId: d.id, orgUnitId: first.id, positionId: secondPositionId, periodId, unitType: "division" },
  ]);

  const actorA = (await loadActor(db, a.id))?.actor as Actor | undefined;
  const actorC = (await loadActor(db, c.id))?.actor as Actor | undefined;
  if (actorA === undefined || actorC === undefined) {
    console.log("FAIL: loadActor returned nothing for a fixture member");
    process.exit(1);
  }

  const visibleIds = async (actor: Actor): Promise<string[]> => {
    const result = await listMembers(db, { actor, limit: 100 });
    return result.items
      .map((m) => m.id)
      .filter((id) => memberIds.includes(id))
      .sort();
  };

  // ---- FR-26: the scope is applied in the query -----------------------------
  console.log("FR-26 — a U-scoped actor sees only their subtree, plus themselves");
  const seenByA = await visibleIds(actorA);
  check("A sees themselves and the member in A's own division", seenByA, [a.id, d.id].sort());
  check("B (other department) is invisible", seenByA.includes(b.id), false);
  check("C (no assignment) is invisible — there is no unit relation to scope by", seenByA.includes(c.id), false);

  console.log("\nFR-26 — an actor with no role at all sees only themselves");
  const seenByC = await visibleIds(actorC);
  check("C sees only C", seenByC, [c.id]);

  // ---- FR-9: sensitive fields are gated -------------------------------------
  console.log("\nFR-9 — sensitive fields appear only with member:read_sensitive");
  const cResult = await listMembers(db, { actor: actorC, limit: 100 });
  const cRow = cResult.items.find((m) => m.id === c.id);
  const cMayRead = can(actorC, "member:read_sensitive");
  check("the response reports whether sensitive fields were included", cResult.sensitiveIncluded, cMayRead);
  check(
    "NIM is present exactly when permitted",
    cRow !== undefined && "nim" in cRow,
    cMayRead,
  );
  check(
    "phone is present exactly when permitted",
    cRow !== undefined && "phone" in cRow,
    cMayRead,
  );
  if (!cMayRead) {
    // The stronger claim: the value is absent from the payload, not merely undefined.
    check("no NIM value anywhere in the serialized payload", JSON.stringify(cResult.items).includes("333"), false);
  }

  // ---- search and pagination ------------------------------------------------
  console.log("\nFR-51 — search matches name or email, and pagination is cursor-based");
  const superAdminActor: Actor = { memberId: a.id, roles: ["super_admin"] };
  const searched = await listMembers(db, { actor: superAdminActor, search: `${TAG} B`, limit: 100 });
  check("search finds the right member", searched.items.map((m) => m.id), [b.id]);

  const page1 = await listMembers(db, { actor: superAdminActor, limit: 1 });
  check("a page is limited", page1.items.length, 1);
  check("a next cursor is offered", typeof page1.nextCursor === "string", true);
  const page2 = await listMembers(db, { actor: superAdminActor, limit: 1, cursor: page1.nextCursor ?? "" });
  check("the next page is a different row", page2.items[0]?.id !== page1.items[0]?.id, true);

  // ---- detail: out of scope is indistinguishable from absent ----------------
  console.log("\nFR-8 — an out-of-scope member is not found, so the id cannot be probed");
  check("A cannot open B", await getMember(db, { actor: actorA, id: b.id }), null);
  check("A can open themselves", (await getMember(db, { actor: actorA, id: a.id }))?.id, a.id);
  check("a nonexistent id is also null", await getMember(db, { actor: actorA, id: crypto.randomUUID() }), null);
} finally {
  if (memberIds.length > 0) {
    await db.delete(assignments).where(inArray(assignments.memberId, memberIds));
    await db.delete(members).where(inArray(members.id, memberIds));
  }
  if (periodId !== undefined) await db.delete(periods).where(eq(periods.id, periodId));
  // Restore whatever was active before, so a verification run cannot silently change live behaviour.
  if (previousActive.length > 0) {
    await db.update(periods).set({ isActive: true }).where(inArray(periods.id, previousActive));
  }
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
