/**
 * The audit screen's filter state.
 *
 * The date conversion is the reason this file exists: a range that starts at 07:00 local instead of
 * midnight still *looks* like a date range, and nothing on screen would tell the reader that the first
 * seven hours of every day are missing.
 */
import { describe, expect, it } from "vitest";

import { ALL, buildAuditQuery, wibDayBoundary } from "./audit-filters";

describe("wibDayBoundary", () => {
  it("turns a WIB day into the UTC instant that day starts", () => {
    // 00:00 in Jakarta is 17:00 the previous day in UTC.
    expect(wibDayBoundary("2026-10-21", "start")).toBe("2026-10-20T17:00:00.000Z");
  });

  it("turns a WIB day into the UTC instant that day ends", () => {
    expect(wibDayBoundary("2026-10-21", "end")).toBe("2026-10-21T16:59:59.999Z");
  });

  it("round-trips back to midnight and one millisecond before midnight in Jakarta", () => {
    const start = new Date(wibDayBoundary("2026-10-21", "start") ?? "").toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
    });
    const end = new Date(wibDayBoundary("2026-10-21", "end") ?? "").toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
    });

    expect(start).toContain("00.00.00");
    expect(end).toContain("23.59.59");
  });

  it("returns null for an empty day, so an unset filter is omitted rather than sent as an epoch", () => {
    expect(wibDayBoundary("", "start")).toBeNull();
  });

  it("returns null instead of throwing when the value is not a date", () => {
    // `toISOString()` throws on an invalid Date; a crash mid-typing would take the screen down.
    expect(wibDayBoundary("not-a-date", "start")).toBeNull();
    expect(wibDayBoundary("2026-13-45", "end")).toBeNull();
  });
});

describe("buildAuditQuery", () => {
  const unfiltered = { action: ALL, entityType: ALL, from: "", to: "" };

  it("sends only the page size when nothing is filtered", () => {
    expect(buildAuditQuery(unfiltered, null, 50)).toBe("limit=50");
  });

  it("never sends the sentinel value as a filter", () => {
    // `action=Semua` would ask the API for an action that cannot exist.
    const query = buildAuditQuery(unfiltered, null, 50);
    expect(query).not.toContain("action");
    expect(query).not.toContain("entityType");
  });

  it("carries the chosen action and entity type", () => {
    const query = buildAuditQuery({ ...unfiltered, action: "member.create", entityType: "member" }, null, 50);

    expect(query).toContain("action=member.create");
    expect(query).toContain("entityType=member");
  });

  it("encodes a date range as UTC instants at the WIB day edges", () => {
    const query = buildAuditQuery({ ...unfiltered, from: "2026-10-01", to: "2026-10-21" }, null, 50);

    expect(decodeURIComponent(query)).toContain("from=2026-09-30T17:00:00.000Z");
    expect(decodeURIComponent(query)).toContain("to=2026-10-21T16:59:59.999Z");
  });

  it("passes the cursor through for the next page", () => {
    expect(buildAuditQuery(unfiltered, "cursor-abc", 50)).toContain("cursor=cursor-abc");
  });

  it("keeps the filters when paging, so page two is the same query as page one", () => {
    const query = buildAuditQuery({ action: "member.update", entityType: "member", from: "", to: "" }, "c2", 50);

    expect(query).toContain("action=member.update");
    expect(query).toContain("entityType=member");
    expect(query).toContain("cursor=c2");
  });
});
