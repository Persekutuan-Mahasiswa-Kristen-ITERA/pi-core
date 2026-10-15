/**
 * The authorization middleware every protected route must use (FR-25).
 *
 * It reads the actor that the (future, Epic 3) session middleware put on the context, applies the
 * single `can()` decision, and refuses with the uniform error body. Using it is what makes a route
 * "checked" for the purposes of `authorization-coverage.test.ts`.
 *
 * Deliberately thin: the decision itself lives in `@pi-core/shared`, so this file contains no
 * authorization logic of its own.
 */
import { can, type PermissionKey, type Target } from "@pi-core/shared";
import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";

export interface RequirePermissionOptions {
  /**
   * Derive the target for scope evaluation (`U` needs a unit id, `S` needs the actor). Omit for a
   * plain organization-wide permission check.
   */
  target?: (context: Context<AppEnv>) => Target | undefined;
}

export function requirePermission(
  permission: PermissionKey,
  options: RequirePermissionOptions = {},
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const actor = c.get("actor");
    if (actor === undefined) {
      return c.json({ error: { code: "unauthenticated", message: "Sign in required." } }, 401);
    }

    const target = options.target?.(c);
    if (!can(actor, permission, target)) {
      return c.json({ error: { code: "forbidden", message: "You do not have permission to do this." } }, 403);
    }

    await next();
  };
}
