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
import { eq } from "drizzle-orm";
import type { Database } from "./client";
import { writeAudit, type AuthorizationRequest } from "./access";
import { allowedEmailDomains, members } from "./schema";

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
