/**
 * Settings — story 4.9 (FR-40, FR-41, FR-42).
 *
 * Everything here is `settings:read` / `settings:manage`, which the matrix grants to `super_admin` only
 * (FR-42). That is the whole access rule, and it is enforced by `requirePermission` rather than by a role
 * check written here — the matrix is the single source, so an `organization_admin` cannot reach these by
 * any route, including a future one.
 *
 * The logo takes a different shape from avatars on purpose. Avatars are presigned straight to R2 because
 * there can be many of them and the Worker's CPU budget is 10 ms (ADR-0008). A logo is uploaded once, is
 * capped at 512 KiB, and is the one image we actually need to inspect — so it goes **through** the Worker,
 * where the magic bytes can be checked and the metadata stripped, and the same `AVATARS` bucket holds it
 * under a `branding/` prefix. Serving it is public: a logo is branding, not personal data, and the bucket
 * stays private (FR-41) with the API as the only way in.
 */
import { createRealtimeEvent, detectImageType, stripImageMetadata } from "@pi-core/shared";
import {
  addAllowedDomain,
  getOrgSettings,
  listAllowedDomains,
  SettingsError,
  updateAllowedDomain,
  updateOrgSettings,
} from "@pi-core/db";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { conflict, notFound } from "../http/errors";
import { parseJson } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";
import { publishRealtimeEvent } from "../realtime/publisher";

export const settingsRoutes = new Hono<AppEnv>();
settingsRoutes.use("*", sessionMiddleware);

/** 512 KiB. A logo is displayed small; anything larger is a mistake. */
const MAX_LOGO_BYTES = 512 * 1024;
const LOGO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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

function settingsFailure(error: unknown): never {
  if (error instanceof SettingsError) {
    if (error.code === "not_found") throw notFound("Not found.");
    if (error.code === "invalid_domain") {
      throw conflict("That is not a bare hostname. Use `itera.ac.id`, without a scheme, path or @.");
    }
    if (error.code === "duplicate_domain") throw conflict("That domain is already in the list.");
    throw conflict("That image is not a JPEG, PNG or WebP.");
  }
  throw error;
}

// ---- allowed email domains (FR-40) ------------------------------------------

settingsRoutes.get("/domains", requirePermission("settings:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  return c.json({ items: await listAllowedDomains(db) });
});

const domainBody = z
  .object({ domain: z.string().trim().min(3).max(253), allowSubdomains: z.boolean().optional() })
  .strict();

settingsRoutes.post("/domains", requirePermission("settings:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();
  const body = await parseJson(c, domainBody);
  try {
    const domain = await addAllowedDomain(db, { actor, input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("settings", "allowed_domain", domain.id, "created"));
    return c.json({ domain }, 201);
  } catch (error) {
    return settingsFailure(error);
  }
});

const domainPatch = z
  .object({ isActive: z.boolean().optional(), allowSubdomains: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to change." });

settingsRoutes.patch("/domains/:id", requirePermission("settings:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();
  const body = await parseJson(c, domainPatch);
  try {
    const domain = await updateAllowedDomain(db, { actor, id: c.req.param("id"), input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("settings", "allowed_domain", c.req.param("id"), "updated"));
    return c.json({ domain });
  } catch (error) {
    return settingsFailure(error);
  }
});

// ---- organization profile (FR-41) -------------------------------------------

settingsRoutes.get("/org", requirePermission("settings:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  const settings = await getOrgSettings(db);
  return c.json({ settings, logoUrl: settings?.logoKey == null ? null : "/api/v1/settings/org/logo" });
});

const orgBody = z
  .object({ orgName: z.string().trim().min(1).max(150).optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to change." });

settingsRoutes.patch("/org", requirePermission("settings:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();
  const body = await parseJson(c, orgBody);
  try {
    const settings = await updateOrgSettings(db, { actor, input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("settings", "org_settings", "global", "updated"));
    return c.json({ settings });
  } catch (error) {
    return settingsFailure(error);
  }
});

/**
 * Upload the logo (FR-41). Through the Worker, not presigned — see the header for why.
 *
 * The declared content type is checked, but what decides is `detectImageType` on the actual bytes: a
 * client can call a file anything, and this is the one image whose bytes we are in a position to inspect.
 */
settingsRoutes.put("/org/logo", requirePermission("settings:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();
  if (c.env.AVATARS === undefined) throw notFound("Object storage is not configured.");

  const declared = (c.req.header("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!(declared in LOGO_TYPES)) {
    throw conflict("Send a JPEG, PNG or WebP image.");
  }

  const body = new Uint8Array(await c.req.arrayBuffer());
  if (body.byteLength === 0) throw conflict("The image is empty.");
  if (body.byteLength > MAX_LOGO_BYTES) throw conflict(`Logos must be at most ${MAX_LOGO_BYTES} bytes.`);

  const detected = detectImageType(body);
  if (detected === null) throw conflict("Those bytes are not a JPEG, PNG or WebP image.");

  // NFR-8, same treatment as avatars: a structural walk, not a decode.
  const stripped = stripImageMetadata(body);

  // One key per type, overwritten on each upload — the old object cannot be orphaned, and the public
  // serve route does not have to be told which key is current.
  const key = `branding/logo.${LOGO_TYPES[declared]}`;
  await c.env.AVATARS.put(key, stripped, { httpMetadata: { contentType: declared } });

  const settings = await updateOrgSettings(db, { actor, input: { logoKey: key }, request: requestFacts(c) });
  await publishRealtimeEvent(c, createRealtimeEvent("settings", "org_logo", "global", "updated"));
  return c.json({ settings, metadata: { strippedBytes: body.byteLength - stripped.length, bytes: stripped.length } });
});

/**
 * Serve the logo. Public by design: it is branding, and it appears on pages before anyone has signed in.
 * The bucket itself stays private (FR-41) — this route is the only way the bytes leave it.
 */
settingsRoutes.get("/org/logo", async (c) => {
  if (c.env.AVATARS === undefined) throw notFound();
  const db = c.get("db");
  const settings = db === undefined ? null : await getOrgSettings(db);
  const key = settings?.logoKey ?? "branding/logo.png";

  const object = await c.env.AVATARS.get(key);
  if (object === null) throw notFound("No logo has been uploaded.");

  const bytes = await object.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/png",
      // Public and cacheable: it is a logo, and the key is stable, so a cached copy cannot go stale in a
      // way that matters. `immutable` is deliberately NOT set, because the same key is overwritten.
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
});
