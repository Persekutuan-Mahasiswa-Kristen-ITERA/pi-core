/**
 * Settings — story 4.9 (FR-40, FR-41, FR-42).
 *
 * Two independent things live behind the same permission: the **allowed email domains** that decide who
 * may sign in at all, and the **organization profile** the UI shows. They share a permission because
 * FR-42 puts both behind `settings:manage` (super_admin only), not because they are related.
 *
 * Three decisions worth stating:
 *
 * 1. **Domains are never deleted, only deactivated.** `loadAllowedDomains` filters on `is_active`, so
 *    deactivating takes effect on the very next sign-in (FR-40) — and the audit trail keeps pointing at a
 *    row that still exists. A hard delete would leave the audit log describing a domain nobody can look
 *    up, which is the same information loss as not logging it.
 * 2. **No cache, anywhere.** FR-40 says changes take effect for *subsequent sign-ins*; the cheapest way to
 *    guarantee that is for the sign-in path to read the table every time, which it does. A cached domain
 *    list would make the criterion true only after a deploy — a security-relevant lie.
 * 3. **The domain is normalised before it is stored.** `citext` makes the lookup case-insensitive, but a
 *    stored `ITERA.ac.id` still reads as a different thing to a human reviewing the table, so it is
 *    lowercased on the way in. A scheme, a path or an `@` is refused rather than silently stripped: a
 *    typo that grants nothing is better than one that grants something unexpected.
 */
import type { Actor } from "@pi-core/shared";
import { and, asc, eq } from "drizzle-orm";
import { writeAudit, type AuthorizationRequest } from "./access";
import type { Database } from "./client";
import { allowedEmailDomains, orgSettings } from "./schema";

export interface AllowedDomainView {
  id: string;
  domain: string;
  allowSubdomains: boolean;
  isActive: boolean;
}

export interface OrgSettingsView {
  orgName: string;
  logoKey: string | null;
  updatedAt: string | null;
}

export class SettingsError extends Error {
  constructor(readonly code: "invalid_domain" | "duplicate_domain" | "not_found" | "invalid_logo") {
    super(code);
    this.name = "SettingsError";
  }
}

/**
 * A hostname, and nothing else. Deliberately strict: `itera.ac.id` passes, `https://itera.ac.id/`,
 * `@itera.ac.id` and `*.itera.ac.id` do not. Stripping a scheme or an `@` would accept a typo and then
 * quietly store something different from what was typed.
 */
const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normaliseDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!DOMAIN_PATTERN.test(trimmed)) throw new SettingsError("invalid_domain");
  return trimmed;
}

export async function listAllowedDomains(db: Database): Promise<AllowedDomainView[]> {
  const rows = await db
    .select({
      id: allowedEmailDomains.id,
      domain: allowedEmailDomains.domain,
      allowSubdomains: allowedEmailDomains.allowSubdomains,
      isActive: allowedEmailDomains.isActive,
    })
    .from(allowedEmailDomains)
    .orderBy(asc(allowedEmailDomains.domain));
  return rows;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current !== null && current !== undefined; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function addAllowedDomain(
  db: Database,
  params: { actor: Actor; input: { domain: string; allowSubdomains?: boolean | undefined }; request?: AuthorizationRequest },
): Promise<AllowedDomainView> {
  const domain = normaliseDomain(params.input.domain);

  let id: string;
  try {
    const [created] = await db
      .insert(allowedEmailDomains)
      .values({ domain, allowSubdomains: params.input.allowSubdomains ?? false })
      .returning({ id: allowedEmailDomains.id });
    id = created!.id;
  } catch (error) {
    // `citext` means `ITERA.ac.id` collides with `itera.ac.id` — which is the point of the column type.
    if (isUniqueViolation(error)) throw new SettingsError("duplicate_domain");
    throw error;
  }

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "settings.domain_add",
    entityType: "allowed_email_domain",
    entityId: id,
    after: { domain, allowSubdomains: params.input.allowSubdomains ?? false },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return { id, domain, allowSubdomains: params.input.allowSubdomains ?? false, isActive: true };
}

export async function updateAllowedDomain(
  db: Database,
  params: {
    actor: Actor;
    id: string;
    input: { isActive?: boolean | undefined; allowSubdomains?: boolean | undefined };
    request?: AuthorizationRequest;
  },
): Promise<AllowedDomainView> {
  const [before] = await db
    .select({
      id: allowedEmailDomains.id,
      domain: allowedEmailDomains.domain,
      allowSubdomains: allowedEmailDomains.allowSubdomains,
      isActive: allowedEmailDomains.isActive,
    })
    .from(allowedEmailDomains)
    .where(eq(allowedEmailDomains.id, params.id))
    .limit(1);
  if (before === undefined) throw new SettingsError("not_found");

  await db
    .update(allowedEmailDomains)
    .set({
      ...(params.input.isActive === undefined ? {} : { isActive: params.input.isActive }),
      ...(params.input.allowSubdomains === undefined ? {} : { allowSubdomains: params.input.allowSubdomains }),
      updatedAt: new Date(),
    })
    .where(eq(allowedEmailDomains.id, params.id));

  const after = {
    id: before.id,
    domain: before.domain,
    allowSubdomains: params.input.allowSubdomains ?? before.allowSubdomains,
    isActive: params.input.isActive ?? before.isActive,
  };

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "settings.domain_update",
    entityType: "allowed_email_domain",
    entityId: params.id,
    before: { allowSubdomains: before.allowSubdomains, isActive: before.isActive },
    after: { allowSubdomains: after.allowSubdomains, isActive: after.isActive },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return after;
}

/** The singleton row, or `null` before anyone has saved one. */
export async function getOrgSettings(db: Database): Promise<OrgSettingsView | null> {
  const [row] = await db
    .select({ orgName: orgSettings.orgName, logoKey: orgSettings.logoKey, updatedAt: orgSettings.updatedAt })
    .from(orgSettings)
    .where(eq(orgSettings.singleton, true))
    .limit(1);
  if (row === undefined) return null;
  return { orgName: row.orgName, logoKey: row.logoKey, updatedAt: row.updatedAt.toISOString() };
}

/**
 * Create-or-update the singleton.
 *
 * Written as an explicit select-then-insert-or-update rather than an upsert on a fixed id, because the
 * partial unique index is the real guarantee: two concurrent first-writes race on that index, and the
 * loser gets a unique violation it can retry. Pretending the row always exists would hide that.
 */
export async function updateOrgSettings(
  db: Database,
  params: {
    actor: Actor;
    input: { orgName?: string | undefined; logoKey?: string | null | undefined };
    request?: AuthorizationRequest;
  },
): Promise<OrgSettingsView> {
  const before = await getOrgSettings(db);
  if (before === null) {
    if (params.input.orgName === undefined) {
      throw new SettingsError("not_found");
    }
    const [created] = await db
      .insert(orgSettings)
      .values({ orgName: params.input.orgName, logoKey: params.input.logoKey ?? null })
      .returning({ orgName: orgSettings.orgName, logoKey: orgSettings.logoKey, updatedAt: orgSettings.updatedAt });
    await auditOrgChange(db, params.actor, null, created!, params.request);
    return { orgName: created!.orgName, logoKey: created!.logoKey, updatedAt: created!.updatedAt.toISOString() };
  }

  const [updated] = await db
    .update(orgSettings)
    .set({
      ...(params.input.orgName === undefined ? {} : { orgName: params.input.orgName }),
      ...(params.input.logoKey === undefined ? {} : { logoKey: params.input.logoKey }),
      updatedAt: new Date(),
    })
    .where(eq(orgSettings.singleton, true))
    .returning({ orgName: orgSettings.orgName, logoKey: orgSettings.logoKey, updatedAt: orgSettings.updatedAt });

  await auditOrgChange(db, params.actor, before, updated!, params.request);
  return { orgName: updated!.orgName, logoKey: updated!.logoKey, updatedAt: updated!.updatedAt.toISOString() };
}

async function auditOrgChange(
  db: Database,
  actor: Actor,
  before: OrgSettingsView | null,
  after: { orgName: string; logoKey: string | null },
  request: AuthorizationRequest | undefined,
): Promise<void> {
  await writeAudit(db, {
    actorMemberId: actor.memberId,
    action: before === null ? "settings.org_create" : "settings.org_update",
    entityType: "org_settings",
    entityId: null,
    before: before === null ? null : { orgName: before.orgName, logoKey: before.logoKey },
    after: { orgName: after.orgName, logoKey: after.logoKey },
    ip: request?.ip ?? null,
    userAgent: request?.userAgent ?? null,
    requestId: request?.requestId ?? null,
  });
}

/** Asserted by the verification script: deactivating a domain really does remove it from sign-in. */
export async function activeDomainNames(db: Database): Promise<string[]> {
  const rows = await db
    .select({ domain: allowedEmailDomains.domain })
    .from(allowedEmailDomains)
    .where(and(eq(allowedEmailDomains.isActive, true)));
  return rows.map((row) => row.domain);
}
