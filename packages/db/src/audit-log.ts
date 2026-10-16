/**
 * Audit log reads — story 4.10 (FR-44, FR-13, FR-43).
 *
 * Three decisions, each about a way an audit *view* can be wrong even when the audit *log* is right:
 *
 * 1. **`O` scope only.** An audit entry has no org unit to scope by — it describes an actor acting on an
 *    entity, and the entity may have been deleted since (the log deliberately has no foreign keys, so it
 *    survives the member it refers to). A `U`-scoped actor cannot be shown "their subtree's" entries,
 *    because there is no subtree relation to filter on; approximating one would leak entries about
 *    members outside it. So a holder whose scope is not `O` is refused rather than shown a filtered list.
 * 2. **Redaction happens again on the way OUT, not only on the way in.** Rows are redacted before they are
 *    written (`redactForAudit`, FR-43), so re-redacting is normally a no-op. It is here because the
 *    alternative is trusting every past and future writer to have redacted correctly: one forgotten call
 *    at write time would otherwise be a permanent leak through the read path. A no-op that costs nothing
 *    and closes a whole class of mistake is worth having.
 * 3. **Cursor pagination on `(at, id)`, not `offset`.** An audit log grows while it is being read, so an
 *    offset page shifts under the reader and silently skips or repeats entries. The cursor is a fixed
 *    point in the log, so paging through a busy log shows each entry exactly once.
 */
import { redactForAudit, scopeFor, type Actor } from "@pi-core/shared";
import { and, desc, eq, gte, lt, lte, or, sql } from "drizzle-orm";
import type { Database } from "./client";
import { auditLogs } from "./schema";

export interface AuditEntryView {
  id: string;
  at: string;
  actorMemberId: string | null;
  /** Resolved for display when the member still exists; `null` when they have been deleted. */
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface AuditListParams {
  actor: Actor;
  action?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  actorMemberId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface AuditListResult {
  items: AuditEntryView[];
  nextCursor: string | null;
}

export class AuditError extends Error {
  constructor(readonly code: "forbidden_scope") {
    super(code);
    this.name = "AuditError";
  }
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function encodeCursor(at: Date, id: string): string {
  return btoa(`${at.toISOString()}|${id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCursor(cursor: string): { at: Date; id: string } | null {
  try {
    const padded = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const [at, id] = atob(padded).split("|");
    if (at === undefined || id === undefined) return null;
    const parsed = new Date(at);
    if (Number.isNaN(parsed.getTime())) return null;
    return { at: parsed, id };
  } catch {
    return null;
  }
}

export async function listAuditEntries(db: Database, params: AuditListParams): Promise<AuditListResult> {
  // Refused, not silently narrowed: see the header. The route guard proves they hold `audit:read`; this
  // proves they hold it widely enough for the log to be shown at all.
  if (scopeFor(params.actor, "audit:read") !== "O") throw new AuditError("forbidden_scope");

  const conditions = [];
  if (params.action !== undefined) conditions.push(eq(auditLogs.action, params.action));
  if (params.entityType !== undefined) conditions.push(eq(auditLogs.entityType, params.entityType));
  if (params.entityId !== undefined) conditions.push(eq(auditLogs.entityId, params.entityId));
  if (params.actorMemberId !== undefined) conditions.push(eq(auditLogs.actorMemberId, params.actorMemberId));
  if (params.from !== undefined) conditions.push(gte(auditLogs.at, new Date(params.from)));
  if (params.to !== undefined) conditions.push(lte(auditLogs.at, new Date(params.to)));

  const cursor = params.cursor === undefined ? null : decodeCursor(params.cursor);
  if (cursor !== null) {
    // Strictly older than the cursor's (at, id). The `id` tie-break matters because two rows can share a
    // millisecond, and comparing `at` alone would either loop forever or skip one of them.
    conditions.push(
      or(
        lt(auditLogs.at, cursor.at),
        and(eq(auditLogs.at, cursor.at), lt(auditLogs.id, cursor.id)),
      ),
    );
  }

  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const rows = await db
    .select()
    .from(auditLogs)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(desc(auditLogs.at), desc(auditLogs.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Actor names, resolved for display. A missing member is expected — the log outlives them — so a
  // `null` name is normal, not an error, and the row still says who it was by id.
  const actorIds = [...new Set(page.map((row) => row.actorMemberId).filter((id): id is string => id !== null))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const members = await db.execute(
      sql`select id, full_name from members where id in (${sql.join(actorIds.map((id) => sql`${id}`), sql`, `)})`,
    );
    for (const row of members.rows as Array<{ id: string; full_name: string }>) {
      names.set(row.id, row.full_name);
    }
  }

  const items: AuditEntryView[] = page.map((row) => ({
    id: row.id,
    at: row.at.toISOString(),
    actorMemberId: row.actorMemberId,
    actorName: row.actorMemberId === null ? null : (names.get(row.actorMemberId) ?? null),
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    // Again on the way out — see the header.
    before: redactForAudit(row.before),
    after: redactForAudit(row.after),
    ip: row.ip,
    userAgent: row.userAgent,
    requestId: row.requestId,
  }));

  const last = page[page.length - 1];
  return {
    items,
    nextCursor: hasMore && last !== undefined ? encodeCursor(last.at, last.id) : null,
  };
}

/** The distinct actions present in the log, so a UI can offer a filter that is guaranteed to match. */
export async function listAuditActions(db: Database): Promise<string[]> {
  const rows = await db.selectDistinct({ action: auditLogs.action }).from(auditLogs);
  return rows.map((row) => row.action).sort();
}
