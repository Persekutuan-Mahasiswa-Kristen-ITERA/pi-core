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
import { Hono } from "hono";
import { z } from "zod";
import { ALLOWED_AVATAR_TYPES, AvatarError, MAX_AVATAR_BYTES, presignAvatarUpload } from "../avatar";
import type { AppEnv } from "../env";
import { forbidden, notFound } from "../http/errors";
import { parseJson } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";

export const avatarRoutes = new Hono<AppEnv>();

avatarRoutes.use("*", sessionMiddleware);

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
      const upload = await presignAvatarUpload(c.env, body);
      return c.json({
        ...upload,
        allowedTypes: ALLOWED_AVATAR_TYPES,
        note: "PUT the bytes to uploadUrl with exactly this content-type, then PATCH the member's avatarKey.",
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
