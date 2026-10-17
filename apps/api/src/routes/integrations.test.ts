import { describe, expect, it } from "vitest";

import { ROUTE_AUTHORIZATION } from "./registry";

const integrationEntries = ROUTE_AUTHORIZATION.filter((entry) => entry.file === "routes/integrations.ts");

describe("integration registry authorization contract", () => {
  it("guards every integration route with the intended permission", () => {
    expect(integrationEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/", permission: "integration:read" }),
        expect.objectContaining({ method: "POST", path: "/", permission: "integration:manage" }),
        expect.objectContaining({ method: "PATCH", path: "/:clientId", permission: "integration:manage" }),
        expect.objectContaining({ method: "POST", path: "/:clientId/rotate-secret", permission: "integration:manage" }),
        expect.objectContaining({ method: "POST", path: "/:clientId/disable", permission: "integration:manage" }),
        expect.objectContaining({ method: "POST", path: "/:clientId/enable", permission: "integration:manage" }),
      ]),
    );
    expect(integrationEntries).toHaveLength(6);
  });

  it("never registers a public integration-management route", () => {
    expect(integrationEntries.some((entry) => entry.public === true)).toBe(false);
  });
});
