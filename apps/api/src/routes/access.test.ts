import { describe, expect, it } from "vitest";

import { app } from "../app";
import { extractBearerToken } from "./access";

const env = {
  BETTER_AUTH_URL: "https://issuer.example.test",
  BETTER_AUTH_SECRET: "[REDACTED]",
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "[REDACTED]",
  AVATAR_BUCKET: "avatars",
  HYPERDRIVE: { connectionString: "postgres://invalid" },
};

describe("/api/v1/access bearer boundary", () => {
  it.each([undefined, "", "Basic abc", "Bearer", "Bearer "])('rejects %j', (header) => {
    expect(() => extractBearerToken(header)).toThrow("Bearer access token required.");
  });

  it("extracts a bearer token without normalizing its value", () => {
    expect(extractBearerToken("bEaReR opaque-token.value")).toBe("opaque-token.value");
  });

  it("returns the standard unauthorized envelope when the header is missing", async () => {
    const response = await app.fetch(new Request("https://api.example.test/api/v1/access"), env);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized", message: "Bearer access token required." },
    });
  });

  it("rejects a malformed bearer token before opening the database", async () => {
    const response = await app.fetch(
      new Request("https://api.example.test/api/v1/access", { headers: { authorization: "Bearer not-a-jwt" } }),
      env,
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized", message: "Invalid or expired access token." },
    });
  });
});
