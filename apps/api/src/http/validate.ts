/**
 * Input validation at the API boundary (FR-52).
 *
 * Every write goes through a zod schema, and the schemas are **`.strict()`**: an unknown field is a
 * `400`, not a silent drop. That matters more than it looks — silently ignoring `roleKey` on a member
 * update would make a typo look like success, and accepting extra fields is how mass-assignment bugs
 * get in.
 *
 * Validation errors are reported as `details` in the error envelope with the offending paths, which is
 * safe to show a developer and useless to an attacker (it describes their own input, not our data).
 */
import type { Context } from "hono";
import type { ZodType } from "zod";
import { badRequest } from "./errors";
import type { AppEnv } from "../env";

/** Parse and validate a JSON body, or throw the envelope. */
export async function parseJson<T>(c: Context<AppEnv>, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest("Expected a JSON body.");
  }
  return validate(schema, raw);
}

/** Parse and validate the query string. Values arrive as strings; schemas coerce as needed. */
export function parseQuery<T>(c: Context<AppEnv>, schema: ZodType<T>): T {
  const entries: Record<string, string> = {};
  for (const [key, value] of new URL(c.req.url).searchParams) entries[key] = value;
  return validate(schema, entries);
}

function validate<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw badRequest(
    "The request was not valid.",
    result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  );
}
