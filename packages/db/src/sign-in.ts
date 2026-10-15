/**
 * Sign-in resolution — the database side of FR-1, FR-3, FR-4 and FR-7.
 *
 * `resolveSignIn` is the one place admission is decided: it loads the allowlist, matches the member
 * (`google_sub` first, then email — FR-4), calls the pure `decideSignIn`, and **audits every
 * refusal** with the precise reason class while returning only the generic message to the client
 * (NFR-3, FR-7).
 *
 * The caller (Better Auth's Google callback) has already validated the ID token's signature, `iss`,
 * `aud`, `exp` and nonce/state — this never trusts an unvalidated claim.
 */
import {
  decideSignIn,
  emailDomain,
  GENERIC_SIGN_IN_DENIAL,
  type AllowedDomain,
  type SignInDecision,
} from "@pi-core/shared";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import { writeAudit, type AuthorizationRequest } from "./access";
import { allowedEmailDomains, authAccounts, authSessions, members } from "./schema";

/** Active allowlist entries, as the pure decision expects them. */
export async function loadAllowedDomains(db: Database): Promise<AllowedDomain[]> {
  const rows = await db
    .select({
      domain: allowedEmailDomains.domain,
      allowSubdomains: allowedEmailDomains.allowSubdomains,
      isActive: allowedEmailDomains.isActive,
    })
    .from(allowedEmailDomains)
    .where(eq(allowedEmailDomains.isActive, true));
  return rows;
}

export interface SignInMemberRecord {
  id: string;
  email: string;
  fullName: string;
  status: string;
  googleSub: string | null;
}

/**
 * Find the member for a sign-in attempt (FR-4). `google_sub` is **preferred** — it survives an email
 * change — and the email is the fallback. `members.email` is `citext`, so the match is
 * case-insensitive.
 */
export async function findMemberForSignIn(
  db: Database,
  params: { email?: string | null | undefined; googleSub?: string | null | undefined },
): Promise<SignInMemberRecord | null> {
  const columns = {
    id: members.id,
    email: members.email,
    fullName: members.fullName,
    status: members.status,
    googleSub: members.googleSub,
  };

  const googleSub = params.googleSub?.trim();
  if (googleSub !== undefined && googleSub !== "") {
    const bySub = await db.select(columns).from(members).where(eq(members.googleSub, googleSub)).limit(1);
    if (bySub[0] !== undefined) return bySub[0];
  }

  const email = params.email?.trim();
  if (email === undefined || email === "") return null;

  const byEmail = await db.select(columns).from(members).where(eq(members.email, email)).limit(1);
  return byEmail[0] ?? null;
}

export interface SignInResolution {
  decision: SignInDecision;
  /** The member row when admitted. */
  member?: SignInMemberRecord;
  /** Always {@link GENERIC_SIGN_IN_DENIAL} on refusal — the precise reason is only in the audit row. */
  message?: string;
  /** The `audit_logs` row written for a refusal (FR-7). */
  auditId?: string;
}

/**
 * Decide a sign-in attempt and audit refusals.
 *
 * The audit row records the **reason class**, the **email domain** (never the full address) and the
 * request metadata, plus the member id when the address matched one — so a denial is diagnosable
 * without the log becoming a list of who tried to sign in.
 */
export async function resolveSignIn(
  db: Database,
  params: {
    email?: string | null | undefined;
    emailVerified?: boolean | null | undefined;
    googleSub?: string | null | undefined;
    request?: AuthorizationRequest;
  },
): Promise<SignInResolution> {
  const allowedDomains = await loadAllowedDomains(db);
  const member = await findMemberForSignIn(db, { email: params.email, googleSub: params.googleSub });

  const decision = decideSignIn({
    email: params.email,
    emailVerified: params.emailVerified,
    allowedDomains,
    member: member === null ? null : { id: member.id, status: member.status, googleSub: member.googleSub },
  });

  if (decision.allowed) return { decision, member: member! };

  const auditId = await writeAudit(db, {
    actorMemberId: member?.id ?? null,
    action: "auth.denied",
    entityType: "member",
    entityId: member?.id ?? null,
    after: {
      stage: "sign_in",
      reason: decision.reason,
      // Only the domain — the full address is personal data and is not needed to diagnose.
      domain: params.email ? emailDomain(params.email) : null,
      emailVerified: params.emailVerified === true,
    },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return { decision, message: GENERIC_SIGN_IN_DENIAL, auditId };
}

/**
 * Admission for an **existing session**, re-checked on every request.
 *
 * Sign-in is not the only moment admission can change: a member can be deactivated, moved to
 * `suspended`, or an email domain can be removed from the allowlist *after* a session was issued
 * (FR-3, FR-5). So the same pure `decideSignIn` runs again here, and the caller must drop the
 * session when it refuses. Refusals are audited exactly like sign-in refusals (FR-7).
 *
 * `emailVerified` comes from **our** row (`members.email_verified`, written from Google's verified
 * claim at sign-in), not from anything the client sent.
 */
export async function resolveSessionAdmission(
  db: Database,
  memberId: string,
  request?: AuthorizationRequest,
): Promise<{ decision: SignInDecision; member: SignInMemberRecord | null }> {
  const rows = await db
    .select({
      id: members.id,
      email: members.email,
      fullName: members.fullName,
      status: members.status,
      googleSub: members.googleSub,
      emailVerified: members.emailVerified,
    })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);

  const row = rows[0] ?? null;
  const member: SignInMemberRecord | null =
    row === null
      ? null
      : {
          id: row.id,
          email: row.email,
          fullName: row.fullName,
          status: row.status,
          googleSub: row.googleSub,
        };

  const allowedDomains = await loadAllowedDomains(db);
  const decision = decideSignIn({
    email: row?.email ?? null,
    emailVerified: row?.emailVerified ?? false,
    allowedDomains,
    member: member === null ? null : { id: member.id, status: member.status, googleSub: member.googleSub },
  });

  if (!decision.allowed) {
    await writeAudit(db, {
      actorMemberId: member?.id ?? null,
      action: "auth.denied",
      entityType: "member",
      entityId: member?.id ?? null,
      after: {
        stage: "session",
        reason: decision.reason,
        domain: row?.email ? emailDomain(row.email) : null,
        emailVerified: row?.emailVerified === true,
      },
      ip: request?.ip ?? null,
      userAgent: request?.userAgent ?? null,
      requestId: request?.requestId ?? null,
    });
  }

  return { decision, member };
}

/**
 * Revokes every session a member currently holds (FR-5, NFR-5).
 *
 * Call this whenever access ends — a deactivation, a suspension, a role removal — so the change takes
 * effect immediately instead of waiting for the session to expire. It is a **belt** to the
 * `sessionMiddleware` brace: that middleware re-checks admission on every request and drops a refused
 * session anyway, but deleting up front means the row is gone rather than merely ignored.
 *
 * The window is therefore *zero*: the next request after revocation is unauthenticated. Audited, so a
 * revocation is as traceable as the grant it undoes.
 */
export async function revokeSessionsForMember(
  db: Database,
  memberId: string,
  params: { reason: string; actorMemberId?: string | null; request?: AuthorizationRequest },
): Promise<number> {
  const removed = await db
    .delete(authSessions)
    .where(eq(authSessions.userId, memberId))
    .returning({ id: authSessions.id });

  await writeAudit(db, {
    actorMemberId: params.actorMemberId ?? null,
    action: "auth.sessions_revoked",
    entityType: "member",
    entityId: memberId,
    after: { reason: params.reason, sessionsRevoked: removed.length },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return removed.length;
}

/** Active session count for a member — the read side of {@link revokeSessionsForMember}. */
export async function countSessionsForMember(db: Database, memberId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(authSessions)
    .where(eq(authSessions.userId, memberId));
  return rows[0]?.n ?? 0;
}

/**
 * Records what Google told us, once, on the request that follows a successful sign-in.
 *
 * The existence of a Google `accounts` row is itself the proof that Google reported the address as
 * verified: Better Auth only creates or links a user when its `!trusted && !emailVerified` guard
 * passes, and `trustedProviders` is deliberately unset (see `apps/api/src/auth.ts`). So this copies
 * the provider's `accountId` (the `sub` claim) into `members.google_sub` and sets
 * `members.email_verified = true` — the link FR-4 describes as happening at first login.
 *
 * It must run **before** admission: admission requires `email_verified` (NFR-1), and on a member's
 * first sign-in that flag is still false. Without this, the very first request after consent would
 * be refused by our own check.
 *
 * Idempotent — writes nothing and audits nothing when there is nothing to change.
 */
export async function syncGoogleIdentity(
  db: Database,
  memberId: string,
  request?: AuthorizationRequest,
): Promise<{ linked: boolean; verified: boolean }> {
  const accountRows = await db
    .select({ accountId: authAccounts.accountId })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, memberId), eq(authAccounts.providerId, "google")))
    .limit(1);

  const sub = accountRows[0]?.accountId;
  if (sub === undefined) return { linked: false, verified: false };

  const memberRows = await db
    .select({ googleSub: members.googleSub, emailVerified: members.emailVerified })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);

  const current = memberRows[0];
  if (current === undefined) return { linked: false, verified: false };

  const linked = current.googleSub === null;
  const verified = !current.emailVerified;
  if (!linked && !verified) return { linked: false, verified: false };

  await db
    .update(members)
    .set({
      ...(linked ? { googleSub: sub } : {}),
      ...(verified ? { emailVerified: true } : {}),
      updatedAt: new Date(),
    })
    .where(eq(members.id, memberId));

  await writeAudit(db, {
    actorMemberId: memberId,
    action: "auth.identity_linked",
    entityType: "member",
    entityId: memberId,
    after: { provider: "google", linkedGoogleSub: linked, markedEmailVerified: verified },
    ip: request?.ip ?? null,
    userAgent: request?.userAgent ?? null,
    requestId: request?.requestId ?? null,
  });

  return { linked, verified };
}
