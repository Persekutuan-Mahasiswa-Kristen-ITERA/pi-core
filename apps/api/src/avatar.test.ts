/**
 * Avatar presigning — story 4.4 (FR-14).
 *
 * These use a **stub env with fake credentials**: the point is to pin our own contract — the key format,
 * what gets signed, and which inputs are refused before a URL exists. Whether R2 then honours the
 * signature is a property of R2 and is checked by the live script, not here. Being clear about which of
 * the two a test proves is the whole point of separating them.
 */
import { describe, expect, it } from "vitest";
import {
  ALLOWED_AVATAR_TYPES,
  AvatarError,
  isAllowedAvatarType,
  MAX_AVATAR_BYTES,
  presignAvatarUpload,
} from "./avatar";
import type { Env } from "./env";

const env = {
  AVATAR_BUCKET: "pmk-core-avatars",
  R2_ACCOUNT_ID: "a45092ffd0f9ad41070ed8c57d938052",
  R2_ACCESS_KEY_ID: "fake-access-key-id",
  R2_SECRET_ACCESS_KEY: "fake-secret-access-key",
} as unknown as Env;

describe("presignAvatarUpload", () => {
  it("returns a presigned PUT to the configured bucket", async () => {
    const upload = await presignAvatarUpload(env, { contentType: "image/png", size: 1024 });
    expect(upload.uploadUrl).toContain("a45092ffd0f9ad41070ed8c57d938052.r2.cloudflarestorage.com");
    expect(upload.uploadUrl).toContain("/pmk-core-avatars/avatars/");
    expect(upload.uploadUrl).toContain("X-Amz-Signature=");
    expect(upload.uploadUrl).toContain("X-Amz-Credential=");
    expect(upload.maxBytes).toBe(MAX_AVATAR_BYTES);
  });

  it("gives every upload a distinct, random, namespaced key", async () => {
    const a = await presignAvatarUpload(env, { contentType: "image/jpeg", size: 10 });
    const b = await presignAvatarUpload(env, { contentType: "image/jpeg", size: 10 });
    expect(a.key).not.toBe(b.key);
    expect(a.key).toMatch(/^avatars\/[0-9a-f-]{36}\.jpg$/);
  });

  it("maps the content type to the right extension", async () => {
    expect((await presignAvatarUpload(env, { contentType: "image/png", size: 10 })).key).toMatch(/\.png$/);
    expect((await presignAvatarUpload(env, { contentType: "image/webp", size: 10 })).key).toMatch(/\.webp$/);
  });

  it("refuses a type we do not accept, before any URL exists", async () => {
    for (const bad of ["image/svg+xml", "text/html", "application/pdf", "image/gif", ""]) {
      await expect(presignAvatarUpload(env, { contentType: bad, size: 10 })).rejects.toThrow(AvatarError);
    }
    expect(isAllowedAvatarType("image/svg+xml")).toBe(false);
    // SVG is the one that matters: it is an image type that can carry script.
    expect(ALLOWED_AVATAR_TYPES).not.toContain("image/svg+xml");
  });

  it("refuses a size outside the limit", async () => {
    for (const bad of [0, -1, MAX_AVATAR_BYTES + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(presignAvatarUpload(env, { contentType: "image/png", size: bad })).rejects.toThrow(
        AvatarError,
      );
    }
    // Exactly at the limit is allowed — off-by-one here would silently shrink the documented maximum.
    await expect(
      presignAvatarUpload(env, { contentType: "image/png", size: MAX_AVATAR_BYTES }),
    ).resolves.toBeDefined();
  });

  it("says so when R2 is not configured, rather than signing with undefined", async () => {
    const bare = { AVATAR_BUCKET: "pmk-core-avatars" } as unknown as Env;
    await expect(presignAvatarUpload(bare, { contentType: "image/png", size: 10 })).rejects.toMatchObject({
      code: "not_configured",
    });
  });
});
