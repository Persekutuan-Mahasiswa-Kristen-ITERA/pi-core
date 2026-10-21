/**
 * `GET /api/v1/audit/entity-types` behind the audit screen's entity filter.
 *
 * The filter used to be a hardcoded list, which is the same bug as a hardcoded action list: it offers
 * values that match nothing and hides values that exist (a new entity type appears the day someone adds
 * one). Reading the distinct values from the log is what makes the chips honest — so the property worth
 * pinning is that the query really is `distinct` on `entity_type`, and that the result is sorted rather
 * than arriving in whatever order the planner chose.
 */
import { listAuditEntityTypes, type Database } from "@pi-core/db";
import { drizzle } from "drizzle-orm/pg-proxy";
import { describe, expect, it } from "vitest";

function recordingDb(rows: unknown[][] = []): { db: Database; queries: string[] } {
  const queries: string[] = [];
  const db = drizzle(async (sql) => {
    queries.push(sql);
    return { rows };
  });
  return { db: db as unknown as Database, queries };
}

describe("listAuditEntityTypes", () => {
  it("asks the database for distinct entity types", async () => {
    const { db, queries } = recordingDb();

    await listAuditEntityTypes(db);

    const sql = queries.join("\n");
    expect(sql).toContain("select distinct");
    // Single-table select, so drizzle leaves the column unqualified — the table name is in FROM.
    expect(sql).toContain('"entity_type"');
    expect(sql).toContain('from "audit_logs"');
  });

  it("sorts the values so the chip row is stable between loads", async () => {
    const { db } = recordingDb([["setting"], ["member"], ["assignment"]]);

    expect(await listAuditEntityTypes(db)).toEqual(["assignment", "member", "setting"]);
  });

  it("returns an empty list rather than throwing when the log is empty", async () => {
    const { db } = recordingDb([]);

    expect(await listAuditEntityTypes(db)).toEqual([]);
  });
});
