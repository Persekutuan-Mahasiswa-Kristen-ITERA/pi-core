import { describe, expect, it } from "vitest";

import { CONNECTED_WINDOW_MS, getIntegrationConnectionStatus } from "./integration-status";

describe("integration connection status", () => {
  const now = new Date("2026-10-17T00:00:00.000Z");

  it("is connected when enabled and recently authorized", () => {
    expect(getIntegrationConnectionStatus(false, new Date(now.getTime() - CONNECTED_WINDOW_MS + 1), now)).toBe("connected");
  });

  it("is not connected when never authorized or authorization is outside the window", () => {
    expect(getIntegrationConnectionStatus(false, null, now)).toBe("not_connected");
    expect(getIntegrationConnectionStatus(false, new Date(now.getTime() - CONNECTED_WINDOW_MS - 1), now)).toBe("not_connected");
  });

  it("is disabled even when it was recently authorized", () => {
    expect(getIntegrationConnectionStatus(true, now, now)).toBe("disabled");
  });
});
