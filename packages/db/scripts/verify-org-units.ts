/**
 * Proof of the organization-unit invariants — story 4.5 (FR-15, FR-16, FR-18) — against a real database.
 *
 * The assertion that matters is the move. FR-18 makes subtree filtering a `path` prefix check, so a move
 * that updates the moved unit but not its descendants silently leaves the subtree pointing at the old
 * place — and because the path *is* the scope, that is a silent change to who can see what. So this
 * builds a three-level tree, moves the middle unit, and checks every descendant's path and depth moved
 * with it.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-org-units.ts
 */
import type { Actor } from "@pi-core/shared";
import { eq, inArray } from "drizzle-orm";
import { createDb } from "../src/client";
import {
  createOrgUnit,
  deactivateOrgUnit,
  listOrgUnits,
  listSubtree,
  OrgUnitError,
  updateOrgUnit,
} from "../src/org-units";
import { auditLogs, orgUnits } from "../src/schema";

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

const TAG = `vu-${Date.now()}`;
const admin: Actor = { memberId: "00000000-0000-0000-0000-000000000001", roles: ["super_admin"] };
const created: string[] = [];

const paths = async (ids: string[]) =>
  (
    await db
      .select({ id: orgUnits.id, path: orgUnits.path, depth: orgUnits.depth })
      .from(orgUnits)
      .where(inArray(orgUnits.id, ids))
  )
    .map((r) => ({ id: r.id, path: r.path, depth: r.depth }))
    .sort((a, b) => (a.path ?? "").localeCompare(b.path ?? ""));

try {
  // ---- FR-16: create, slug unique per parent, audited -----------------------
  console.log("FR-16 — creating a unit computes its path and audits the change");
  const root = (await listOrgUnits(db)).find((u) => u.parentId === null);
  if (root === undefined) {
    console.log("SKIP: no root unit is seeded");
    process.exit(0);
  }

  const parentA = await createOrgUnit(db, {
    actor: admin,
    input: { name: `${TAG} Parent A`, slug: `${TAG}-parent-a`, type: "department", parentId: root.id },
  });
  const parentB = await createOrgUnit(db, {
    actor: admin,
    input: { name: `${TAG} Parent B`, slug: `${TAG}-parent-b`, type: "department", parentId: root.id },
  });
  const child = await createOrgUnit(db, {
    actor: admin,
    input: { name: `${TAG} Child`, slug: `${TAG}-child`, type: "division", parentId: parentA.id },
  });
  const grandchild = await createOrgUnit(db, {
    actor: admin,
    input: { name: `${TAG} Grandchild`, slug: `${TAG}-grandchild`, type: "division", parentId: child.id },
  });
  created.push(parentA.id, parentB.id, child.id, grandchild.id);

  const initial = await paths([parentA.id, child.id, grandchild.id]);
  check("the root path is the id chain", initial[0]?.path?.endsWith(`${parentA.id}/`), true);
  check("the child's path extends its parent's", initial[1]?.path?.startsWith(initial[0]?.path ?? "x"), true);
  check("depths increase by one per level", initial.map((p) => p.depth), [1, 2, 3]);
  check(
    "the creation is audited",
    (await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.entityId, parentA.id))).length >= 1,
    true,
  );

  let duplicate: string = "no error";
  try {
    await createOrgUnit(db, {
      actor: admin,
      input: { name: "Duplicate", slug: `${TAG}-child`, type: "division", parentId: parentA.id },
    });
  } catch (error) {
    duplicate = error instanceof OrgUnitError ? error.code : "wrong error";
  }
  check("the same slug under the same parent is a conflict", duplicate, "conflict");

  // ---- FR-18: a move rewrites the whole subtree -----------------------------
  console.log("\nFR-18 — moving a unit rewrites its descendants' paths and depths");
  await updateOrgUnit(db, { actor: admin, id: child.id, input: { parentId: parentB.id } });

  const moved = await paths([child.id, grandchild.id]);
  const movedChild = moved.find((row) => row.id === child.id);
  const movedGrandchild = moved.find((row) => row.id === grandchild.id);
  check("the moved unit is under its new parent", movedChild?.path?.startsWith(`/${root.id}/${parentB.id}/`), true);
  check(
    "the GRANDCHILD moved with it — this is the assertion that matters",
    movedGrandchild?.path?.startsWith(movedChild?.path ?? "x"),
    true,
  );
  check("the grandchild is no longer under the old parent", movedGrandchild?.path?.includes(parentA.id), false);
  check("depths are unchanged by a same-level move", [movedChild?.depth, movedGrandchild?.depth], [2, 3]);
  console.log(`         (paths: child=${movedChild?.path} grandchild=${movedGrandchild?.path})`);

  const subtreeOfB = (await listSubtree(db, parentB.id)).map((u) => u.id);
  check("the subtree query now includes the moved unit", subtreeOfB.includes(child.id), true);
  const subtreeOfA = (await listSubtree(db, parentA.id)).map((u) => u.id);
  check("and no longer includes it under the old parent", subtreeOfA.includes(child.id), false);

  console.log("\nFR-16 — a cycle is refused explicitly");
  console.log(`         (moving parentB=${parentB.id} under grandchild=${grandchild.id})`);
  let cycle: string = "no error";
  try {
    await updateOrgUnit(db, { actor: admin, id: parentB.id, input: { parentId: grandchild.id } });
  } catch (error) {
    cycle = error instanceof OrgUnitError ? error.code : "wrong error";
  }
  check("moving a unit under its own descendant is refused", cycle, "cycle");

  let selfCycle: string = "no error";
  try {
    await updateOrgUnit(db, { actor: admin, id: parentB.id, input: { parentId: parentB.id } });
  } catch (error) {
    selfCycle = error instanceof OrgUnitError ? error.code : "wrong error";
  }
  check("moving a unit under itself is refused", selfCycle, "cycle");

  // ---- FR-16: soft delete only ---------------------------------------------
  console.log("\nFR-16 — deactivation is refused while children remain, and is soft when allowed");
  let hasChildren: string = "no error";
  try {
    await deactivateOrgUnit(db, { actor: admin, id: parentB.id });
  } catch (error) {
    hasChildren = error instanceof OrgUnitError ? error.code : "wrong error";
  }
  check("a unit with active children cannot be deactivated", hasChildren, "has_children");

  const deactivated = await deactivateOrgUnit(db, { actor: admin, id: grandchild.id });
  check("a leaf deactivates", deactivated.isActive, false);

  const stillThere = await db.select({ id: orgUnits.id }).from(orgUnits).where(eq(orgUnits.id, grandchild.id));
  check("the row still exists — never hard-deleted", stillThere.length, 1);
  check(
    "the deactivation is audited",
    (
      await db
        .select({ after: auditLogs.after })
        .from(auditLogs)
        .where(eq(auditLogs.entityId, grandchild.id))
    ).some((row) => (row.after as { isActive?: boolean } | null)?.isActive === false),
    true,
  );
  check(
    "and it is hidden from the default tree listing (FR-15)",
    (await listOrgUnits(db)).some((u) => u.id === grandchild.id),
    false,
  );
} finally {
  if (created.length > 0) await db.delete(orgUnits).where(inArray(orgUnits.id, created));
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
