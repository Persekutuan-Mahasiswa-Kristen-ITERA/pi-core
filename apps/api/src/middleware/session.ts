/**
 * Turns a Better Auth session — from the session cookie **or** an OAuth access token — into
 * `c.actor`, the value `requirePermission` reads (FR-25).
 *
 * Mount this on every **protected** route group. It opens the request's single short-lived Postgres
 * connection (ADR-0009) and wraps `next()` so that connection — and the auth instance built on it —
 * stays valid for the whole request.
 *
 * Two credentials are accepted, because two kinds of client exist:
 *  - a browser that completed Google sign-in on this origin, carrying the `better-auth.session_token`
 *    cookie (also accepted as `?token=` by the mobile hand-off);
 *  - an OAuth client (the admin web, PI-NEXUS) carrying `Authorization: Bearer <access token>`.
 *    Those tokens are issued by this same server and verified **in-process** against the `jwks`
 *    table, so no loopback subrequest is involved (see `oauth/verify-access-token.ts`).
 * A bearer token wins when both are present: the request explicitly named its credential.
 *
 * Admission is re-checked here on every request, not just at sign-in, for **both** paths: a member
 * can be deactivated or an email domain removed from the allowlist after a session or token was
 * issued (FR-3, FR-5). When a cookie session is refused, the session row is **deleted** so a stale
 * cookie cannot keep retrying; a token has no session row to delete, and it stays refused until it
 * expires because admission is re-evaluated on each request. Refusals are audited (FR-7).
 *
 * Being unauthenticated is normal — it is not an error here. The route decides what to do.
 */
import {
  authSessions,
  loadActor,
  resolveSessionAdmission,
  syncGoogleIdentity,
  withDb,
  type Database,
} from "@pi-core/db";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { createAuth } from "../auth";
import type { AppEnv } from "../env";
import {
  accessTokenAudience,
  verifyAccessTokenWithLocalJwks,
} from "../oauth/verify-access-token";

/** Facts that end up in audit rows; omitted rather than passed as `undefined` under exactOptionalPropertyTypes. */
function requestFacts(c: Context<AppEnv>): {
  ip?: string;
  userAgent?: string;
  requestId?: string;
} {
  const ip = c.req.header("cf-connecting-ip");
  const userAgent = c.req.header("user-agent");
  const requestId = c.get("requestId");
  return {
    ...(ip !== undefined ? { ip } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
  };
}

function bearerValue(header: string | undefined): string | null {
  return /^Bearer\s+(\S+)$/i.exec(header ?? "")?.[1] ?? null;
}

/** An OAuth access token is a JWS; the mobile hand-off issues an opaque random string instead. */
export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

/**
 * Subject behind an **opaque** session token — the mobile hand-off writes one row in `auth_sessions`
 * (`routes/mobile-auth.ts`) and the app sends it as a bearer. It carries no signed claims, so trust
 * comes only from the row existing and not being expired; admission is still re-checked by the caller
 * on every request, exactly as for a cookie session.
 *
 * The lookup is injected so the "unknown or expired" decision is testable without a database.
 */
export async function opaqueSessionSubject(
  lookup: (token: string) => Promise<{ userId: string; expiresAt: Date } | null>,
  token: string,
  now: number = Date.now(),
): Promise<string | null> {
  const row = await lookup(token);
  if (row === null) return null;
  const expiresAt = new Date(row.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now ? row.userId : null;
}

/**
 * Resolves the subject of a bearer token, or `null` when it cannot be trusted.
 *
 * Two shapes reach here: a signed access token from an OAuth client, and the opaque session token the
 * mobile app received from the hand-off. A token of neither shape is refused without touching the
 * database — it has nothing to verify, and an unauthenticated request must not spend a connection on
 * it unless the cheap shape check passed.
 */
async function accessTokenSubject(
  c: Context<AppEnv>,
  db: Database,
  token: string,
): Promise<string | null> {
  if (!looksLikeJwt(token)) {
    return opaqueSessionSubject(async (value) => {
      const rows = await db
        .select({ userId: authSessions.userId, expiresAt: authSessions.expiresAt })
        .from(authSessions)
        .where(eq(authSessions.token, value))
        .limit(1);
      const row = rows[0];
      return row === undefined ? null : { userId: row.userId, expiresAt: new Date(row.expiresAt) };
    }, token);
  }

  try {
    const claims = await verifyAccessTokenWithLocalJwks(
      db,
      token,
      accessTokenAudience(c.env),
    );
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "unknown verifier error";
    console.error("bearer access token rejected", {
      details: details.slice(0, 160),
    });
    return null;
  }
}

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.env.HYPERDRIVE) {
    return next();
  }

  await withDb(c.env.HYPERDRIVE, async (db) => {
    const auth = createAuth(db, c.env);
    c.set("auth", auth);
    // Expose the request's client so routes reuse this connection instead of opening a second one
    // (Hyperdrive owns pooling — ADR-0009).
    c.set("db", db);

    const request = requestFacts(c);
    const bearer = bearerValue(c.req.header("authorization"));
    const queryToken = c.req.query("token");
    // A WebSocket handshake cannot carry an `Authorization` header, so the realtime route takes the
    // token in the query string. Both credentials go through the same verification.
    const credential = bearer ?? (queryToken !== undefined && queryToken !== "" ? queryToken : null);

    if (credential !== null) {
      const subject = await accessTokenSubject(c, db, credential);
      if (subject !== null) {
        const admission = await resolveSessionAdmission(db, subject, request);
        if (admission.decision.allowed) {
          const loaded = await loadActor(db, subject);
          if (loaded !== null) c.set("actor", loaded.actor);
          const email = admission.member?.email;
          if (email !== undefined) c.set("sessionEmail", email);
        }
        return next();
      }
      // A refused bearer ends here: the request named its credential. A refused *query* token may
      // still be a Better Auth session token, which the cookie path below resolves.
      if (bearer !== null) return next();
    }

    const headers = new Headers(c.req.raw.headers);
    if (queryToken && !headers.has("cookie") && !headers.has("authorization")) {
      headers.set("cookie", `better-auth.session_token=${queryToken}`);
    }

    const session = await auth.api.getSession({ headers });

    if (session !== null) {
      // Before admission, not after: on a member's first sign-in `email_verified` is still false, and
      // admission requires it (NFR-1). This is where Google's `sub` and verified address land (FR-4).
      await syncGoogleIdentity(db, session.user.id, request);

      const admission = await resolveSessionAdmission(db, session.user.id, request);

      if (admission.decision.allowed) {
        const loaded = await loadActor(db, session.user.id);
        // `loadActor` returns the Actor plus the facts behind it (active period, which assignments
        // conferred roles) — the route gets the Actor; the rest is diagnostic.
        if (loaded !== null) c.set("actor", loaded.actor);
        c.set("sessionEmail", admission.member?.email ?? session.user.email);
      } else {
        await db.delete(authSessions).where(eq(authSessions.id, session.session.id));
      }
    }

    await next();
  });
});
