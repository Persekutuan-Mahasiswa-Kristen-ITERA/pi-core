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

export class AvatarError extends Error {
  constructor(readonly code: "unsupported_type" | "too_large" | "not_configured") {
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
  params: { contentType: string; size: number },
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

  const key = `avatars/${crypto.randomUUID()}.${EXTENSIONS[params.contentType]}`;
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
