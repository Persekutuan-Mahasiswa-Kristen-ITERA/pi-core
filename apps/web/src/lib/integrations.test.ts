import { describe, expect, it } from "vitest";

import {
  displayName,
  formatLastAuthorized,
  sortIntegrations,
  statusHint,
  statusLabel,
  type Integration,
} from "./integrations";

function client(
  overrides: Partial<Integration> & Pick<Integration, "clientId">,
): Integration {
  return {
    name: null,
    redirectUris: ["https://example.test/callback"],
    scopes: ["openid"],
    enabled: true,
    status: "not_connected",
    lastAuthorizedAt: null,
    ...overrides,
  };
}

describe("statusLabel", () => {
  it("separates 'disabled by an admin' from 'nobody has authorized it yet'", () => {
    // These are different problems with different fixes; one shared "Tidak aktif" would send the
    // reader to the wrong one.
    expect(statusLabel("disabled")).toBe("Nonaktif");
    expect(statusLabel("not_connected")).toBe("Belum terhubung");
    expect(statusLabel("connected")).toBe("Terhubung");
    expect(statusHint("disabled")).not.toBe(statusHint("not_connected"));
  });

  it("does not invent a friendlier label for a status it does not know", () => {
    // A newer API value must not be displayed as "Terhubung".
    expect(statusLabel("pending_review")).toBe("pending_review");
    expect(statusHint("pending_review")).toBe("");
  });
});

describe("sortIntegrations", () => {
  it("puts connected first, then waiting, then switched off", () => {
    const sorted = sortIntegrations([
      client({ clientId: "c", status: "disabled" }),
      client({ clientId: "b", status: "not_connected" }),
      client({ clientId: "a", status: "connected" }),
    ]);
    expect(sorted.map((item) => item.clientId)).toEqual(["a", "b", "c"]);
  });

  it("sorts by name inside a group, not by client id", () => {
    const sorted = sortIntegrations([
      client({ clientId: "z", name: "Panitia", status: "connected" }),
      client({ clientId: "a", name: "Finance", status: "connected" }),
      client({ clientId: "m", name: "Notulensi", status: "connected" }),
    ]);
    expect(sorted.map((item) => displayName(item))).toEqual([
      "Finance",
      "Notulensi",
      "Panitia",
    ]);
  });
});

describe("displayName", () => {
  it("falls back to the client id rather than rendering an empty card", () => {
    expect(displayName({ clientId: "pmk-nexus", name: null })).toBe(
      "pmk-nexus",
    );
    expect(displayName({ clientId: "pmk-nexus", name: "   " })).toBe(
      "pmk-nexus",
    );
  });

  it("trims a name that came back with padding", () => {
    expect(displayName({ clientId: "pmk-nexus", name: "  PI-NEXUS  " })).toBe(
      "PI-NEXUS",
    );
  });
});

describe("formatLastAuthorized", () => {
  const now = new Date("2026-10-21T00:10:00+07:00");

  it("says so plainly when a client has never been authorized", () => {
    expect(formatLastAuthorized(null, now)).toBe("Belum pernah diizinkan");
    // A malformed timestamp must not render "Invalid Date".
    expect(formatLastAuthorized("not-a-date", now)).toBe(
      "Belum pernah diizinkan",
    );
  });

  it("reads the day boundary in WIB, so 20 minutes ago can still be 'kemarin'", () => {
    // 23.50 WIB yesterday vs 00.10 WIB today: 20 minutes apart, one calendar day apart.
    expect(formatLastAuthorized("2026-10-20T23:50:00+07:00", now)).toBe(
      "Kemarin, 23.50 WIB",
    );
    expect(formatLastAuthorized("2026-10-21T00:05:00+07:00", now)).toBe(
      "Hari ini, 00.05 WIB",
    );
  });

  it("counts days for the recent past and falls back to a date once that stops being useful", () => {
    expect(formatLastAuthorized("2026-10-16T09:00:00+07:00", now)).toBe(
      "5 hari lalu, 16 Okt 2026",
    );
    expect(formatLastAuthorized("2026-08-01T09:00:00+07:00", now)).toBe(
      "1 Agu 2026",
    );
  });
});
