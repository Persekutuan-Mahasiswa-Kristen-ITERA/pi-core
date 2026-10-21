/**
 * The counts query behind `GET /api/v1/assignments/stats`.
 *
 * A report that counts one page of a 200-row endpoint reports "at least N". The fix is a SQL count —
 * and the property that makes it trustworthy is that it reads the **same** scope predicate as the list
 * (`assignmentScopeConditions`), so an actor's total can never describe units they cannot read.
 *
 * These tests assert the SQL the function actually sends, using drizzle's proxy driver with a fake
 * backend. No database is involved: the point is the query and the row mapping, both of which can be
 * wrong in ways a live smoke test would only reveal for one actor.
 *
 * Note the driver contract: values travel **separately** from the SQL text, and rows come back as
 * positional arrays (`rowMode: "array"`) — asserting on interpolated text would be asserting on
 * something that never happens.
 */
import type { Actor } from "@pi-core/shared";
import { countAssignmentsByUnitType, type Database } from "@pi-core/db";
import { drizzle } from "drizzle-orm/pg-proxy";
import { describe, expect, it } from "vitest";

interface Recorded {
  db: Database;
  queries: string[];
  /** Flattened bind parameters across every query the function sent. */
  params: unknown[];
}

/** A drizzle client whose "backend" records the query and returns the rows the test chooses. */
function recordingDb(rows: unknown[][] = []): Recorded {
  const queries: string[] = [];
  const params: unknown[] = [];
  const db = drizzle(async (sql, bound) => {
    queries.push(sql);
    params.push(...bound);
    return { rows };
  });
  return { db: db as unknown as Database, queries, params };
}

const orgWide: Actor = { memberId: "member-super", roles: ["super_admin"] };
const unitScoped: Actor = {
  memberId: "member-kadep",
  roles: ["kepala_departemen"],
  unitScope: ["unit-dept-pelayanan", "unit-div-ibadah"],
};

describe("countAssignmentsByUnitType", () => {
  it("counts in SQL, grouped by the unit's type", async () => {
    const { db, queries } = recordingDb();

    await countAssignmentsByUnitType(db, { actor: orgWide });

    const sql = queries.join("\n");
    expect(sql).toContain('from "assignments"');
    expect(sql).toContain('left join "org_units"');
    expect(sql).toContain('group by "org_units"."type"');
    expect(sql).toContain("count(*)");
  });

  it("does not filter by member or unit for an organization-wide actor", async () => {
    const { db, queries, params } = recordingDb();

    await countAssignmentsByUnitType(db, { actor: orgWide });

    const sql = queries.join("\n");
    expect(sql).not.toContain('"assignments"."member_id" =');
    expect(sql).not.toContain(" in (");
    expect(params).not.toContain("member-super");
  });

  it("applies the same scope predicate as the list for a unit-scoped actor", async () => {
    const { db, queries, params } = recordingDb();

    await countAssignmentsByUnitType(db, { actor: unitScoped });

    const sql = queries.join("\n");
    // Subtree plus own rows — the shape `listAssignments` uses, shared through one helper.
    expect(sql).toContain('"assignments"."org_unit_id" in');
    expect(sql).toContain('"assignments"."member_id" =');
    expect(params).toContain("unit-dept-pelayanan");
    expect(params).toContain("unit-div-ibadah");
    expect(params).toContain("member-kadep");
  });

  it("narrows to own rows only when a scoped actor has no subtree", async () => {
    const { db, queries, params } = recordingDb();

    await countAssignmentsByUnitType(db, { actor: { memberId: "member-1", roles: ["anggota"] } });

    const sql = queries.join("\n");
    expect(sql).toContain('"assignments"."member_id" =');
    expect(sql).not.toContain('"assignments"."org_unit_id" in');
    expect(params).toContain("member-1");
  });

  it("reports the counted rows, mapping a missing unit to \"unknown\" rather than dropping it", async () => {
    // Column order is (unitType, total), and the driver hands rows back positionally.
    const { db } = recordingDb([
      ["division", 12],
      [null, 2],
    ]);

    const counts = await countAssignmentsByUnitType(db, { actor: orgWide });

    expect(counts).toEqual([
      { unitType: "division", count: 12 },
      // A count that silently disappeared would make the total smaller than the rows it describes.
      { unitType: "unknown", count: 2 },
    ]);
  });

  it("reads the count as a number even when the driver hands back a string", async () => {
    // `count(*)` is bigint; a driver that returns it as a string must not produce "7" + 1 === "71".
    const { db } = recordingDb([["bph", "7"]]);

    const counts = await countAssignmentsByUnitType(db, { actor: orgWide });

    expect(counts[0]?.count).toBe(7);
  });
});
