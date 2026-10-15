/**
 * Turns a Better Auth session into `c.actor`, the value `requirePermission` reads (FR-25).
 *
 * Mount this on every **protected** route group. It opens the request's single short-lived Postgres
 * connection (ADR-0009) and wraps `next()` so that connection — and the auth instance built on it —
 * stays valid for the whole request.
 *
 * Admission is re-checked here on every request, not just at sign-in: a member can be deactivated or
 * an email domain removed from the allowlist after their session was issued (FR-3, FR-5). When it
 * refuses, the session row is **deleted** so a stale cookie cannot keep retrying, `actor` is left
 * unset (so guarded routes answer 401), and the refusal is audited (FR-7).
 *
 * Being unauthenticated is normal — it is not an error here. The route decides what to do.
 */
import { authSessions, loadActor, resolveSessionAdmission, withDb } from "@pi-core/db";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { createAuth } from "../auth";
import type { AppEnv } from "../env";

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await withDb(c.env.HYPERDRIVE, async (db) => {
    const auth = createAuth(db, c.env);
    c.set("auth", auth);

    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (session !== null) {
      // `exactOptionalPropertyTypes` is on, so absent headers must be omitted rather than passed as
      // `undefined`.
      const ip = c.req.header("cf-connecting-ip");
      const userAgent = c.req.header("user-agent");
      const requestId = c.get("requestId");

      const admission = await resolveSessionAdmission(db, session.user.id, {
        ...(ip !== undefined ? { ip } : {}),
        ...(userAgent !== undefined ? { userAgent } : {}),
        ...(requestId !== undefined ? { requestId } : {}),
      });

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
