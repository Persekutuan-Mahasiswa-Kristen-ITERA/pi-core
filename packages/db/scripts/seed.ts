/**
 * Idempotent seed of the organization tree (story 2.2, FR-17).
 *
 * Safe to run repeatedly: every unit is matched on `(parent_id, slug)` and updated in place,
 * so a second run changes no rows and creates no duplicates. `path`/`depth` are recomputed so
 * subtree (scope `U`) queries stay correct.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db db:seed
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { orgUnits, type OrgUnit } from "../src/schema";
import {
  BPH,
  BUREAU,
  DEPARTMENTS,
  EXPECTED_COUNTS,
  ORG_ROOT,
  type SeedUnit,
} from "../src/seed/org-structure";

/** The `org_units.type` union, taken from the schema rather than restated. */
type OrgUnitType = OrgUnit["type"];

const url = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DIRECT_DATABASE_URL) is required");
  process.exit(1);
}

const { db, pool } = createDb(url);
let created = 0;
let updated = 0;
/** `${parentId ?? "root"}:${slug}` for every unit the seed source describes. */
const expectedKeys = new Set<string>();

interface Placement {
  id: string;
  path: string;
  depth: number;
}

async function upsertUnit(
  parent: Placement | null,
  type: OrgUnitType,
  unit: SeedUnit,
  sortOrder: number,
): Promise<Placement> {
  const parentId = parent?.id ?? null;
  expectedKeys.add(`${parentId ?? "root"}:${unit.slug}`);
  const match = parentId
    ? and(eq(orgUnits.parentId, parentId), eq(orgUnits.slug, unit.slug))
    : and(isNull(orgUnits.parentId), eq(orgUnits.slug, unit.slug));

  const existing = await db
    .select({ id: orgUnits.id })
    .from(orgUnits)
    .where(match)
    .limit(1);

  let id: string;
  if (existing.length > 0) {
    id = existing[0]!.id;
    await db
      .update(orgUnits)
      .set({ type, name: unit.name, sortOrder, updatedAt: new Date() })
      .where(eq(orgUnits.id, id));
    updated += 1;
  } else {
    const rows = await db
      .insert(orgUnits)
      .values({ parentId, type, name: unit.name, slug: unit.slug, sortOrder })
      .returning({ id: orgUnits.id });
    id = rows[0]!.id;
    created += 1;
  }

  const path = `${parent?.path ?? "/"}${id}/`;
  const depth = (parent?.depth ?? -1) + 1;
  await db.update(orgUnits).set({ path, depth }).where(eq(orgUnits.id, id));
  return { id, path, depth };
}

try {
  const root = await upsertUnit(null, "organization", ORG_ROOT, 0);
  await upsertUnit(root, "bph", BPH, 1);

  let order = 2;
  for (const dept of DEPARTMENTS) {
    const deptPlacement = await upsertUnit(root, "department", dept, order);
    order += 1;
    let divOrder = 1;
    for (const div of dept.divisions) {
      await upsertUnit(deptPlacement, "division", div, divOrder);
      divOrder += 1;
    }
  }
  await upsertUnit(root, "bureau", BUREAU, order);

  const counts = await db
    .select({ type: orgUnits.type, n: sql<number>`count(*)::int` })
    .from(orgUnits)
    .groupBy(orgUnits.type)
    .orderBy(orgUnits.type);

  const actual: Record<string, number> = {};
  for (const row of counts) actual[row.type] = row.n;

  console.log(`seed: created=${created} updated=${updated}`);
  for (const [type, expected] of Object.entries(EXPECTED_COUNTS)) {
    const got = actual[type] ?? 0;
    console.log(`  ${type.padEnd(12)} expected=${expected} actual=${got} ${got === expected ? "OK" : "MISMATCH"}`);
  }

  // Drift report: units in the database that the seed source no longer describes. Reported,
  // never deleted — a unit may legitimately survive a period change, and units are only
  // soft-deleted once referenced. Review any line here by hand.
  const rows = await db
    .select({ id: orgUnits.id, parentId: orgUnits.parentId, slug: orgUnits.slug, name: orgUnits.name })
    .from(orgUnits);
  const drift = rows.filter((r) => !expectedKeys.has(`${r.parentId ?? "root"}:${r.slug}`));
  if (drift.length > 0) {
    console.log(`  drift (in DB, not in seed source): ${drift.length}`);
    for (const d of drift) console.log(`    - ${d.name} [${d.slug}] id=${d.id}`);
  }

  const mismatched = Object.entries(EXPECTED_COUNTS).some(
    ([type, expected]) => (actual[type] ?? 0) !== expected,
  );
  if (mismatched) process.exitCode = 1;
} finally {
  await pool.end();
}
