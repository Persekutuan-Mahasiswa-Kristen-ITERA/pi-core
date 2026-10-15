import { Hono } from "hono";
import type { AppEnv } from "./env";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
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

app.get("/", (c) =>
  c.json({
    service: "pi-core-api",
    version: "0.0.0",
    environment: c.env.ENVIRONMENT ?? "local",
  }),
);

app.route("/api/v1", healthRoutes);

// Better Auth owns /api/auth/* (ADR-0007). Mounted as a sub-app so nested paths like
// /api/auth/sign-in/social are covered — see routes/auth.ts.
app.route("/api/auth", authRoutes);

// Minimal same-origin sign-in page — a staging placeholder for the Epic 4 UI (see the file header).
app.route("/sign-in", signInPageRoutes);

app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));

app.onError((err, c) => {
  console.error("unhandled error", err);
  return c.json({ error: { code: "internal_error", message: "Internal error" } }, 500);
});
