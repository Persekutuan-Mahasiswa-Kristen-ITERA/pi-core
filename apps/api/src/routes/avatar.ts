/**
 * Avatar upload — story 4.4 (FR-14).
 *
 * Thin, like the other routes: `requirePermission` decides whether the actor may act, `avatar.ts` owns
 * the presigning and the type/size rules.
 *
 * Note what this route does **not** do: it does not store the key on the member. The client uploads
 * first, then PATCHes `avatarKey` through the normal member update. That way a failed or abandoned upload
 * cannot leave a member pointing at an object that was never written.
 */
import { can } from "@pi-core/shared";
import { updateMember } from "@pi-core/db";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { ALLOWED_AVATAR_TYPES, AvatarError, MAX_AVATAR_BYTES, confirmAvatarUpload, presignAvatarUpload } from "../avatar";
import type { AppEnv } from "../env";
import { forbidden, notFound } from "../http/errors";
import { parseJson } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";

export const avatarRoutes = new Hono<AppEnv>();

avatarRoutes.use("*", sessionMiddleware);

/** Request metadata for the audit row (FR-43), omitting absent headers (`exactOptionalPropertyTypes`). */
function requestFacts(c: Context<AppEnv>) {
  const ip = c.req.header("cf-connecting-ip");
  const userAgent = c.req.header("user-agent");
  const requestId = c.get("requestId");
  return {
    ...(ip === undefined ? {} : { ip }),
    ...(userAgent === undefined ? {} : { userAgent }),
    ...(requestId === undefined ? {} : { requestId }),
  };
}

const presignBody = z
  .object({
    contentType: z.string().trim().min(1).max(100),
    size: z.number().int().positive().max(MAX_AVATAR_BYTES),
  })
  .strict();

avatarRoutes.post(
  "/:id/avatar/presign",
  // The self form of `profile:update_own`, which every member holds. The handler additionally allows an
  // actor with `member:update` to set someone else's photo: uploading is a write, so the write rules
  // apply, not the read scopes.
  requirePermission("profile:update_own", { target: () => ({ kind: "self" }) }),
  async (c) => {
    const actor = c.get("actor");
    if (actor === undefined) throw notFound();

    const id = c.req.param("id");
    if (id !== actor.memberId && !can(actor, "member:update")) {
      throw forbidden("You can only set your own photo.");
    }

    const body = await parseJson(c, presignBody);
    try {
      const upload = await presignAvatarUpload(c.env, { ...body, memberId: id });
      return c.json({
        ...upload,
        allowedTypes: ALLOWED_AVATAR_TYPES,
        note: "PUT the bytes to uploadUrl with exactly this content-type, then POST the key to .../avatar/confirm.",
      });
    } catch (error) {
      if (error instanceof AvatarError) {
        if (error.code === "unsupported_type") {
          throw forbidden(`Unsupported image type. Allowed: ${ALLOWED_AVATAR_TYPES.join(", ")}.`);
        }
        if (error.code === "too_large") throw forbidden(`Images must be at most ${MAX_AVATAR_BYTES} bytes.`);
        throw notFound("Avatar upload is not configured.");
      }
      throw error;
    }
  },
);

const confirmBody = z.object({ key: z.string().trim().min(1).max(300) }).strict();

/**
 * Confirm an upload: verify, strip metadata, and only then point the member at the object.
 *
 * The order matters. The member's `avatarKey` is written here and nowhere else, so an upload that was
 * never completed, was not an image, or failed stripping leaves the profile exactly as it was rather
 * than pointing at a broken object.
 */
avatarRoutes.post(
  "/:id/avatar/confirm",
  requirePermission("profile:update_own", { target: () => ({ kind: "self" }) }),
  async (c) => {
    const actor = c.get("actor");
    const db = c.get("db");
    if (actor === undefined || db === undefined) throw notFound();

    const id = c.req.param("id");
    if (id !== actor.memberId && !can(actor, "member:update")) {
      throw forbidden("You can only set your own photo.");
    }

    const body = await parseJson(c, confirmBody);
    let confirmed;
    try {
      confirmed = await confirmAvatarUpload(c.env, { memberId: id, key: body.key });
    } catch (error) {
      if (error instanceof AvatarError) {
        if (error.code === "not_an_image") {
          throw forbidden("That file is not a JPEG, PNG or WebP image.");
        }
        if (error.code === "too_large") throw forbidden(`Images must be at most ${MAX_AVATAR_BYTES} bytes.`);
        throw notFound("No uploaded image was found at that key.");
      }
      throw error;
    }

    const updated = await updateMember(db, {
      actor,
      id,
      input: { avatarKey: confirmed.key },
      request: requestFacts(c),
    });

    return c.json({
      member: updated,
      // Reported so the stripping is visible in the response rather than only in the code.
      metadata: { strippedBytes: confirmed.bytesRemoved, contentType: confirmed.contentType, bytes: confirmed.bytes },
    });
  },
);
