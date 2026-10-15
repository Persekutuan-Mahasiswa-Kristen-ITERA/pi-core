/**
 * Audit redaction — FR-43 requires `before`/`after` snapshots with **sensitive fields redacted**
 * (NFR-6). Pure and recursive, so an audit row can never accidentally carry a NIM, phone number or
 * token, whatever shape the caller passes in.
 */

/** Field names whose values must never reach `audit_logs`. Matched case-insensitively. */
export const SENSITIVE_AUDIT_KEYS: readonly string[] = [
  "nim",
  "phone",
  "google_sub",
  "password",
  "password_hash",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "client_secret",
  "secret",
  "cvc",
  "card_number",
];

export const REDACTED = "[redacted]";

const SENSITIVE = new Set(SENSITIVE_AUDIT_KEYS);

/**
 * Deep-copy `value`, replacing the value of any sensitive key with `"[redacted]"`.
 *
 * Arrays are walked element-wise; anything that is not a plain object/array is returned as-is
 * (it is already JSON-safe by the time it reaches `audit_logs`).
 */
export function redactForAudit<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactForAudit(item)) as unknown as T;
  }

  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      output[key] = SENSITIVE.has(key.toLowerCase()) ? REDACTED : redactForAudit(item);
    }
    return output as unknown as T;
  }

  return value;
}
