import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";

import { app } from "../app";
import { extractBearerToken, verifyAccessTokenWithLocalJwks } from "./access";

const env = {
  BETTER_AUTH_URL: "https://issuer.example.test",
  BETTER_AUTH_SECRET: "[REDACTED]",
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "[REDACTED]",
  AVATAR_BUCKET: "avatars",
  HYPERDRIVE: { connectionString: "postgres://invalid" },
};

describe("/api/v1/access bearer boundary", () => {
  it.each([undefined, "", "Basic abc", "Bearer", "Bearer "])(
    "rejects %j",
    (header) => {
      expect(() => extractBearerToken(header)).toThrow(
        "Bearer access token required.",
      );
    },
  );

  it("extracts a bearer token without normalizing its value", () => {
    expect(extractBearerToken("bEaReR opaque-token.value")).toBe(
      "opaque-token.value",
    );
  });

  it("returns the standard unauthorized envelope when the header is missing", async () => {
    const response = await app.fetch(
      new Request("https://api.example.test/api/v1/access"),
      env,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized", message: "Bearer access token required." },
    });
  });

  it("rejects a malformed bearer token before opening the database", async () => {
    const response = await app.fetch(
      new Request("https://api.example.test/api/v1/access", {
        headers: { authorization: "Bearer not-a-jwt" },
      }),
      env,
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "unauthorized",
        message: "Invalid or expired access token.",
      },
    });
  });
});

/**
 * Locks the fix for the staging-only failure that made every real token unusable: the verifier used
 * to be handed a *URL*, and on Cloudflare Workers a subrequest from the Worker to its own
 * `*.workers.dev` hostname answers 404 (`Jwks failed: Not Found`) even though the same path returns
 * 200 to `curl`. The keys now come from the `jwks` table through a function source, so the whole
 * verification runs in-process.
 *
 * These tests sign real EdDSA tokens with `node:crypto` and feed a stubbed `db` whose only job is to
 * answer `loadJwks`. If the wiring ever goes back to a URL there is no server at that address, so
 * the test fails instead of silently green-lighting a broken path.
 */
describe("/api/v1/access token verification (in-process JWKS)", () => {
  const issuer = "https://issuer.example.test/api/auth";
  const audience = "https://issuer.example.test";
  const kid = "test-key";
  const now = Math.floor(Date.now() / 1000);

  function tokenSignedBy(
    privateKey: KeyObject,
    payload: Record<string, unknown>,
  ): string {
    const header = { alg: "EdDSA", typ: "JWT", kid };
    const signingInput = [header, payload]
      .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
      .join(".");
    const signature = sign(null, Buffer.from(signingInput), privateKey);
    return `${signingInput}.${signature.toString("base64url")}`;
  }

  /** Stands in for `withDb(...)` — only the `select().from()` chain `loadJwks` uses. */
  function dbServing(publicJwk: Record<string, unknown>) {
    return {
      select: () => ({
        from: async () => [{ id: kid, publicKey: JSON.stringify(publicJwk) }],
      }),
    } as never;
  }

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" }) as Record<
    string,
    unknown
  >;

  const validClaims = {
    iss: issuer,
    aud: audience,
    sub: "member-1",
    scope: "openid profile email pmk:access",
    iat: now,
    exp: now + 300,
  };

  it("accepts a token signed by the issuer key and returns its claims", async () => {
    const claims = await verifyAccessTokenWithLocalJwks(
      dbServing(publicJwk),
      tokenSignedBy(privateKey, validClaims),
      { issuer, audience },
    );

    expect(claims.sub).toBe("member-1");
    expect(claims.scope).toBe("openid profile email pmk:access");
  });

  it("rejects a token signed by a key the issuer does not publish", async () => {
    const foreign = generateKeyPairSync("ed25519");

    await expect(
      verifyAccessTokenWithLocalJwks(
        dbServing(publicJwk),
        tokenSignedBy(foreign.privateKey, validClaims),
        { issuer, audience },
      ),
    ).rejects.toThrow(/invalid access token/i);
  });

  it("rejects a token for another issuer", async () => {
    await expect(
      verifyAccessTokenWithLocalJwks(
        dbServing(publicJwk),
        tokenSignedBy(privateKey, { ...validClaims, iss: "https://evil.test" }),
        { issuer, audience },
      ),
    ).rejects.toThrow(/invalid access token/i);
  });

  it("rejects a token without the pmk:access scope", async () => {
    await expect(
      verifyAccessTokenWithLocalJwks(
        dbServing(publicJwk),
        tokenSignedBy(privateKey, { ...validClaims, scope: "openid profile" }),
        { issuer, audience },
      ),
    ).rejects.toThrow(/invalid scope pmk:access/i);
  });

  it("rejects an expired token", async () => {
    await expect(
      verifyAccessTokenWithLocalJwks(
        dbServing(publicJwk),
        tokenSignedBy(privateKey, { ...validClaims, exp: now - 60 }),
        { issuer, audience },
      ),
    ).rejects.toThrow(/expired/i);
  });
});
