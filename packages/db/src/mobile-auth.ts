/**
 * The mobile sign-in hand-off (story 3.3, FR-2, NFR-16).
 *
 * The problem this solves: the app must use the **system browser** for OAuth (an embedded web view
 * cannot be trusted with the user's Google credentials), but the session lives on our origin — and the
 * only way back into the app is a custom-scheme deep link, which any other app on the device can also
 * observe. So the deep link must carry something worthless on its own.
 *
 * Hence a two-legged hand-off:
 *
 *   1. The app opens the system browser with a **PKCE `S256` challenge** it generated, and keeps the
 *      verifier in memory only.
 *   2. After Google consent the browser reaches our `finish` endpoint with a normal cookie session, so
 *      we know who signed in. We mint a random single-use **code** bound to that member, that
 *      challenge and that redirect URI, and redirect to the deep link with the code.
 *   3. The app posts the code **plus its verifier**. Only then does it receive the session token.
 *
 * What is deliberately *not* stored: the code itself — only its SHA-256, so a database read cannot be
 * replayed into a session. What is deliberately checked at exchange: expiry, single use, the redirect
 * URI, and that the verifier hashes to the challenge.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "./client";
import { writeAudit, type AuthorizationRequest } from "./access";
import { mobileAuthCodes } from "./schema";

/** Short by design: the user is already past consent, so the app is waiting at the deep link. */
export const MOBILE_CODE_TTL_MS = 5 * 60 * 1000;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Bytes(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

/** `base64url(SHA-256(verifier))` — the PKCE `S256` transform, shared by app and server. */
export async function codeChallengeFor(verifier: string): Promise<string> {
  return base64Url(await sha256Bytes(verifier));
}

/** A 256-bit random code, URL-safe. */
export function newMobileCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

/** Constant-time string comparison, so a wrong verifier cannot be narrowed down by timing. */
function equalsConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashCode(code: string): Promise<string> {
  const bytes = await sha256Bytes(code);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface MintedMobileCode {
  /** Returned to the caller once; only its hash is persisted. */
  code: string;
  expiresAt: Date;
}

/** Leg 2 of the hand-off: the browser knows the member, so bind a code to the app's challenge. */
export async function mintMobileAuthCode(
  db: Database,
  params: { memberId: string; codeChallenge: string; redirectUri: string },
): Promise<MintedMobileCode> {
  const code = newMobileCode();
  const expiresAt = new Date(Date.now() + MOBILE_CODE_TTL_MS);

  await db.insert(mobileAuthCodes).values({
    codeHash: await hashCode(code),
    memberId: params.memberId,
    codeChallenge: params.codeChallenge,
    redirectUri: params.redirectUri,
    expiresAt,
  });

  return { code, expiresAt };
}

export type MobileExchangeResult =
  | { ok: true; memberId: string }
  | { ok: false; reason: "code_unknown" | "code_expired" | "code_used" | "verifier_mismatch" };

/**
 * Leg 3: exchange a code for the right to a session, proving possession of the PKCE verifier.
 *
 * The row is consumed **before** the result is returned, so two concurrent requests cannot both
 * succeed: the `consumed_at IS NULL` guard in the WHERE clause makes the update itself the lock.
 */
export async function consumeMobileAuthCode(
  db: Database,
  params: { code: string; verifier: string; redirectUri: string; request?: AuthorizationRequest },
): Promise<MobileExchangeResult> {
  const codeHash = await hashCode(params.code);
  const rows = await db.select().from(mobileAuthCodes).where(eq(mobileAuthCodes.codeHash, codeHash)).limit(1);
  const row = rows[0];

  const deny = async (reason: Extract<MobileExchangeResult, { ok: false }>["reason"]): Promise<MobileExchangeResult> => {
    await writeAudit(db, {
      actorMemberId: row?.memberId ?? null,
      action: "auth.mobile_exchange_denied",
      entityType: "member",
      entityId: row?.memberId ?? null,
      after: { reason },
      ip: params.request?.ip ?? null,
      userAgent: params.request?.userAgent ?? null,
      requestId: params.request?.requestId ?? null,
    });
    return { ok: false, reason };
  };

  if (row === undefined) return deny("code_unknown");
  if (row.consumedAt !== null) return deny("code_used");
  if (row.expiresAt.getTime() <= Date.now()) return deny("code_expired");
  if (!equalsConstantTime(row.redirectUri, params.redirectUri)) return deny("verifier_mismatch");

  const challenge = await codeChallengeFor(params.verifier);
  if (!equalsConstantTime(row.codeChallenge, challenge)) return deny("verifier_mismatch");

  // Single use, enforced by the database rather than by the read above: whoever sets `consumed_at`
  // first wins, and the loser sees zero updated rows.
  const consumed = await db
    .update(mobileAuthCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(mobileAuthCodes.id, row.id), isNull(mobileAuthCodes.consumedAt)))
    .returning({ id: mobileAuthCodes.id });

  if (consumed.length === 0) return deny("code_used");

  return { ok: true, memberId: row.memberId };
}

/** Housekeeping: drop codes that can no longer be used. Keeps the table from growing without bound. */
export async function pruneMobileAuthCodes(db: Database): Promise<number> {
  const removed = await db
    .delete(mobileAuthCodes)
    .where(sql`${mobileAuthCodes.expiresAt} < now() - interval '1 day'`)
    .returning({ id: mobileAuthCodes.id });
  return removed.length;
}
