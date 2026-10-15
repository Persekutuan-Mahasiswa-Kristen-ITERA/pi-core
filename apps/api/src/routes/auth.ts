/**
 * Better Auth's catch-all, mounted at `/api/auth` (ADR-0007, ADR-0015).
 *
 * Mounted as a **sub-app** rather than `app.all("/api/auth/*", …)`: in Hono a `*` matches a single
 * path segment, so the flat form answered `/api/auth/get-session` but 404'd on nested endpoints like
 * `/api/auth/sign-in/social`. Inside a mounted sub-app, `"*"` covers everything under the mount.
 *
 * Declared **public** in the FR-25 registry: this IS the sign-in attempt, so there is no session to
 * authorize yet. **The admission rules are not enforced yet** — `resolveSignIn` (FR-3, FR-4, NFR-1)
 * is written and tested but not yet called from the OAuth callback, so as of now any Google account
 * that completes consent would receive a session. Wiring that hook is the rest of story 3.1; keep the
 * consent screen in Testing mode until it lands.
 */
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { authMiddleware } from "../middleware/auth";

export const authRoutes = new Hono<AppEnv>();

// One auth instance per request (ADR-0015) — `authMiddleware` wraps `next()` so the single
// short-lived Postgres connection stays open for the whole request.
authRoutes.use("*", authMiddleware);

authRoutes.all("*", (c) => c.get("auth")!.handler(c.req.raw));
