import { oauthAccessTokens, oauthClients, writeAudit } from "@pi-core/db";
import { createRealtimeEvent } from "@pi-core/shared";
import { desc, eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { conflict, notFound } from "../http/errors";
import { parseJson } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";
import { publishRealtimeEvent } from "../realtime/publisher";
import { getIntegrationConnectionStatus } from "./integration-status";

export const integrationRoutes = new Hono<AppEnv>();
integrationRoutes.use("*", sessionMiddleware);

const SCOPES = ["openid", "profile", "email", "pmk:access"] as const;
const scope = z.array(z.enum(SCOPES)).min(1).max(SCOPES.length);
const redirectUris = z.array(z.string().url()).min(1).max(20);

const createBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    redirectUris,
    scopes: scope,
    postLogoutRedirectUris: z.array(z.string().url()).max(20).optional(),
    type: z.enum(["web", "native", "user-agent-based"]).default("web"),
  })
  .strict();

const updateBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    redirectUris: redirectUris.optional(),
    scopes: scope.optional(),
    postLogoutRedirectUris: z.array(z.string().url()).max(20).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to change." });

type OAuthApi = {
  adminCreateOAuthClient: (input: { headers: Headers; body: unknown }) => Promise<unknown>;
  rotateClientSecret: (input: { headers: Headers; body: unknown }) => Promise<unknown>;
};

function authApi(c: Context<AppEnv>): OAuthApi {
  const auth = c.get("auth");
  if (auth === undefined) throw notFound();
  const api = auth.api as unknown as Partial<OAuthApi>;
  if (api.adminCreateOAuthClient === undefined || api.rotateClientSecret === undefined) {
    throw notFound("OAuth provider is not configured.");
  }
  return api as OAuthApi;
}

function headers(c: Context<AppEnv>): Headers {
  return c.req.raw.headers;
}

function toPluginInput(input: z.infer<typeof createBody>) {
  return {
    redirect_uris: input.redirectUris,
    scope: input.scopes.join(" "),
    client_name: input.name,
    post_logout_redirect_uris: input.postLogoutRedirectUris,
    token_endpoint_auth_method: input.type === "web" ? "client_secret_basic" : "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    type: input.type,
    require_pkce: true,
  };
}

function auditInput(c: Context<AppEnv>) {
  return {
    actorMemberId: c.get("actor")?.memberId ?? null,
    entityType: "oauth_client",
    ip: c.req.header("cf-connecting-ip") ?? null,
    userAgent: c.req.header("user-agent") ?? null,
    requestId: c.get("requestId") ?? null,
  };
}

integrationRoutes.get("/", requirePermission("integration:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  const clients = await db.select().from(oauthClients);
  const items = await Promise.all(
    clients.map(async (client) => {
      const latestAuthorization = await db
        .select({ createdAt: oauthAccessTokens.createdAt })
        .from(oauthAccessTokens)
        .where(eq(oauthAccessTokens.clientId, client.clientId))
        .orderBy(desc(oauthAccessTokens.createdAt))
        .limit(1);
      const lastAuthorizedAt = latestAuthorization[0]?.createdAt ?? null;
      return {
        clientId: client.clientId,
        name: client.name,
        redirectUris: client.redirectUris,
        scopes: client.scopes,
        enabled: !client.disabled,
        status: getIntegrationConnectionStatus(client.disabled === true, lastAuthorizedAt, new Date()),
        lastAuthorizedAt,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      };
    }),
  );
  return c.json({ items, connectedWindowDays: 30 });
});

integrationRoutes.post("/", requirePermission("integration:manage"), async (c) => {
  const db = c.get("db");
  const body = await parseJson(c, createBody);
  const created = await authApi(c).adminCreateOAuthClient({ headers: headers(c), body: toPluginInput(body) });
  const client = created as { client_id?: string; client_secret?: string };
  if (client.client_id === undefined) throw conflict("The integration could not be registered.");
  const stored = await db!.select().from(oauthClients).where(eq(oauthClients.clientId, client.client_id)).limit(1);
  if (stored[0] === undefined) throw conflict("The integration could not be verified after registration.");

  await writeAudit(db!, {
    ...auditInput(c),
    action: "integration.created",
    entityId: client.client_id,
    after: { clientId: client.client_id, name: body.name, redirectUris: body.redirectUris, scopes: body.scopes },
  });
  await publishRealtimeEvent(c, createRealtimeEvent("integrations", "integration", client.client_id, "created"));
  return c.json({ integration: created }, 201);
});

integrationRoutes.patch("/:clientId", requirePermission("integration:manage"), async (c) => {
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const body = await parseJson(c, updateBody);
  const existing = await db!.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
  if (existing[0] === undefined) throw notFound("Integration not found.");

  const { enabled, ...pluginFields } = body;

  const dbUpdate: Partial<typeof oauthClients.$inferInsert> = { updatedAt: new Date() };
  if (pluginFields.name !== undefined) dbUpdate.name = pluginFields.name;
  if (pluginFields.redirectUris !== undefined) dbUpdate.redirectUris = pluginFields.redirectUris;
  if (pluginFields.scopes !== undefined) dbUpdate.scopes = pluginFields.scopes;
  if (pluginFields.postLogoutRedirectUris !== undefined) {
    dbUpdate.postLogoutRedirectUris = pluginFields.postLogoutRedirectUris;
  }
  if (enabled !== undefined) dbUpdate.disabled = !enabled;
  await db!.update(oauthClients).set(dbUpdate).where(eq(oauthClients.clientId, clientId));

  const updated = await db!.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
  const result = updated[0];
  if (result === undefined) throw notFound("Integration not found.");
  await writeAudit(db!, {
    ...auditInput(c),
    action: enabled === undefined ? "integration.updated" : "integration.status_changed",
    entityId: clientId,
    before: { disabled: existing[0].disabled, redirectUris: existing[0].redirectUris, scopes: existing[0].scopes },
    after: { disabled: result.disabled, redirectUris: result.redirectUris, scopes: result.scopes },
  });
  await publishRealtimeEvent(c, createRealtimeEvent("integrations", "integration", clientId, "updated"));
  return c.json({ integration: { ...result, clientSecret: undefined } });
});

integrationRoutes.post("/:clientId/rotate-secret", requirePermission("integration:manage"), async (c) => {
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const existing = await db!.select({ id: oauthClients.clientId }).from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
  if (existing[0] === undefined) throw notFound("Integration not found.");
  const rotated = await authApi(c).rotateClientSecret({ headers: headers(c), body: { client_id: clientId } });
  const client = rotated as { client_secret?: string };
  if (client.client_secret === undefined) throw conflict("The client secret could not be rotated.");
  await writeAudit(db!, {
    ...auditInput(c),
    action: "integration.secret_rotated",
    entityId: clientId,
    after: { clientId, secretRotated: true },
  });
  await publishRealtimeEvent(c, createRealtimeEvent("integrations", "integration", clientId, "secret_rotated"));
  return c.json({ clientId, clientSecret: client.client_secret });
});

integrationRoutes.post("/:clientId/disable", requirePermission("integration:manage"), async (c) => {
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const existing = await db!.select({ disabled: oauthClients.disabled }).from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
  if (existing[0] === undefined) throw notFound("Integration not found.");
  await db!.update(oauthClients).set({ disabled: true, updatedAt: new Date() }).where(eq(oauthClients.clientId, clientId));
  await writeAudit(db!, { ...auditInput(c), action: "integration.status_changed", entityId: clientId, before: existing[0], after: { disabled: true } });
  await publishRealtimeEvent(c, createRealtimeEvent("integrations", "integration", clientId, "disabled"));
  return c.json({ clientId, enabled: false });
});

integrationRoutes.post("/:clientId/enable", requirePermission("integration:manage"), async (c) => {
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const existing = await db!.select({ disabled: oauthClients.disabled }).from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
  if (existing[0] === undefined) throw notFound("Integration not found.");
  await db!.update(oauthClients).set({ disabled: false, updatedAt: new Date() }).where(eq(oauthClients.clientId, clientId));
  await writeAudit(db!, { ...auditInput(c), action: "integration.status_changed", entityId: clientId, before: existing[0], after: { disabled: false } });
  await publishRealtimeEvent(c, createRealtimeEvent("integrations", "integration", clientId, "enabled"));
  return c.json({ clientId, enabled: true });
});
