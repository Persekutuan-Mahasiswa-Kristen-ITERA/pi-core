/**
 * Sign-in admission — FR-1, FR-3, FR-4, NFR-1..NFR-3.
 *
 * Pure: the caller has already validated the Google ID token's signature, `iss`, `aud`, `exp` and
 * nonce/state (Better Auth does that, ADR-0007) and looks the member up; this decides whether
 * admission is granted.
 *
 * Two rules are easy to get wrong and are encoded here:
 *
 *  - **The allowlist is enforced on the verified email**, never on Google's `hd` hint (NFR-2), and
 *    subdomain matching only happens when the entry sets `allow_subdomains`.
 *  - **One generic denial** (NFR-3): the returned `reason` is for the audit log and server logs
 *    only — the client always gets {@link GENERIC_SIGN_IN_DENIAL}, so nothing enumerates members.
 */
import type { RoleKey } from "../rbac/matrix";

export interface AllowedDomain {
  domain: string;
  allowSubdomains: boolean;
  isActive: boolean;
}

export type SignInDenialReason =
  | "email_missing"
  | "email_not_verified"
  | "domain_not_allowed"
  | "member_unknown"
  | "member_inactive";

export interface SignInMember {
  id: string;
  /** `members.status`: `active` | `inactive`. */
  status: string;
  /** Set after the first successful sign-in. */
  googleSub?: string | null | undefined;
}

export interface SignInAttempt {
  /** The email from the **verified** ID token. */
  email?: string | null | undefined;
  /** Google's `email_verified` claim — `true` is required (NFR-1). */
  emailVerified?: boolean | null | undefined;
  allowedDomains: readonly AllowedDomain[];
  /** The member found by `google_sub` first, then by email (FR-4). */
  member?: SignInMember | null | undefined;
}

export type SignInDecision =
  | {
      allowed: true;
      memberId: string;
      /** True when this sign-in should link `google_sub` (first login, FR-4). */
      linkGoogleSub: boolean;
    }
  | { allowed: false; reason: SignInDenialReason };

/** The single message every admission failure returns (NFR-3). */
export const GENERIC_SIGN_IN_DENIAL =
  "We couldn't sign you in. If you believe this is a mistake, please contact the administrator.";

/** The domain part of an email, lowercased; `""` when there is no `@`. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

/**
 * Is the email's domain allowlisted? Exact match, or a subdomain when the entry allows subdomains.
 * Inactive entries are ignored, and an empty domain never matches.
 */
export function isDomainAllowed(email: string, allowedDomains: readonly AllowedDomain[]): boolean {
  const domain = emailDomain(email);
  if (domain === "") return false;

  for (const entry of allowedDomains) {
    if (!entry.isActive) continue;
    const allowed = entry.domain.trim().toLowerCase().replace(/^\./, "");
    if (allowed === "") continue;
    if (domain === allowed) return true;
    if (entry.allowSubdomains && domain.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

/**
 * Decide admission. Checks run in a fixed order so the audit reason is always the most specific
 * true statement about the attempt.
 */
export function decideSignIn(attempt: SignInAttempt): SignInDecision {
  const email = attempt.email?.trim();
  if (email === undefined || email === "") return { allowed: false, reason: "email_missing" };

  if (attempt.emailVerified !== true) return { allowed: false, reason: "email_not_verified" };

  if (!isDomainAllowed(email, attempt.allowedDomains)) {
    return { allowed: false, reason: "domain_not_allowed" };
  }

  const member = attempt.member;
  if (member === undefined || member === null) return { allowed: false, reason: "member_unknown" };
  if (member.status !== "active") return { allowed: false, reason: "member_inactive" };

  return {
    allowed: true,
    memberId: member.id,
    linkGoogleSub: member.googleSub === undefined || member.googleSub === null || member.googleSub === "",
  };
}

/** Roles a freshly admitted member holds before any period assignment — the implicit baseline. */
export const IMPLICIT_SIGN_IN_ROLE: RoleKey = "anggota";
