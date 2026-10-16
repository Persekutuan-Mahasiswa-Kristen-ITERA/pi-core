import { Hono } from "hono";
import type { AppEnv } from "./env";
import { errorBody, toErrorResponse } from "./http/errors";
import { corsMiddleware } from "./middleware/cors";
import { authRateLimit } from "./middleware/rate-limit";
import { requestIdMiddleware } from "./middleware/request-id";
import { securityHeadersMiddleware } from "./middleware/security-headers";
import { authRoutes } from "./routes/auth";
import { assignmentRoutes } from "./routes/assignments";
import { avatarRoutes } from "./routes/avatar";
import { healthRoutes } from "./routes/health";
import { memberRoutes } from "./routes/members";
import { mobileAuthRoutes } from "./routes/mobile-auth";
import { orgUnitRoutes } from "./routes/org-units";
import { periodRoutes } from "./routes/periods";
import { roleRoutes } from "./routes/roles";
import { signInPageRoutes } from "./routes/sign-in-page";

/**
 * The PI-CORE API Worker (ADR-0013, spine AD-17).
 *
 * This is the *only* place dynamic work happens: it owns `/api/v1/*`, the `RealtimeHub`
 * Durable Object (Epic 8), the OIDC endpoints (Epic 6) and all Postgres access through
 * Hyperdrive. The web UI is a static export served from Cloudflare's static assets, so
 * page views never invoke this script.
 */
export const app = new Hono<AppEnv>();

/**
 * Order matters (story 4.1):
 *
 * 1. `requestId` first — every later failure, including one thrown by another middleware, must be able
 *    to quote it (FR-51).
 * 2. Security headers and CORS next, so they apply to error responses too. A 403 that omits the headers
 *    is still a response a browser will act on.
 * 3. Routes last.
 */
app.use("*", requestIdMiddleware);
app.use("*", securityHeadersMiddleware);
app.use("*", corsMiddleware);

app.get("/", (c) =>
  c.json({
    service: "pi-core-api",
    version: "0.0.0",
    environment: c.env.ENVIRONMENT ?? "local",
  }),
);

app.route("/api/v1", healthRoutes);

/**
 * Rate limits (FR-53). Applied to the endpoints where guessing or flooding actually pays: starting a
 * sign-in, completing the OAuth callback, and the mobile code exchange. Deliberately **not** applied to
 * `/api/auth/get-session`, which every page load calls and which gives an attacker nothing.
 */
app.use("/api/auth/sign-in/*", authRateLimit);
app.use("/api/auth/callback/*", authRateLimit);
app.use("/api/v1/auth/mobile/finish", authRateLimit);
app.use("/api/v1/auth/mobile/exchange", authRateLimit);

// Better Auth owns /api/auth/* (ADR-0007). Mounted as a sub-app so nested paths like
// /api/auth/sign-in/social are covered — see routes/auth.ts.
app.route("/api/auth", authRoutes);

// Minimal same-origin sign-in page — a staging placeholder for the Epic 4 UI (see the file header).
app.route("/sign-in", signInPageRoutes);

// Mobile hand-off (story 3.3): the system browser returns here, the app exchanges the code for a token.
app.route("/api/v1/auth/mobile", mobileAuthRoutes);

// Member reads (story 4.2). Scope is enforced inside the SQL, not here — see packages/db/src/members.ts.
app.route("/api/v1/members", memberRoutes);

// Periods (story 4.6). Activation is its own endpoint because it is its own permission.
app.route("/api/v1/periods", periodRoutes);

// Organization units (story 4.5). Subtree checks ride on the materialised path (FR-18).
app.route("/api/v1/org-units", orgUnitRoutes);

// Avatar presign (story 4.4). Uploads go straight to R2, so the Worker never handles the bytes.
app.route("/api/v1/members", avatarRoutes);

// Roles and the permission catalog (story 4.7). System roles are read-only at the db layer, not in the UI.
app.route("/api/v1/roles", roleRoutes);

// Assignments and the derived role (story 4.8). The rank/subtree guard runs on the way in (FR-27).
app.route("/api/v1/assignments", assignmentRoutes);

// The uniform envelope applies to the two responses Hono produces without a route (FR-51).
app.notFound((c) => c.json(errorBody(c, "not_found"), 404));

app.onError((err, c) => {
  // Log with the correlation id so a user's report can be traced. The client gets none of this.
  console.error(`[${c.get("requestId") ?? "-"}] unhandled error`, err);
  return toErrorResponse(c, err);
});
