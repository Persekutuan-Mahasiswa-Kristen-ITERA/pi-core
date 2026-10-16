/**
 * Avatar upload — story 4.4 (FR-14, NFR-8).
 *
 * The design is a **presigned PUT straight to R2**, so the bytes never pass through the Worker. That is
 * the point of presigning: the Worker's CPU budget on the free plan is 10 ms (ADR-0008), and proxying
 * an image upload would spend it on I/O we do not need to touch.
 *
 * What that buys and what it costs, stated plainly because the difference matters:
 *
 * - **Type and size are enforced by R2 itself, not by us.** The content type and length are signed into
 *   the URL, so a client that sends a different type or a larger body gets a 403 from R2. A check in our
 *   handler would only constrain the *request*; this constrains the *object*.
 * - **Metadata is NOT stripped here, and a presigned PUT cannot strip it.** R2 stores the client's bytes
 *   verbatim — there is no transform on the way in. NFR-8's "metadata stripped" therefore has to be
 *   honoured by the uploader re-encoding before it uploads, which is what the web and mobile clients do.
 *   This is a real gap against the acceptance criterion and is recorded as such rather than papered over;
 *   closing it server-side would mean either proxying the upload (CPU cost, and no decoder available in a
 *   Worker without a large dependency) or a Workers AI / image-resizing binding (a plan question).
 *
 * The key is random and namespaced. Random because a predictable key lets anyone who learns the bucket
 * layout enumerate avatars; namespaced under `avatars/` so the bucket can hold other things later.
 */
import { detectImageType, stripImageMetadata } from "@pi-core/shared";
import { AwsClient } from "aws4fetch";
import type { Env } from "./env";

/** What we accept. Anything else is refused before a URL is minted. */
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedAvatarType = (typeof ALLOWED_AVATAR_TYPES)[number];

/** 2 MiB. Avatars are displayed small; anything larger is a mistake or an attack. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Short: the client uploads immediately after asking. */
export const UPLOAD_URL_TTL_SECONDS = 300;

const EXTENSIONS: Record<AllowedAvatarType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface PresignedAvatarUpload {
  /** PUT the bytes here, with exactly the `content-type` you declared. */
  uploadUrl: string;
  /** Store this on the member as `avatarKey`. */
  key: string;
  expiresAt: string;
  maxBytes: number;
}

export interface ConfirmedAvatarUpload {
  key: string;
  contentType: string;
  bytes: number;
  /** Bytes removed by metadata stripping — reported so the behaviour is observable, not assumed. */
  bytesRemoved: number;
}

export class AvatarError extends Error {
  constructor(
    readonly code: "unsupported_type" | "too_large" | "not_configured" | "not_found" | "not_an_image",
  ) {
    super(code);
    this.name = "AvatarError";
  }
}

export function isAllowedAvatarType(value: string): value is AllowedAvatarType {
  return (ALLOWED_AVATAR_TYPES as readonly string[]).includes(value);
}

/**
 * Mint a presigned PUT.
 *
 * `content-type` and `content-length` are signed as headers, which is what makes R2 refuse a body that
 * does not match what we approved — the URL is not a bearer token for "upload anything".
 */
export async function presignAvatarUpload(
  env: Env,
  params: { memberId: string; contentType: string; size: number },
): Promise<PresignedAvatarUpload> {
  if (!isAllowedAvatarType(params.contentType)) throw new AvatarError("unsupported_type");
  if (!Number.isFinite(params.size) || params.size <= 0 || params.size > MAX_AVATAR_BYTES) {
    throw new AvatarError("too_large");
  }
  if (
    env.R2_ACCOUNT_ID === undefined ||
    env.R2_ACCESS_KEY_ID === undefined ||
    env.R2_SECRET_ACCESS_KEY === undefined
  ) {
    throw new AvatarError("not_configured");
  }

  // Namespaced BY MEMBER, then random. The member prefix is what lets `confirm` refuse a key that belongs
  // to someone else; the random suffix is what stops anyone enumerating a member's photos.
  const key = `avatars/${params.memberId}/${crypto.randomUUID()}.${EXTENSIONS[params.contentType]}`;
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    // R2 ignores the region but SigV4 requires one.
    region: "auto",
  });

  const target = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.AVATAR_BUCKET}/${key}`);
  // aws4fetch takes the expiry from the URL, not from the sign options — it is part of what gets signed.
  target.searchParams.set("X-Amz-Expires", String(UPLOAD_URL_TTL_SECONDS));
  const signed = await client.sign(
    new Request(target, {
      method: "PUT",
      headers: { "content-type": params.contentType, "content-length": String(params.size) },
    }),
    { aws: { signQuery: true } },
  );

  return {
    uploadUrl: signed.url,
    key,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    maxBytes: MAX_AVATAR_BYTES,
  };
}

/**
 * Finish an upload: verify it really is an image, strip its metadata, and write it back.
 *
 * This is the step that closes the NFR-8 gap. A presigned PUT cannot rewrite the object, so the client's
 * bytes land in R2 verbatim; here the Worker reads them once, strips the identifying segments and chunks
 * (see `stripImageMetadata` — a structural walk, not a decode), and puts the cleaned bytes back. It costs
 * one read and one write of a file capped at 2 MiB, which is why the cap is not arbitrary.
 *
 * Three things this refuses, each for a different reason:
 *
 * - **A key belonging to another member.** The key is namespaced by member id, so a stolen or guessed key
 *   cannot be attached to someone else's profile.
 * - **Something that is not an image.** `detectImageType` reads the magic bytes rather than trusting the
 *   declared content type, so a renamed script cannot become an avatar. R2 enforced the content type we
 *   signed; this enforces what the bytes actually are.
 * - **An object that is missing or over the cap.** A presigned URL that was never used, or an object that
 *   grew, is refused rather than stored.
 *
 * Returns the byte count removed so the stripping is observable rather than assumed.
 */
export async function confirmAvatarUpload(
  env: Env,
  params: { memberId: string; key: string },
): Promise<ConfirmedAvatarUpload> {
  if (env.AVATARS === undefined) throw new AvatarError("not_configured");

  const prefix = `avatars/${params.memberId}/`;
  if (!params.key.startsWith(prefix) || params.key.includes("..") || params.key.length > 300) {
    throw new AvatarError("not_found");
  }

  const object = await env.AVATARS.get(params.key);
  if (object === null) throw new AvatarError("not_found");
  if (object.size > MAX_AVATAR_BYTES) throw new AvatarError("too_large");

  const original = new Uint8Array(await object.arrayBuffer());
  const detected = detectImageType(original);
  if (detected === null) {
    // Do not keep whatever this is.
    await env.AVATARS.delete(params.key);
    throw new AvatarError("not_an_image");
  }

  const stripped = stripImageMetadata(original);
  const contentType = object.httpMetadata?.contentType ?? detected;

  if (stripped.length !== original.length) {
    await env.AVATARS.put(params.key, stripped, { httpMetadata: { contentType } });
  }

  return {
    key: params.key,
    contentType,
    bytes: stripped.length,
    bytesRemoved: original.length - stripped.length,
  };
}
