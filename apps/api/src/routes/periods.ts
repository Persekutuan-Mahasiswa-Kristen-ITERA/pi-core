/**
 * Periods — story 4.6 (FR-19, FR-20, FR-21).
 *
 * Thin, like the member routes: `requirePermission` decides whether the actor may do this at all, and
 * `packages/db/src/periods.ts` owns the invariants. Activation is a separate endpoint from update
 * because it is a separate permission (`period:activate`) and a separate decision — editing a period's
 * dates must not change anyone's access.
 */
import { activatePeriod, createPeriod, listPeriods, PeriodError, updatePeriod } from "@pi-core/db";
import { createRealtimeEvent } from "@pi-core/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { badRequest, conflict, notFound } from "../http/errors";
import { parseJson } from "../http/validate";
import { requirePermission } from "../middleware/authorization";
import { sessionMiddleware } from "../middleware/session";
import { publishRealtimeEvent } from "../realtime/publisher";

export const periodRoutes = new Hono<AppEnv>();

periodRoutes.use("*", sessionMiddleware);

function requestFacts(c: Context<AppEnv>) {
  const ip = c.req.header("cf-connecting-ip");
  const userAgent = c.req.header("user-agent");
  const requestId = c.get("requestId");
  return {
    ...(ip === undefined ? {} : { ip }),
    ...(userAgent === undefined ? {} : { userAgent }),
    ...(requestId === undefined ? {} : { requestId }),
  };
}

function periodFailure(error: unknown): never {
  if (error instanceof PeriodError) {
    if (error.code === "conflict") throw conflict("A period with that label already exists.");
    if (error.code === "invalid_range") throw badRequest("The end date must not precede the start date.");
    throw notFound("Period not found.");
  }
  throw error;
}

/** ISO dates only: the column is a `date`, and accepting a timestamp would invite timezone surprises. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const createBody = z
  .object({
    label: z.string().trim().min(1).max(100),
    startDate: isoDate,
    endDate: isoDate,
  })
  .strict();

const updateBody = z
  .object({
    label: z.string().trim().min(1).max(100).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to change." });

periodRoutes.get("/", requirePermission("period:read"), async (c) => {
  const db = c.get("db");
  if (db === undefined) throw notFound();
  const items = await listPeriods(db);
  return c.json({ items, activePeriodId: items.find((p) => p.isActive)?.id ?? null });
});

periodRoutes.post("/", requirePermission("period:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const body = await parseJson(c, createBody);
  try {
    const period = await createPeriod(db, { actor, input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("periods", "period", period.id, "created"));
    return c.json({ period }, 201);
  } catch (error) {
    return periodFailure(error);
  }
});

periodRoutes.patch("/:id", requirePermission("period:manage"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  const body = await parseJson(c, updateBody);
  try {
    const period = await updatePeriod(db, { actor, id: c.req.param("id"), input: body, request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("periods", "period", period.id, "updated"));
    return c.json({ period });
  } catch (error) {
    return periodFailure(error);
  }
});

periodRoutes.post("/:id/activate", requirePermission("period:activate"), async (c) => {
  const db = c.get("db");
  const actor = c.get("actor");
  if (db === undefined || actor === undefined) throw notFound();

  try {
    const result = await activatePeriod(db, { actor, id: c.req.param("id"), request: requestFacts(c) });
    await publishRealtimeEvent(c, createRealtimeEvent("periods", "period", result.activated.id, "activated"));
    // Both sides are returned: the caller should be able to see which period they just replaced, because
    // this single call changed what every scoped query in the system returns.
    return c.json({ period: result.activated, replaced: result.deactivated });
  } catch (error) {
    return periodFailure(error);
  }
});
