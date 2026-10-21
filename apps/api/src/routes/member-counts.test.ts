/**
 * The counts query behind `GET /api/v1/members/stats`.
 *
 * Why it exists: the dashboard showed the length of a `limit=6` fetch as "Total Anggota", so an
 * organization of 120 members read as "6". A count in SQL is the fix — and the property that makes it
 * trustworthy is that it applies the **same** scope predicate as `listMembers`, so a unit-scoped actor's
 * total can never describe members they cannot read.
 *
 * These tests assert the SQL the function actually sends, using drizzle's proxy driver with a fake
 * backend. No database is involved: the query text and the row mapping are what can be wrong, and a live
 * smoke test would only show one actor's answer.
 *
 * Driver contract: bind values travel separately from the SQL text and rows come back positionally
 * (`rowMode: "array"`), so column order here is (status, count).
 */
import type { Actor } from "@pi-core/shared";
import { countVisibleMembersByStatus, type Database } from "@pi-core/db";
import { drizzle } from "drizzle-orm/pg-proxy";
import { describe, expect, it } from "vitest";

interface Recorded {
  db: Database;
  queries: string[];
  params: unknown[];
}

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
const selfOnly: Actor = { memberId: "member-anggota", roles: ["anggota"] };

describe("countVisibleMembersByStatus", () => {
  it("counts in SQL, grouped by status", async () => {
    const { db, queries } = recordingDb();

    await countVisibleMembersByStatus(db, orgWide);

    const sql = queries.join("\n");
    expect(sql).toContain('from "members"');
    expect(sql).toContain('group by "members"."status"');
    expect(sql).toContain("count(*)");
  });

  it("does not filter an organization-wide actor to their own row", async () => {
    const { db, queries, params } = recordingDb();

    await countVisibleMembersByStatus(db, orgWide);

    expect(queries.join("\n")).not.toContain('"members"."id" =');
    expect(params).not.toContain("member-super");
  });

  it("narrows a self-scoped actor to their own row", async () => {
    const { db, queries, params } = recordingDb();

    await countVisibleMembersByStatus(db, selfOnly);

    expect(queries.join("\n")).toContain('"members"."id" =');
    expect(params).toContain("member-anggota");
  });

  it("splits the counts by status and sums the total", async () => {
    const { db } = recordingDb([
      ["active", 118],
      ["inactive", 7],
    ]);

    expect(await countVisibleMembersByStatus(db, orgWide)).toEqual({
      total: 125,
      active: 118,
      inactive: 7,
    });
  });

  it("reads counts as numbers when the driver hands back strings", async () => {
    // `count(*)` is bigint; "118" + "7" would concatenate into "1187" if the values were trusted.
    const { db } = recordingDb([
      ["active", "118"],
      ["inactive", "7"],
    ]);

    const counts = await countVisibleMembersByStatus(db, orgWide);
    expect(counts.total).toBe(125);
    expect(counts.active).toBe(118);
  });

  it("answers zeroes, not an empty object, when there are no rows", async () => {
    const { db } = recordingDb([]);

    expect(await countVisibleMembersByStatus(db, selfOnly)).toEqual({
      total: 0,
      active: 0,
      inactive: 0,
    });
  });
});
