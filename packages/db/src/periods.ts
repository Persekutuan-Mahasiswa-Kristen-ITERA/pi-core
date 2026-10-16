/**
 * Periods — story 4.6 (FR-19, FR-20, FR-21, FR-22, FR-43).
 *
 * The interesting part is activation. FR-20 says at most one period is active, enforced by a **partial
 * unique index**, and FR-21 says activating one deactivates the previous in a **single transaction**.
 *
 * Those two requirements have to be satisfied together, and the order matters: deactivate-then-activate
 * inside one transaction. Activating first would momentarily violate the index, and doing the two
 * statements outside a transaction would leave a window with **no** active period — during which every
 * `U`-scoped query would silently return nothing, because access derives from the active period's
 * assignments.
 *
 * Access is derived, never stored: nothing here grants or revokes anything directly. Activating a period
 * changes what every subsequent `loadActor` call sees, which is why the audit row matters — it is the
 * record of the moment everyone's access changed.
 */
import type { Actor } from "@pi-core/shared";
import { asc, eq } from "drizzle-orm";
import { writeAudit, type AuthorizationRequest } from "./access";
import type { Database } from "./client";
import { periods } from "./schema";

export interface PeriodRow {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface PeriodInput {
  label?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

/** A new period needs everything. `Required<PeriodInput>` does not express that under
 * `exactOptionalPropertyTypes` — it keeps the `| undefined`. */
export interface NewPeriodInput {
  label: string;
  startDate: string;
  endDate: string;
}

export class PeriodError extends Error {
  constructor(readonly code: "conflict" | "not_found" | "invalid_range") {
    super(code);
    this.name = "PeriodError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current !== null && current !== undefined; depth += 1) {
    if (typeof current === "object" && "code" in current && (current as { code?: unknown }).code === "23505") {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function listPeriods(db: Database): Promise<PeriodRow[]> {
  return db
    .select({
      id: periods.id,
      label: periods.label,
      startDate: periods.startDate,
      endDate: periods.endDate,
      isActive: periods.isActive,
    })
    .from(periods)
    .orderBy(asc(periods.startDate));
}

export async function createPeriod(
  db: Database,
  params: { actor: Actor; input: NewPeriodInput; request?: AuthorizationRequest },
): Promise<PeriodRow> {
  if (params.input.endDate < params.input.startDate) throw new PeriodError("invalid_range");

  let created: { id: string } | undefined;
  try {
    const rows = await db
      .insert(periods)
      .values({
        label: params.input.label,
        startDate: params.input.startDate,
        endDate: params.input.endDate,
        // A new period is never active on creation. Activation is a separate, audited decision (FR-21) —
        // creating a period must not silently change everyone's access.
        isActive: false,
      })
      .returning({ id: periods.id });
    created = rows[0];
  } catch (error) {
    if (isUniqueViolation(error)) throw new PeriodError("conflict");
    throw error;
  }

  const period = (await listPeriods(db)).find((row) => row.id === created?.id);
  if (period === undefined) throw new PeriodError("not_found");

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "period.create",
    entityType: "period",
    entityId: period.id,
    after: { label: period.label, startDate: period.startDate, endDate: period.endDate },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return period;
}

export async function updatePeriod(
  db: Database,
  params: { actor: Actor; id: string; input: PeriodInput; request?: AuthorizationRequest },
): Promise<PeriodRow> {
  const before = (await listPeriods(db)).find((row) => row.id === params.id);
  if (before === undefined) throw new PeriodError("not_found");

  const startDate = params.input.startDate ?? before.startDate;
  const endDate = params.input.endDate ?? before.endDate;
  if (endDate < startDate) throw new PeriodError("invalid_range");

  try {
    await db
      .update(periods)
      .set({ ...params.input, updatedAt: new Date() })
      .where(eq(periods.id, params.id));
  } catch (error) {
    if (isUniqueViolation(error)) throw new PeriodError("conflict");
    throw error;
  }

  const after = (await listPeriods(db)).find((row) => row.id === params.id);
  if (after === undefined) throw new PeriodError("not_found");

  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "period.update",
    entityType: "period",
    entityId: params.id,
    before: { label: before.label, startDate: before.startDate, endDate: before.endDate },
    after: { label: after.label, startDate: after.startDate, endDate: after.endDate },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  return after;
}

export interface ActivationResult {
  activated: PeriodRow;
  deactivated: PeriodRow | null;
}

/**
 * Activate a period: exactly one stays active, in one transaction (FR-20, FR-21).
 *
 * Deactivate first, then activate. The partial unique index only permits one `is_active = true` row, so
 * the other order would violate it mid-transaction; and doing this outside a transaction would leave a
 * window with no active period at all, during which every scoped query returns nothing.
 */
export async function activatePeriod(
  db: Database,
  params: { actor: Actor; id: string; request?: AuthorizationRequest },
): Promise<ActivationResult> {
  const target = (await listPeriods(db)).find((row) => row.id === params.id);
  if (target === undefined) throw new PeriodError("not_found");

  const previouslyActive = (await listPeriods(db)).find((row) => row.isActive && row.id !== params.id) ?? null;

  await db.transaction(async (tx) => {
    await tx.update(periods).set({ isActive: false, updatedAt: new Date() }).where(eq(periods.isActive, true));
    await tx.update(periods).set({ isActive: true, updatedAt: new Date() }).where(eq(periods.id, params.id));
  });

  // One row for the whole event rather than two: what matters is that access moved, and between which
  // periods — not that two updates were issued.
  await writeAudit(db, {
    actorMemberId: params.actor.memberId,
    action: "period.activate",
    entityType: "period",
    entityId: params.id,
    before: previouslyActive === null ? null : { activePeriodId: previouslyActive.id, label: previouslyActive.label },
    after: { activePeriodId: params.id, label: target.label },
    ip: params.request?.ip ?? null,
    userAgent: params.request?.userAgent ?? null,
    requestId: params.request?.requestId ?? null,
  });

  const activated = (await listPeriods(db)).find((row) => row.id === params.id);
  if (activated === undefined) throw new PeriodError("not_found");

  return { activated, deactivated: previouslyActive };
}

/** The active period, or `null` when none is set — which means no assignment confers access. */
export async function findActivePeriod(db: Database): Promise<PeriodRow | null> {
  return (await listPeriods(db)).find((row) => row.isActive) ?? null;
}
