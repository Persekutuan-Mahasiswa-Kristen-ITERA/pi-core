/**
 * The two server endpoints of the mobile hand-off (story 3.3, FR-2, NFR-16).
 *
 * `GET  /api/v1/auth/mobile/finish`   — reached by the **system browser** after Google consent. It
 *   already has a cookie session, so `sessionMiddleware` has admitted the member and set `actor`; it
 *   mints a one-time code and redirects to the app's deep link.
 * `POST /api/v1/auth/mobile/exchange` — called by the app with the code **and its PKCE verifier**; it
 *   returns a session token, which the app keeps in `expo-secure-store`.
 *
 * Both are registered public-with-a-reason (FR-25). That is honest, not a loophole: `finish` is
 * admitted by `sessionMiddleware` (no actor ⇒ 400, and the member has already passed the allowlist,
 * invite-only and email-verified checks), and `exchange` is admitted by possession of a single-use
 * code plus the verifier that hashes to the challenge bound to it.
 */
import { authSessions, consumeMobileAuthCode, mintMobileAuthCode, newMobileCode } from "@pi-core/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { sessionMiddleware } from "../middleware/session";

export const mobileAuthRoutes = new Hono<AppEnv>();

// Provides `db`, `auth` and (when signed in) `actor` for both legs.
mobileAuthRoutes.use("*", sessionMiddleware);

/** Sessions the app receives live as long as the web's, so the user is not re-asked constantly. */
const MOBILE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Only deep links we recognise, so a crafted `redirect_uri` cannot turn this endpoint into an open
 * redirector that hands a freshly minted code to an attacker's app. Configured per environment rather
 * than hardcoded, so staging and production can differ.
 */
function isAllowedRedirect(uri: string, allowed: string): boolean {
  if (uri === "") return false;
  return allowed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .some((entry) =>
      // An entry ending in `://` is a whole scheme, so it covers Expo Go's dynamic dev URLs
      // (`exp://192.168.x.x:8081/--/auth`); anything else must match exactly or as a prefix path.
      entry.endsWith("://") ? uri.startsWith(entry) : uri === entry || uri.startsWith(`${entry}/`),
    );
}

mobileAuthRoutes.get("/finish", async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  const redirectUri = c.req.query("redirect_uri") ?? "";
  const codeChallenge = c.req.query("code_challenge") ?? "";
  const state = c.req.query("state") ?? "";
  const allowed = c.env.MOBILE_REDIRECT_URIS ?? "";

  if (db === undefined || actor === undefined || codeChallenge === "" || !isAllowedRedirect(redirectUri, allowed)) {
    // No detail in the response: whether the redirect URI is unknown or the member was not admitted
    // is not something the caller needs to be able to distinguish.
    return c.json({ error: { code: "mobile_handoff_rejected" } }, 400);
  }

  const { code } = await mintMobileAuthCode(db, {
    memberId: actor.memberId,
    codeChallenge,
    redirectUri,
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state !== "") target.searchParams.set("state", state);
  return c.redirect(target.toString(), 302);
});

mobileAuthRoutes.post("/exchange", async (c) => {
  const db = c.get("db");
  if (db === undefined) return c.json({ error: { code: "unavailable" } }, 503);

  const body = (await c.req.json().catch(() => null)) as
    | { code?: unknown; verifier?: unknown; redirectUri?: unknown }
    | null;

  const code = typeof body?.code === "string" ? body.code : "";
  const verifier = typeof body?.verifier === "string" ? body.verifier : "";
  const redirectUri = typeof body?.redirectUri === "string" ? body.redirectUri : "";

  const ip = c.req.header("cf-connecting-ip");
  const userAgent = c.req.header("user-agent");
  const requestId = c.get("requestId");
  const request = {
    ...(ip !== undefined ? { ip } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
  };

  const result = await consumeMobileAuthCode(db, { code, verifier, redirectUri, request });
  if (!result.ok) {
    // One generic answer for every failure — a caller must not be able to tell a wrong verifier from
    // an expired code (NFR-3). The precise reason is in the audit row.
    return c.json({ error: { code: "invalid_grant" } }, 401);
  }

  // The member was admitted when the code was minted and is re-checked on every later request by
  // `sessionMiddleware`, so this token only ever carries an identity that still passes admission.
  const token = newMobileCode();
  const expiresAt = new Date(Date.now() + MOBILE_SESSION_TTL_MS);
  await db.insert(authSessions).values({ token, expiresAt, userId: result.memberId });

  return c.json({ token, expiresAt: expiresAt.toISOString(), tokenType: "Bearer" });
});

/** Sign-out for the app: the bearer token identifies the session, so revoke exactly that one. */
mobileAuthRoutes.post("/sign-out", async (c) => {
  const db = c.get("db");
  const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (db === undefined) return c.json({ error: { code: "unavailable" } }, 503);
  if (token === undefined || token === "") return c.json({ ok: true });

  await db.delete(authSessions).where(eq(authSessions.token, token));
  return c.json({ ok: true });
});
