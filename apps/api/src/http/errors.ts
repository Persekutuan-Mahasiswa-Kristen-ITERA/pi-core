/**
 * The uniform error body every endpoint returns (FR-51, `docs/ARCHITECTURE.md` §7):
 *
 * ```json
 * { "error": { "code": "…", "message": "…", "details": …, "requestId": "…" } }
 * ```
 *
 * Two rules make this worth centralising rather than writing per route:
 *
 * - **`code` is for the client, `message` is for the person.** The code is a stable machine string a
 *   UI can branch on; the message is safe to show and may change. Neither ever carries a stack trace,
 *   a SQL fragment or a reason an attacker could use to enumerate (NFR-3).
 * - **`requestId` is always present**, so a user can quote it and we can find the matching log line and
 *   audit row (FR-51).
 */
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../env";

/** Stable, machine-readable error codes. Add here, never invent inline. */
export const ERROR_CODES = {
  validation_failed: "The request body or query was not valid.",
  unauthorized: "Authentication is required.",
  forbidden: "You do not have permission to do this.",
  not_found: "Not found.",
  conflict: "That conflicts with existing data.",
  payload_too_large: "The request body is too large.",
  rate_limited: "Too many requests. Please try again shortly.",
  internal_error: "Something went wrong on our side.",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

/** Build the envelope. `message` defaults to the code's human sentence. */
export function errorBody(
  c: Context<AppEnv>,
  code: string,
  message?: string,
  details?: unknown,
): ErrorBody {
  return {
    error: {
      code,
      message: message ?? (ERROR_CODES as Record<string, string>)[code] ?? "Request failed.",
      ...(details === undefined ? {} : { details }),
      requestId: c.get("requestId") ?? "",
    },
  };
}

/** Throw from anywhere in a handler to produce the envelope with a specific status. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? (ERROR_CODES as Record<string, string>)[code] ?? "Request failed.");
    this.name = "ApiError";
  }
}

/** Shorthand used by routes: `throw badRequest("…")`. */
export const badRequest = (message?: string, details?: unknown): ApiError =>
  new ApiError(400, "validation_failed", message, details);
export const unauthorized = (message?: string): ApiError => new ApiError(401, "unauthorized", message);
export const forbidden = (message?: string): ApiError => new ApiError(403, "forbidden", message);
export const notFound = (message?: string): ApiError => new ApiError(404, "not_found", message);
export const conflict = (message?: string): ApiError => new ApiError(409, "conflict", message);
export const tooManyRequests = (message?: string): ApiError => new ApiError(429, "rate_limited", message);

/** Turn anything thrown into the envelope. Used by the app's `onError`. */
export function toErrorResponse(c: Context<AppEnv>, error: unknown): Response {
  if (error instanceof ApiError) {
    return c.json(errorBody(c, error.code, error.message, error.details), error.status);
  }
  // Never leak the real error to the client. The correlation id is how it gets found in the logs.
  return c.json(errorBody(c, "internal_error"), 500);
}
