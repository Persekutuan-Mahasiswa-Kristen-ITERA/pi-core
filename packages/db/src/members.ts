/**
 * Member reads — story 4.2 (FR-8, FR-9, FR-26, FR-51).
 *
 * **FR-26 is the reason this lives in the database layer and not in the route.** The requirement says a
 * scope must be enforced *in the query*, not by fetching everything and filtering in application code.
 * The difference is not stylistic: filtering after the fetch means a bug (or a future refactor that
 * forgets the filter) returns rows the actor was never allowed to see, and it means the database does
 * work proportional to the whole directory on every page. So the `WHERE` clause itself carries the
 * scope, and there is no code path that reads member rows for a list without it.
 *
 * What "in scope" means here, stated plainly because it is a design decision rather than something the
 * schema dictates: a `U`-scoped actor sees members who hold an **assignment in their unit subtree**
 * during the **active period**, plus themselves. A member with no assignment at all is therefore not
 * visible to a `U` actor — there is no unit relation to scope by. `O` sees everyone; `S` sees only
 * themselves.
 *
 * FR-9 is the second half: sensitive columns are only *selected* when the actor holds
 * `member:read_sensitive`. Not selected-then-redacted — a redaction step can be skipped by a new
 * serializer, whereas a column that was never read cannot leak.
 */
import {
  can,
  scopeFor,
  type Actor,
  type PermissionKey,
} from "@pi-core/shared";
import { and, asc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { findActivePeriodId } from "./access";
import type { Database } from "./client";
import { assignments, members } from "./schema";

/**
 * Columns that require `member:read_sensitive` (FR-9). Listed once so the route, the query and the
 * tests cannot drift apart.
 */
export const SENSITIVE_MEMBER_FIELDS = ["nim", "phone"] as const;
export type SensitiveMemberField = (typeof SENSITIVE_MEMBER_FIELDS)[number];

/** What every caller gets. */
export interface MemberSummary {
  id: string;
  email: string;
  fullName: string;
  avatarKey: string | null;
  status: string;
}

/** Added only with `member:read_sensitive`. */
export interface MemberSensitive {
  nim: string | null;
  phone: string | null;
}

export interface MemberListItem extends MemberSummary {
  sensitive?: MemberSensitive;
}

export interface MemberListParams {
  actor: Actor;
  search?: string | undefined;
  /** Opaque cursor from a previous page (FR-51 cursor pagination). */
  cursor?: string | undefined;
  limit?: number;
}

export interface MemberListResult {
  items: MemberListItem[];
  nextCursor: string | null;
  /** True when sensitive columns were included, so a caller never has to guess. */
  sensitiveIncluded: boolean;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** The permission that decides scope for member reads. */
const READ: PermissionKey = "member:read";
const READ_SENSITIVE: PermissionKey = "member:read_sensitive";

/** `fullName|id`, base64url — opaque to the client so the ordering can change later. */
function encodeCursor(fullName: string, id: string): string {
  return btoa(JSON.stringify([fullName, id]))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeCursor(cursor: string): { fullName: string; id: string } | null {
  try {
    const padded = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const parsed: unknown = JSON.parse(atob(padded));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [fullName, id] = parsed;
    if (typeof fullName !== "string" || typeof id !== "string") return null;
    return { fullName, id };
  } catch {
    return null;
  }
}

/**
 * The `WHERE` fragment that carries the actor's scope. Returns `null` when the actor may see nobody,
 * which callers must treat as "empty result", never as "no filter".
 */
async function scopeCondition(db: Database, actor: Actor) {
  const scope = scopeFor(actor, READ);
  if (scope === "O") return undefined; // org-wide: no member filter at all
  if (scope === "S" || scope === undefined) return eq(members.id, actor.memberId);

  // `U`: members with an assignment inside the actor's subtree, during the active period, plus self.
  const unitScope = actor.unitScope ?? [];
  const selfVisible = eq(members.id, actor.memberId);
  if (unitScope.length === 0) return selfVisible;

  const periodId = await findActivePeriodId(db);
  if (periodId === null) return selfVisible;

  const inSubtree = db
    .select({ id: assignments.memberId })
    .from(assignments)
    .where(and(eq(assignments.periodId, periodId), inArray(assignments.orgUnitId, [...unitScope])));

  return or(inArray(members.id, inSubtree), selfVisible);
}

export async function listMembers(db: Database, params: MemberListParams): Promise<MemberListResult> {
  const includeSensitive = can(params.actor, READ_SENSITIVE);
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const conditions = [];
  const scope = await scopeCondition(db, params.actor);
  if (scope !== undefined) conditions.push(scope);

  const search = params.search?.trim();
  if (search !== undefined && search !== "") {
    // Name or email. `ilike` keeps it case-insensitive without a full-text index we do not have yet.
    const pattern = `%${search.replace(/[%_]/g, (match) => `\\${match}`)}%`;
    const searchCondition = or(ilike(members.fullName, pattern), ilike(members.email, pattern));
    if (searchCondition !== undefined) conditions.push(searchCondition);
  }

  if (params.cursor !== undefined) {
    const decoded = decodeCursor(params.cursor);
    // An unparseable cursor is treated as "start from the beginning" rather than an error: it is a
    // pagination detail, and failing the whole request over it helps nobody.
    if (decoded !== null) {
      const after = or(
        gt(members.fullName, decoded.fullName),
        and(eq(members.fullName, decoded.fullName), gt(members.id, decoded.id)),
      );
      if (after !== undefined) conditions.push(after);
    }
  }

  const rows = await db
    .select({
      id: members.id,
      email: members.email,
      fullName: members.fullName,
      avatarKey: members.avatarKey,
      status: members.status,
      // Selected only when permitted (FR-9) — see the file header for why this is not a redaction step.
      ...(includeSensitive ? { nim: members.nim, phone: members.phone } : {}),
    })
    .from(members)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(asc(members.fullName), asc(members.id))
    // One extra row tells us whether a next page exists without a second count query.
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    items: page as MemberListItem[],
    nextCursor: hasMore && last !== undefined ? encodeCursor(last.fullName, last.id) : null,
    sensitiveIncluded: includeSensitive,
  };
}

/**
 * One member, or `null` when they are outside the actor's scope.
 *
 * The caller turns `null` into a **404, not a 403** — telling a `U`-scoped actor "forbidden" would
 * confirm that the id exists, which is exactly the enumeration FR-8's scoping is meant to prevent.
 */
export async function getMember(
  db: Database,
  params: { actor: Actor; id: string },
): Promise<MemberListItem | null> {
  const includeSensitive = can(params.actor, READ_SENSITIVE);
  const scope = await scopeCondition(db, params.actor);
  if (scope === undefined && scopeFor(params.actor, READ) === undefined) return null;

  const conditions = [eq(members.id, params.id)];
  if (scope !== undefined) conditions.push(scope);

  const rows = await db
    .select({
      id: members.id,
      email: members.email,
      fullName: members.fullName,
      avatarKey: members.avatarKey,
      status: members.status,
      ...(includeSensitive ? { nim: members.nim, phone: members.phone } : {}),
    })
    .from(members)
    .where(and(...conditions))
    .limit(1);

  return (rows[0] as MemberListItem | undefined) ?? null;
}

/** Total members visible to the actor — used by the health/diagnostic surfaces, never by a page. */
export async function countVisibleMembers(db: Database, actor: Actor): Promise<number> {
  const scope = await scopeCondition(db, actor);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(members)
    .where(scope === undefined ? undefined : scope);
  return rows[0]?.n ?? 0;
}
