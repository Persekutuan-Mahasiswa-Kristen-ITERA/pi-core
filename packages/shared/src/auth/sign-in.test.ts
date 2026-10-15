/**
 * FR-1, FR-3, FR-4 and NFR-1..NFR-3 — sign-in admission.
 *
 * Expectations are transcribed from the PRD; the allowlist fixture mirrors the ADR-0005 seed
 * (`itera.ac.id` and `student.itera.ac.id`, neither allowing subdomains).
 */
import { describe, expect, it } from "vitest";
import {
  GENERIC_SIGN_IN_DENIAL,
  decideSignIn,
  emailDomain,
  isDomainAllowed,
  type AllowedDomain,
  type SignInAttempt,
} from "./sign-in";

/** The ADR-0005 seed. */
const ITERA_ONLY: AllowedDomain[] = [
  { domain: "itera.ac.id", allowSubdomains: false, isActive: true },
  { domain: "student.itera.ac.id", allowSubdomains: false, isActive: true },
];

const ACTIVE_MEMBER = { id: "m-1", status: "active", googleSub: "google-sub-1" };
const FRESH_MEMBER = { id: "m-2", status: "active", googleSub: null };

function attempt(overrides: Partial<SignInAttempt> = {}): SignInAttempt {
  return {
    email: "budi@student.itera.ac.id",
    emailVerified: true,
    allowedDomains: ITERA_ONLY,
    member: ACTIVE_MEMBER,
    ...overrides,
  };
}

describe("emailDomain()", () => {
  it("returns the lowercased domain", () => {
    expect(emailDomain("Budi@Student.ITERA.ac.id")).toBe("student.itera.ac.id");
  });

  it("uses the last @ and returns empty when there is none", () => {
    expect(emailDomain("weird@name@itera.ac.id")).toBe("itera.ac.id");
    expect(emailDomain("no-at-sign")).toBe("");
  });
});

describe("isDomainAllowed() — FR-3, enforced on the verified email (NFR-2)", () => {
  it("allows an exact match", () => {
    expect(isDomainAllowed("budi@itera.ac.id", ITERA_ONLY)).toBe(true);
    expect(isDomainAllowed("budi@student.itera.ac.id", ITERA_ONLY)).toBe(true);
  });

  it("matches case-insensitively on both sides", () => {
    expect(isDomainAllowed("Budi@STUDENT.ITERA.AC.ID", ITERA_ONLY)).toBe(true);
    // An entry written in upper case still matches an exact, lower-cased domain.
    expect(isDomainAllowed("budi@itera.ac.id", [{ domain: "ITERA.AC.ID", allowSubdomains: false, isActive: true }])).toBe(
      true,
    );
    // …and still refuses a subdomain, because allowSubdomains is false.
    expect(
      isDomainAllowed("budi@student.itera.ac.id", [{ domain: "ITERA.AC.ID", allowSubdomains: false, isActive: true }]),
    ).toBe(false);
  });

  it("refuses a domain that is not listed", () => {
    expect(isDomainAllowed("someone@gmail.com", ITERA_ONLY)).toBe(false);
    expect(isDomainAllowed("someone@pmkitera.web.id", ITERA_ONLY)).toBe(false);
    expect(isDomainAllowed("someone@itera.ac.id.evil.com", ITERA_ONLY)).toBe(false);
  });

  it("refuses a subdomain unless the entry allows subdomains", () => {
    // `itera.ac.id` does NOT allow subdomains, which is why student.* is listed separately.
    expect(isDomainAllowed("budi@mhs.itera.ac.id", ITERA_ONLY)).toBe(false);
    const withSubdomains: AllowedDomain[] = [
      { domain: "itera.ac.id", allowSubdomains: true, isActive: true },
    ];
    expect(isDomainAllowed("budi@mhs.itera.ac.id", withSubdomains)).toBe(true);
    expect(isDomainAllowed("budi@itera.ac.id", withSubdomains)).toBe(true);
    // Still a suffix match, not a substring one.
    expect(isDomainAllowed("budi@itera.ac.id.evil.com", withSubdomains)).toBe(false);
  });

  it("ignores inactive entries", () => {
    expect(isDomainAllowed("budi@itera.ac.id", [{ domain: "itera.ac.id", allowSubdomains: false, isActive: false }])).toBe(
      false,
    );
  });

  it("never matches an empty or malformed entry", () => {
    expect(isDomainAllowed("budi@", ITERA_ONLY)).toBe(false);
    expect(isDomainAllowed("budi@itera.ac.id", [{ domain: "", allowSubdomains: true, isActive: true }])).toBe(false);
    expect(isDomainAllowed("budi@itera.ac.id", [])).toBe(false);
  });
});

describe("decideSignIn() — the happy path (FR-1)", () => {
  it("admits an allowed, verified, active member", () => {
    expect(decideSignIn(attempt())).toEqual({ allowed: true, memberId: "m-1", linkGoogleSub: false });
  });

  it("links google_sub on first login (FR-4)", () => {
    expect(decideSignIn(attempt({ member: FRESH_MEMBER }))).toEqual({
      allowed: true,
      memberId: "m-2",
      linkGoogleSub: true,
    });
  });

  it("treats an empty google_sub as not yet linked", () => {
    expect(decideSignIn(attempt({ member: { id: "m-3", status: "active", googleSub: "" } }))).toEqual({
      allowed: true,
      memberId: "m-3",
      linkGoogleSub: true,
    });
  });
});

describe("decideSignIn() — refusals (NFR-1, FR-3, FR-4)", () => {
  it("requires email_verified = true (NFR-1)", () => {
    for (const value of [false, null]) {
      expect(decideSignIn(attempt({ emailVerified: value })), String(value)).toEqual({
        allowed: false,
        reason: "email_not_verified",
      });
    }
    // An absent claim is not `true` either.
    expect(
      decideSignIn({ email: "budi@student.itera.ac.id", allowedDomains: ITERA_ONLY, member: ACTIVE_MEMBER }),
    ).toEqual({ allowed: false, reason: "email_not_verified" });
  });

  it("refuses a missing or blank email", () => {
    for (const value of [null, "", "   "]) {
      expect(decideSignIn(attempt({ email: value })), JSON.stringify(value)).toEqual({
        allowed: false,
        reason: "email_missing",
      });
    }
    expect(decideSignIn({ emailVerified: true, allowedDomains: ITERA_ONLY, member: ACTIVE_MEMBER })).toEqual({
      allowed: false,
      reason: "email_missing",
    });
  });

  it("refuses a non-allowlisted domain (FR-3)", () => {
    expect(decideSignIn(attempt({ email: "someone@gmail.com" }))).toEqual({
      allowed: false,
      reason: "domain_not_allowed",
    });
    expect(decideSignIn(attempt({ email: "someone@pmkitera.web.id" }))).toEqual({
      allowed: false,
      reason: "domain_not_allowed",
    });
  });

  it("refuses an unknown member — invite-only (FR-4)", () => {
    expect(decideSignIn(attempt({ member: null }))).toEqual({ allowed: false, reason: "member_unknown" });
    // No member at all (the key absent) is the same refusal.
    expect(decideSignIn({ email: "budi@student.itera.ac.id", emailVerified: true, allowedDomains: ITERA_ONLY })).toEqual({
      allowed: false,
      reason: "member_unknown",
    });
  });

  it("refuses an inactive member (FR-4)", () => {
    expect(decideSignIn(attempt({ member: { id: "m-9", status: "inactive" } }))).toEqual({
      allowed: false,
      reason: "member_inactive",
    });
  });

  it("checks in a fixed order, so the reason is deterministic", () => {
    // Everything is wrong: the first check wins.
    const allWrong = decideSignIn({ email: null, emailVerified: false, allowedDomains: [], member: null });
    expect(allWrong).toEqual({ allowed: false, reason: "email_missing" });

    // Unverified AND non-allowlisted AND unknown → the verification check is reported.
    const unverified = decideSignIn({
      email: "someone@gmail.com",
      emailVerified: false,
      allowedDomains: ITERA_ONLY,
      member: null,
    });
    expect(unverified).toEqual({ allowed: false, reason: "email_not_verified" });
  });

  it("refuses every refusal case with the SAME client-facing message (NFR-3)", () => {
    const reasons = ["email_missing", "email_not_verified", "domain_not_allowed", "member_unknown", "member_inactive"];
    const messages = reasons.map(() => GENERIC_SIGN_IN_DENIAL);
    expect(new Set(messages).size).toBe(1);
    expect(GENERIC_SIGN_IN_DENIAL).toBeTruthy();
    // The generic message must not reveal which check failed.
    for (const word of ["domain", "verified", "member", "email", "allowlist"]) {
      expect(GENERIC_SIGN_IN_DENIAL.toLowerCase()).not.toContain(word);
    }
  });
});
