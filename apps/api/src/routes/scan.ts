/**
 * Finds HTTP route registrations in Worker source, so the coverage test can require every one of
 * them to declare its authorization (FR-25 / SM-2).
 *
 * Two shapes are recognised:
 *
 *   router.get("/path", handler)                  — a single method
 *   app.on(["POST", "GET"], "/api/auth/*", h)     — several methods at once (how a library handler
 *                                                   such as Better Auth's is mounted)
 *
 * The second shape is easy to forget: a regex that only looks for `.get(`/`.post(` would let a
 * mounted handler slip past the check entirely.
 *
 * Exported (rather than inlined in the test) so the scanner itself can be unit-tested — an
 * unexercised scanner that silently matches nothing would make the whole suite vacuous.
 */

/** Receivers that mean "this registers an HTTP route". */
export const ROUTER_RECEIVER = /^(app|.*Routes|.*Router)$/;

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number] | "ALL";

export interface Registration {
  /** Path of the file under `apps/api/src/`. */
  file: string;
  /** The object the method was called on (`app`, `healthRoutes`, …). */
  receiver: string;
  method: HttpMethod;
  path: string;
}

/** `app.get("/x"`, `healthRoutes.post("/y"`, `app.all("/api/auth/*"` — a single-method registration. */
const SINGLE = /\b([A-Za-z_$][\w$]*)\s*\.(get|post|put|patch|delete|all)\(\s*["'`]([^"'`]+)["'`]/g;

/** `app.on(["POST", "GET"], "/api/auth/*"` — a multi-method registration. */
const MULTI = /\b([A-Za-z_$][\w$]*)\s*\.on\(\s*\[([^\]]*)\]\s*,\s*["'`]([^"'`]+)["'`]/g;

/**
 * Remove comments first: this module's own documentation contains example registrations, and
 * without stripping they would be reported as real routes.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments, including JSDoc
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // line comments, without eating "https://"
}

/** Extract every route registration from one file's source. */
export function findRegistrationsInSource(file: string, source: string): Registration[] {
  const code = stripComments(source);
  const found: Registration[] = [];

  for (const match of code.matchAll(SINGLE)) {
    found.push({
      file,
      receiver: match[1]!,
      method: match[2]!.toUpperCase() as HttpMethod,
      path: match[3]!,
    });
  }

  for (const match of code.matchAll(MULTI)) {
    const methods = [...match[2]!.matchAll(/["'`]([A-Za-z]+)["'`]/g)].map((m) => m[1]!.toUpperCase());
    for (const method of methods) {
      if (!(HTTP_METHODS as readonly string[]).includes(method)) continue;
      found.push({ file, receiver: match[1]!, method: method as HttpMethod, path: match[3]! });
    }
  }

  return found;
}
