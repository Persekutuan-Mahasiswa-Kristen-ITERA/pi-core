/**
 * The mobile hand-off issues an **opaque** session token (`routes/mobile-auth.ts` writes a row in
 * `auth_sessions`), while OAuth clients carry a signed JWT. Both arrive as `Authorization: Bearer …`,
 * so the middleware has to tell them apart and refuse anything it cannot attribute.
 *
 * These tests pin the decision, not the wiring: the lookup is injected, so "unknown", "expired" and
 * "still valid" are distinguishable without a database.
 */
import { describe, expect, it } from "vitest";
import { looksLikeJwt, opaqueSessionSubject } from "./session";

const NOW = Date.parse("2026-10-21T12:00:00.000Z");

describe("looksLikeJwt", () => {
  it("accepts a compact JWS", () => {
    expect(looksLikeJwt("aaa.bbb.ccc")).toBe(true);
  });

  it("rejects the opaque token the hand-off mints", () => {
    // `newMobileCode()` is a random string, never dotted — treating it as a JWT would let it reach the
    // signature verifier, which would reject it after paying for a JWKS read.
    expect(looksLikeJwt("6b1f9a0c4f7e2d8a")).toBe(false);
    expect(looksLikeJwt("")).toBe(false);
  });
});

describe("opaqueSessionSubject", () => {
  it("returns the member id while the session row is alive", async () => {
    const subject = await opaqueSessionSubject(
      () => Promise.resolve({ userId: "member-1", expiresAt: new Date(NOW + 60_000) }),
      "token",
      NOW,
    );
    expect(subject).toBe("member-1");
  });

  it("refuses an unknown token", async () => {
    const subject = await opaqueSessionSubject(() => Promise.resolve(null), "token", NOW);
    expect(subject).toBeNull();
  });

  it("refuses an expired row, and refuses exactly at the boundary", async () => {
    expect(
      await opaqueSessionSubject(
        () => Promise.resolve({ userId: "member-1", expiresAt: new Date(NOW - 1) }),
        "token",
        NOW,
      ),
    ).toBeNull();

    expect(
      await opaqueSessionSubject(
        () => Promise.resolve({ userId: "member-1", expiresAt: new Date(NOW) }),
        "token",
        NOW,
      ),
    ).toBeNull();
  });

  it("refuses a row whose expiry is not a date", async () => {
    const subject = await opaqueSessionSubject(
      () => Promise.resolve({ userId: "member-1", expiresAt: new Date("not-a-date") }),
      "token",
      NOW,
    );
    expect(subject).toBeNull();
  });

  it("looks up exactly the token it was given", async () => {
    const seen: string[] = [];
    await opaqueSessionSubject(
      (token) => {
        seen.push(token);
        return Promise.resolve(null);
      },
      "the-token-from-the-header",
      NOW,
    );
    expect(seen).toEqual(["the-token-from-the-header"]);
  });
});
