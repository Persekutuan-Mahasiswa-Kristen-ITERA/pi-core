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
  confirmAvatarUpload,
  isAllowedAvatarType,
  MAX_AVATAR_BYTES,
  presignAvatarUpload,
} from "./avatar";
import type { Env } from "./env";

const MEMBER = "11111111-2222-3333-4444-555555555555";
const env = {
  AVATAR_BUCKET: "pmk-core-avatars",
  R2_ACCOUNT_ID: "a45092ffd0f9ad41070ed8c57d938052",
  R2_ACCESS_KEY_ID: "fake-access-key-id",
  R2_SECRET_ACCESS_KEY: "fake-secret-access-key",
} as unknown as Env;

describe("presignAvatarUpload", () => {
  it("returns a presigned PUT to the configured bucket", async () => {
    const upload = await presignAvatarUpload(env, { memberId: MEMBER, contentType: "image/png", size: 1024 });
    expect(upload.uploadUrl).toContain("a45092ffd0f9ad41070ed8c57d938052.r2.cloudflarestorage.com");
    expect(upload.uploadUrl).toContain("/pmk-core-avatars/avatars/");
    expect(upload.uploadUrl).toContain("X-Amz-Signature=");
    expect(upload.uploadUrl).toContain("X-Amz-Credential=");
    expect(upload.maxBytes).toBe(MAX_AVATAR_BYTES);
  });

  it("gives every upload a distinct, random, member-namespaced key", async () => {
    const a = await presignAvatarUpload(env, { memberId: MEMBER, contentType: "image/jpeg", size: 10 });
    const b = await presignAvatarUpload(env, { memberId: MEMBER, contentType: "image/jpeg", size: 10 });
    expect(a.key).not.toBe(b.key);
    // The member prefix is what lets `confirm` refuse someone else's key; the uuid is what stops
    // enumeration. Both are load-bearing.
    expect(a.key).toMatch(new RegExp(`^avatars/${MEMBER}/[0-9a-f-]{36}\\.jpg$`));
  });

  it("maps the content type to the right extension", async () => {
    expect((await presignAvatarUpload(env, { memberId: MEMBER, contentType: "image/png", size: 10 })).key).toMatch(/\.png$/);
    expect((await presignAvatarUpload(env, { memberId: MEMBER, contentType: "image/webp", size: 10 })).key).toMatch(/\.webp$/);
  });

  it("refuses a type we do not accept, before any URL exists", async () => {
    for (const bad of ["image/svg+xml", "text/html", "application/pdf", "image/gif", ""]) {
      await expect(presignAvatarUpload(env, { memberId: MEMBER, contentType: bad, size: 10 })).rejects.toThrow(AvatarError);
    }
    expect(isAllowedAvatarType("image/svg+xml")).toBe(false);
    // SVG is the one that matters: it is an image type that can carry script.
    expect(ALLOWED_AVATAR_TYPES).not.toContain("image/svg+xml");
  });

  it("refuses a size outside the limit", async () => {
    for (const bad of [0, -1, MAX_AVATAR_BYTES + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(presignAvatarUpload(env, { memberId: MEMBER, contentType: "image/png", size: bad })).rejects.toThrow(
        AvatarError,
      );
    }
    // Exactly at the limit is allowed — off-by-one here would silently shrink the documented maximum.
    await expect(
      presignAvatarUpload(env, { memberId: MEMBER, contentType: "image/png", size: MAX_AVATAR_BYTES }),
    ).resolves.toBeDefined();
  });

  it("says so when R2 is not configured, rather than signing with undefined", async () => {
    const bare = { AVATAR_BUCKET: "pmk-core-avatars" } as unknown as Env;
    await expect(presignAvatarUpload(bare, { memberId: MEMBER, contentType: "image/png", size: 10 })).rejects.toMatchObject({
      code: "not_configured",
    });
  });
});

// ---- confirm: the step that actually closes NFR-8 --------------------------

/** A stub R2 bucket, so the confirm path is exercised without a network round trip. */
function stubBucket(initial: Record<string, { body: Uint8Array; contentType?: string }>) {
  const store = { ...initial };
  return {
    store,
    bucket: {
      async get(key: string) {
        const found = store[key];
        if (found === undefined) return null;
        return {
          size: found.body.length,
          httpMetadata: found.contentType === undefined ? undefined : { contentType: found.contentType },
          async arrayBuffer() {
            return found.body.buffer.slice(found.body.byteOffset, found.body.byteOffset + found.body.byteLength);
          },
        };
      },
      async put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
        store[key] = {
          body: value,
          ...(options?.httpMetadata?.contentType === undefined ? {} : { contentType: options.httpMetadata.contentType }),
        };
      },
      async delete(key: string) {
        delete store[key];
      },
    },
  };
}

const JPEG_WITH_EXIF = new Uint8Array([
  0xff, 0xd8, // SOI
  0xff, 0xe1, 0x00, 0x10, ..."Exif".split("").map((c) => c.charCodeAt(0)), 0, 0, ..."GPS 51.5N".split("").map((c) => c.charCodeAt(0)),
  0xff, 0xda, 0x00, 0x02, // SOS
  0xff, 0xd9, // EOI
]);

describe("confirmAvatarUpload", () => {
  const key = `avatars/${MEMBER}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg`;

  it("strips metadata and reports how much went", async () => {
    const { bucket, store } = stubBucket({ [key]: { body: JPEG_WITH_EXIF, contentType: "image/jpeg" } });
    const result = await confirmAvatarUpload({ ...env, AVATARS: bucket } as unknown as Env, {
      memberId: MEMBER,
      key,
    });
    expect(result.bytesRemoved).toBeGreaterThan(0);
    expect(result.contentType).toBe("image/jpeg");
    // The object in R2 must be the stripped one, not just the returned value.
    expect(String.fromCharCode(...store[key]!.body)).not.toContain("GPS");
  });

  it("refuses a key belonging to another member", async () => {
    const { bucket } = stubBucket({ [key]: { body: JPEG_WITH_EXIF } });
    await expect(
      confirmAvatarUpload({ ...env, AVATARS: bucket } as unknown as Env, {
        memberId: "99999999-9999-9999-9999-999999999999",
        key,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses something that is not an image, and deletes it", async () => {
    const badKey = `avatars/${MEMBER}/not-an-image.png`;
    const { bucket, store } = stubBucket({
      [badKey]: { body: new Uint8Array([...'<?php system($_GET["c"]); ?>'].map((c) => c.charCodeAt(0))), contentType: "image/png" },
    });
    await expect(
      confirmAvatarUpload({ ...env, AVATARS: bucket } as unknown as Env, { memberId: MEMBER, key: badKey }),
    ).rejects.toMatchObject({ code: "not_an_image" });
    // R2 enforced the declared content type; this is what enforces the actual bytes — and the file does
    // not stay in the bucket.
    expect(store[badKey]).toBeUndefined();
  });

  it("refuses a key that was never uploaded", async () => {
    const { bucket } = stubBucket({});
    await expect(
      confirmAvatarUpload({ ...env, AVATARS: bucket } as unknown as Env, { memberId: MEMBER, key }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses a traversal attempt", async () => {
    const { bucket } = stubBucket({});
    await expect(
      confirmAvatarUpload({ ...env, AVATARS: bucket } as unknown as Env, {
        memberId: MEMBER,
        key: `avatars/${MEMBER}/../../other/x.jpg`,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
