/**
 * Member writes — story 4.3 (FR-10, FR-11, FR-12, FR-43).
 *
 * Three rules shape this file:
 *
 * 1. **Every mutation writes an audit row (FR-43).** Not in the route, where a new endpoint could forget
 *    it, but here: the only way to change a member is to call one of these functions, and every one of
 *    them writes the row before returning. `before`/`after` go through `redactForAudit`, so NIM and phone
 *    are not copied into a log that is deliberately append-only and therefore unerasable.
 *
 * 2. **Deactivation is soft (FR-12) and ends access immediately (FR-5).** The row stays (it is referenced
 *    by assignments and audit rows), `status` becomes `inactive` and `deleted_at` is set, and the
 *    member's sessions are deleted in the same call. Admission would refuse them on the next request
 *    anyway — `resolveSessionAdmission` re-reads `status` every time — but deleting the rows means the
 *    credential is gone rather than merely ignored.
 *
 * 3. **A member may edit only what `profile:update_own` covers (FR-11).** That permission is `S`-scoped
 *    and held by everyone, so it cannot be the only check for a self-edit: it would let a member set
 *    their own `status` or `email`. Hence a separate allow-list of self-editable fields, and everything
 *    else needs `member:update`.
 */
import { can, type Actor, type PermissionKey } from "@pi-core/shared";
import { eq, sql } from "drizzle-orm";
import { writeAudit, type AuthorizationRequest } from "./access";
import type { Database } from "./client";
import { getMember, type MemberListItem } from "./members";
import { members } from "./schema";
import { revokeSessionsForMember } from "./sign-in";

/**
 * What a member may change about themselves with `profile:update_own` (FR-11).
 *
 * Deliberately short. `email` and `google_sub` are identity and must follow Google; `status` is an
 * administrative decision; `nim`, `faculty`, `studyProgram` and `cohortYear` are academic records that a
 * person should not be able to rewrite about themselves.
 */
export const SELF_EDITABLE_FIELDS = ["phone", "avatarKey"] as const;

export interface MemberWriteInput {
  email?: string | undefined;
  fullName?: string | undefined;
  nim?: string | null | undefined;
  faculty?: string | null | undefined;
  studyProgram?: string | null | undefined;
  cohortYear?: number | null | undefined;
  phone?: string | null | undefined;
  avatarKey?: string | null | undefined;
}

export class MemberWriteError extends Error {
  constructor(readonly code: "conflict" | "not_found" | "forbidden_field") {
    super(code);
    this.name = "MemberWriteError";
  }
}

/** Postgres unique-violation, as it arrives through drizzle's error chain. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current !== null && current !== undefined; depth += 1) {
    if (typeof current === "object" && "code" in current && (current as { code?: unknown }).code === "23505") {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function createMember(
  db: Database,
  params: { actor: Actor; input: MemberWriteInput & { email: string; fullName: string }; request?: AuthorizationRequest },
): Promise<MemberListItem> {
  let inserted: { id: string } | undefined;
  try {
    const rows = await db
      .insert(members)
      .values({
        email: params.input.email,
        fullName: params.input.fullName,
        ...(params.input.nim === undefined ? {} : { nim: params.input.nim }),
        ...(params.input.faculty === undefined ? {} : { faculty: params.input.faculty }),
        ...(params.input.studyProgram === undefined ? {} : { studyProgram: params.input.studyProgram }),
        ...(params.input.cohortYear === undefined ? {} : { cohortYear: params.input.cohortYear }),
        ...(params.input.phone === undefined ? {} : { phone: params.input.phone }),
        ...(params.input.avatarKey === undefined ? {} : { avatarKey: params.input.avatarKey }),
      })
      .returning({ id: members.id });
    inserted = rows[0];
  } catch (error) {
    // A duplicate email is a conflict the caller can act on, not a 500.
    if (isUniqueViolation(error)) throw new MemberWriteError("conflict");
    throw error;
  }

  const member = inserted === undefined ? null : await getMember(db, { actor: params.actor, id: inserted.id });
  if (member === null) throw new MemberWriteError("not_found");

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "member.create",
    entityType: "member",
    entityId: member.id,
    after: { email: member.email, fullName: member.fullName },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return member;
}

export interface UpdateMemberParams {
  actor: Actor;
  id: string;
  input: MemberWriteInput;
  request?: AuthorizationRequest;
}

/**
 * Update a member, or throw.
 *
 * Self-edits are checked field by field against {@link SELF_EDITABLE_FIELDS}; anything else needs
 * `member:update`, whose scope (per the permission matrix) decides *which* members the actor may touch.
 */
export async function updateMember(db: Database, params: UpdateMemberParams): Promise<MemberListItem> {
  const isSelf = params.actor.memberId === params.id;
  const fields = Object.keys(params.input) as (keyof MemberWriteInput)[];

  if (isSelf) {
    // `profile:update_own` is `S`-scoped, so `can()` needs the target spelled out — without it the
    // decision is false even for the member's own record. The test caught exactly that.
    const selfAllowed = can(params.actor, "profile:update_own" as PermissionKey, { kind: "self" });
    const outsideSelf = fields.filter(
      (field) => !(SELF_EDITABLE_FIELDS as readonly string[]).includes(field),
    );
    if (!selfAllowed || outsideSelf.length > 0) {
      // Naming the fields is safe — they are the caller's own input — and it turns "403" into something
      // a developer can act on.
      if (outsideSelf.length > 0 && !can(params.actor, "member:update")) {
        throw new MemberWriteError("forbidden_field");
      }
      if (!selfAllowed) throw new MemberWriteError("forbidden_field");
    }
  } else if (!can(params.actor, "member:update")) {
    throw new MemberWriteError("forbidden_field");
  }

  // Read the row through the scoped reader first: an out-of-scope member must be "not found", never
  // updated, and that decision belongs in the same place the reads make it.
  const before = await getMember(db, { actor: params.actor, id: params.id });
  if (before === null) throw new MemberWriteError("not_found");

  await db
    .update(members)
    .set({ ...params.input, updatedAt: new Date() })
    .where(eq(members.id, params.id));

  const after = await getMember(db, { actor: params.actor, id: params.id });
  if (after === null) throw new MemberWriteError("not_found");

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "member.update",
    entityType: "member",
    entityId: params.id,
    // Only the fields that were actually sent: a full before/after would put unrelated personal data in
    // the log on every edit.
    before: Object.fromEntries(
      fields.map((field) => [field, (before as unknown as Record<string, unknown>)[field] ?? null]),
    ),
    after: Object.fromEntries(
      fields.map((field) => [field, (after as unknown as Record<string, unknown>)[field] ?? null]),
    ),
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return after;
}

export interface DeactivateResult {
  member: MemberListItem;
  sessionsRevoked: number;
}

/** Soft-delete a member and end their access (FR-12 + FR-5), audited (FR-43). */
export async function deactivateMember(
  db: Database,
  params: { actor: Actor; id: string; request?: AuthorizationRequest },
): Promise<DeactivateResult> {
  const before = await getMember(db, { actor: params.actor, id: params.id });
  if (before === null) throw new MemberWriteError("not_found");

  await db
    .update(members)
    .set({ status: "inactive", deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(members.id, params.id));

  // Order matters for the audit trail: revoking writes its own row, then this one records the whole
  // event. Both carry the same requestId, so they read as one action.
  const sessionsRevoked = await revokeSessionsForMember(db, params.id, {
    reason: "member_deactivated",
    actorMemberId: params.actor.memberId,
    ...(params.request === undefined ? {} : { request: params.request }),
  });

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "member.deactivate",
    entityType: "member",
    entityId: params.id,
    before: { status: before.status },
    after: { status: "inactive", deletedAt: new Date().toISOString(), sessionsRevoked },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  const after = await getMember(db, { actor: params.actor, id: params.id });
  if (after === null) throw new MemberWriteError("not_found");
  return { member: after, sessionsRevoked };
}

/** How many members the actor can currently see — a cheap diagnostic used by tests and the health page. */
export async function memberWriteProbe(db: Database): Promise<number> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(members);
  return rows[0]?.n ?? 0;
}
