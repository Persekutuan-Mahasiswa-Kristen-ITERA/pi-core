import { describe, expect, it } from "vitest";

import { roleSummary, statText, unitBreakdown, unitBreakdownText, unitLabel } from "./dashboard-stats";

describe("unitBreakdown", () => {
  it("counts by type in the vocabulary's order, not the payload's", () => {
    const breakdown = unitBreakdown([
      { type: "division" },
      { type: "bph" },
      { type: "division" },
      { type: "department" },
      { type: "bph" },
      { type: "organization" },
    ]);

    expect(breakdown.total).toBe(6);
    expect(breakdown.parts).toEqual([
      { type: "organization", label: "Organisasi", count: 1 },
      { type: "bph", label: "BPH", count: 2 },
      { type: "department", label: "Departemen", count: 1 },
      { type: "division", label: "Divisi", count: 2 },
    ]);
  });

  it("omits a type with no units instead of printing a zero for it", () => {
    const breakdown = unitBreakdown([{ type: "bph" }]);
    expect(breakdown.parts.map((part) => part.type)).toEqual(["bph"]);
  });

  it("keeps an unknown type visible so the parts still add up to the total", () => {
    // Dropping it would print "1 BPH" above a total of 2 — the card contradicting itself.
    const breakdown = unitBreakdown([{ type: "bph" }, { type: "working_group" }]);
    expect(breakdown.total).toBe(2);
    expect(breakdown.parts).toEqual([
      { type: "bph", label: "BPH", count: 1 },
      { type: "working_group", label: "working_group", count: 1 },
    ]);
  });

  it("answers an empty organization as zero parts, not as an error", () => {
    expect(unitBreakdown([])).toEqual({ total: 0, parts: [] });
    expect(unitBreakdownText(unitBreakdown([]))).toBe("");
  });

  it("labels the vocabulary in Indonesian and leaves unknown types raw", () => {
    expect(unitLabel("department")).toBe("Departemen");
    expect(unitLabel("bureau")).toBe("Biro");
    expect(unitLabel("division")).toBe("Divisi");
    expect(unitLabel("komisi")).toBe("komisi");
  });
});

describe("unitBreakdownText", () => {
  it("joins the parts in one line", () => {
    const text = unitBreakdownText(
      unitBreakdown([{ type: "bph" }, { type: "department" }, { type: "department" }]),
    );
    expect(text).toBe("1 BPH · 2 Departemen");
  });
});

describe("roleSummary", () => {
  it("counts distinct permission keys, not the sum of per-role grants", () => {
    // The same key granted to three roles is one permission, and "23 izin" must not become "69".
    const summary = roleSummary([
      { permissions: [{ key: "member:read" }, { key: "member:create" }] },
      { permissions: [{ key: "member:read" }, { key: "role:read" }] },
      { permissions: [{ key: "member:read" }] },
    ]);

    expect(summary.roles).toBe(3);
    expect(summary.permissions).toBe(3);
  });

  it("counts a role with no permissions as a role", () => {
    expect(roleSummary([{ permissions: [] }])).toEqual({ roles: 1, permissions: 0 });
  });
});

describe("statText", () => {
  it("prints an em dash for unknown, never a zero", () => {
    // 0 is a fact about the organization; null is a fact about the request.
    expect(statText(null)).toBe("—");
    expect(statText(0)).toBe("0");
    expect(statText(125)).toBe("125");
  });
});
