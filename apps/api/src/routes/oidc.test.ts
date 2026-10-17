import { describe, expect, it } from "vitest";

import { createAuth } from "../auth";

describe("OIDC provider wiring (story 6.1)", () => {
  it("registers discovery, JWKS, authorization code, PKCE token and logout APIs", () => {
    const auth = createAuth({} as never, {
      BETTER_AUTH_URL: "https://issuer.example.test",
      BETTER_AUTH_SECRET: "test-only-secret-that-is-at-least-32-chars-long",
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
    } as never);
    const api = auth.api as Record<string, unknown>;

    for (const endpoint of [
      "getOpenIdConfig",
      "getOAuthServerConfig",
      "getJwks",
      "oauth2Authorize",
      "oauth2Token",
      "oauth2UserInfo",
      "oauth2Revoke",
      "oauth2Introspect",
      "oauth2EndSession",
    ]) {
      expect(typeof api[endpoint], endpoint).toBe("function");
    }
  });

});
