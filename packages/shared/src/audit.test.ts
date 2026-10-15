/** FR-43 / NFR-6 — sensitive fields must never reach `audit_logs`. */
import { describe, expect, it } from "vitest";
import { REDACTED, SENSITIVE_AUDIT_KEYS, redactForAudit } from "./audit";

describe("redactForAudit()", () => {
  it("redacts the documented sensitive fields", () => {
    const before = {
      id: "m-1",
      full_name: "Budi",
      nim: "121140001",
      phone: "+628123456789",
      google_sub: "1234567890",
      email: "budi@student.itera.ac.id",
    };
    expect(redactForAudit(before)).toEqual({
      id: "m-1",
      full_name: "Budi",
      nim: REDACTED,
      phone: REDACTED,
      google_sub: REDACTED,
      email: "budi@student.itera.ac.id",
    });
  });

  it("matches keys case-insensitively", () => {
    expect(redactForAudit({ NIM: "1", Phone: "2", Client_Secret: "3" })).toEqual({
      NIM: REDACTED,
      Phone: REDACTED,
      Client_Secret: REDACTED,
    });
  });

  it("redacts at any depth, including inside arrays", () => {
    const value = {
      member: { profile: { nim: "1", faculty: "FTIK" } },
      sessions: [
        { id: "s1", refresh_token: "t1" },
        { id: "s2", token: "t2" },
      ],
    };
    expect(redactForAudit(value)).toEqual({
      member: { profile: { nim: REDACTED, faculty: "FTIK" } },
      sessions: [
        { id: "s1", refresh_token: REDACTED },
        { id: "s2", token: REDACTED },
      ],
    });
  });

  it("does not mutate the input", () => {
    const before = { nim: "1" };
    redactForAudit(before);
    expect(before).toEqual({ nim: "1" });
  });

  it("passes through primitives, null and undefined", () => {
    expect(redactForAudit(null)).toBeNull();
    expect(redactForAudit(undefined)).toBeUndefined();
    expect(redactForAudit(42)).toBe(42);
    expect(redactForAudit("plain")).toBe("plain");
    expect(redactForAudit(true)).toBe(true);
  });

  it("keeps an empty object empty", () => {
    expect(redactForAudit({})).toEqual({});
  });

  it("covers every key in the sensitive list", () => {
    const input = Object.fromEntries(SENSITIVE_AUDIT_KEYS.map((key) => [key, "secret-value"]));
    const output = redactForAudit(input) as Record<string, unknown>;
    for (const key of SENSITIVE_AUDIT_KEYS) expect(output[key], key).toBe(REDACTED);
  });
});
