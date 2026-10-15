/**
 * Seed data for `allowed_email_domains` — the server-side sign-in allowlist (FR-3).
 *
 * **ADR-0005**: ITERA domains only. `pmkitera.web.id` is deliberately absent — its mailboxes are
 * not Google accounts, so nobody could ever sign in with one.
 *
 * `allow_subdomains` is **false for both entries on purpose**:
 *  - `itera.ac.id` must not admit `student.itera.ac.id` implicitly; the student domain is a
 *    separate, explicitly-listed entry so that removing student access is one row, not a flag.
 *  - `student.itera.ac.id` needs no subdomains of its own.
 * The `allow_subdomains` mechanism still exists for future domains that really do want wildcards.
 */
export interface SeedAllowedDomain {
  domain: string;
  allowSubdomains: boolean;
}

export const ALLOWED_EMAIL_DOMAINS: readonly SeedAllowedDomain[] = [
  { domain: "itera.ac.id", allowSubdomains: false },
  { domain: "student.itera.ac.id", allowSubdomains: false },
];

/** Domains ADR-0005 explicitly rejects, asserted by the seed so a future edit cannot sneak one in. */
export const FORBIDDEN_EMAIL_DOMAINS: readonly string[] = ["pmkitera.web.id"];
