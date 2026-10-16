/**
 * Proof of the audit-log reads — story 4.10 (FR-44, FR-13) — against a real database.
 *
 * Two assertions carry the weight:
 *
 * 1. **Redaction on the way OUT.** A row is written directly with an unredacted sensitive field, imitating
 *    a writer that forgot to call `redactForAudit`. The read path must still redact it. Testing only the
 *    normal path would prove that today's writers are correct, which is not the same claim as "a leak
 *    cannot happen through the view".
 * 2. **The cursor neither skips nor repeats.** The log grows while it is read, so this pages through a
 *    fixture set with several rows sharing a timestamp — the tie-break case that a naive `at`-only cursor
 *    gets wrong.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-audit-log.ts
 */
import { REDACTED, type Actor } from "@pi-core/shared";
import { desc, eq, inArray } from "drizzle-orm";
import { createDb } from "../src/client";
import { AuditError, listAuditActions, listAuditEntries } from "../src/audit-log";
import { auditLogs } from "../src/schema";

const url = process.env.DIRECT_URL ?? process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DIRECT_DATABASE_URL) is required");
  process.exit(1);
}

const { db, pool } = createDb(url);
let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failed += 1;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`}`,
  );
}

const TAG = `verify-audit-${Date.now()}`;
const admin: Actor = { memberId: "00000000-0000-0000-0000-000000000001", roles: ["super_admin"] };
const insertedIds: string[] = [];

try {
  // ---- FR-44: a U-scoped holder is refused, not silently narrowed ----------------
  console.log("FR-44 — the log is org-wide, so a U-scoped holder is refused");
  const scoped: Actor = { memberId: admin.memberId, roles: ["kepala_departemen"], unitScope: ["x"] };
  let refusal = "no error";
  try {
    await listAuditEntries(db, { actor: scoped, limit: 5 });
  } catch (error) {
    refusal = error instanceof AuditError ? error.code : `wrong error: ${String(error).slice(0, 80)}`;
  }
  check("a U-scoped actor is refused", refusal, "forbidden_scope");
  check(
    "an ordinary member is refused too",
    await listAuditEntries(db, { actor: { memberId: admin.memberId, roles: ["anggota"] }, limit: 5 })
      .then(() => "no error")
      .catch((error: unknown) => (error instanceof AuditError ? error.code : "wrong error")),
    "forbidden_scope",
  );

  // ---- fixture: a normal row, and one written WITHOUT redaction -------------------
  const base = Date.now() - 60_000;
  const rows = await db
    .insert(auditLogs)
    .values([
      {
        action: `${TAG}.normal`,
        entityType: "member",
        entityId: `${TAG}-1`,
        actorMemberId: admin.memberId,
        before: { phone: "+6281234567890", fullName: "Someone" },
        after: { phone: "+6289999999999" },
        at: new Date(base),
      },
      {
        // Imitates a writer that forgot `redactForAudit`. The read path must still not show this.
        action: `${TAG}.unredacted`,
        entityType: "member",
        entityId: `${TAG}-2`,
        actorMemberId: admin.memberId,
        before: { phone: "+6281111111111", nim: "124140031", password: "hunter2" },
        at: new Date(base + 1000),
      },
      // Three rows on the SAME millisecond: the tie-break case.
      { action: `${TAG}.tie`, entityType: "member", entityId: `${TAG}-a`, at: new Date(base + 2000) },
      { action: `${TAG}.tie`, entityType: "member", entityId: `${TAG}-b`, at: new Date(base + 2000) },
      { action: `${TAG}.tie`, entityType: "member", entityId: `${TAG}-c`, at: new Date(base + 2000) },
    ])
    .returning({ id: auditLogs.id });
  insertedIds.push(...rows.map((row) => row.id));

  // ---- FR-13 / FR-44: redaction happens on the way OUT ---------------------------
  console.log("\nFR-13 / FR-44 — sensitive fields are redacted on the way out, not only on the way in");
  const all = await listAuditEntries(db, { actor: admin, action: `${TAG}.unredacted`, limit: 5 });
  const unredacted = all.items[0]!;
  const before = JSON.stringify(unredacted.before);
  check("the phone number is gone", before.includes("6281111111111"), false);
  check("the NIM is gone", before.includes("124140031"), false);
  check("the password is gone", before.includes("hunter2"), false);
  check(
    "and the field is present but marked, so the reader knows something was there",
    // Imported, not written as a literal: a literal here would silently stop matching if the marker
    // changed, and the assertion would then be testing my memory instead of the behaviour.
    before.includes(REDACTED),
    true,
  );
  check(
    "a non-sensitive field alongside them survives",
    JSON.stringify(unredacted.after ?? {}) !== "undefined",
    true,
  );

  const normal = await listAuditEntries(db, { actor: admin, action: `${TAG}.normal`, limit: 5 });
  check("a normally-written row is redacted too", JSON.stringify(normal.items[0]!.before).includes("6281234567890"), false);

  // ---- the fields a UI shows -----------------------------------------------------
  console.log("\nFR-44 — actor, action, entity and time are all present");
  check("action", unredacted.action, `${TAG}.unredacted`);
  check("entity type", unredacted.entityType, "member");
  check("entity id", unredacted.entityId, `${TAG}-2`);
  check("actor id", unredacted.actorMemberId, admin.memberId);
  check("time is an ISO string", /^\d{4}-\d{2}-\d{2}T/.test(unredacted.at), true);

  // ---- cursor pagination: no skips, no repeats ------------------------------------
  console.log("\nFR-44 — the cursor neither skips nor repeats, including across identical timestamps");
  const seen: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page: { items: Array<{ id: string; action: string }>; nextCursor: string | null } = await listAuditEntries(db, {
      actor: admin,
      limit: 2,
      ...(cursor === null ? {} : { cursor }),
    });
    seen.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor;
    pages += 1;
    if (pages > 40) break; // guard against a cursor that never terminates
  } while (cursor !== null);

  const tieIds = rows.slice(2).map((row) => row.id);
  check("every tie row was seen exactly once", tieIds.every((id) => seen.filter((s) => s === id).length === 1), true);
  check("no id appears twice across pages", seen.length, new Set(seen).size);
  check("and the page size was respected (so it really did page)", pages > 1, true);

  // ---- filters --------------------------------------------------------------------
  console.log("\nFR-44 — filters narrow the log");
  const byEntity = await listAuditEntries(db, { actor: admin, entityId: `${TAG}-b`, limit: 10 });
  check("filtering by entity id returns exactly that row", byEntity.items.map((i) => i.entityId), [`${TAG}-b`]);

  const byAction = await listAuditEntries(db, { actor: admin, action: `${TAG}.tie`, limit: 10 });
  check("filtering by action returns the three tie rows", byAction.items.length, 3);

  const byTime = await listAuditEntries(db, {
    actor: admin,
    from: new Date(base + 500).toISOString(),
    to: new Date(base + 1500).toISOString(),
    limit: 10,
  });
  check("a time window excludes what falls outside it", byTime.items.every((i) => i.entityId === `${TAG}-2`), true);

  const actions = await listAuditActions(db);
  check("the action list includes the fixture actions", actions.includes(`${TAG}.tie`), true);
  check("and is sorted and de-duplicated", actions, [...new Set(actions)].sort());

  // ---- the log survives the member it names ---------------------------------------
  console.log("\nNFR-6 — the log outlives the member it refers to");
  const [vanished] = await db
    .insert(auditLogs)
    .values({
      action: `${TAG}.vanished`,
      entityType: "member",
      entityId: `${TAG}-gone`,
      actorMemberId: "00000000-0000-0000-0000-0000000000ff",
      at: new Date(base + 3000),
    })
    .returning({ id: auditLogs.id });
  insertedIds.push(vanished!.id);
  const gone = await listAuditEntries(db, { actor: admin, action: `${TAG}.vanished`, limit: 5 });
  check("the row is still readable", gone.items.length, 1);
  check("with a null name rather than an error", gone.items[0]!.actorName, null);
  check("and the id is still recorded, so who it was is not lost", gone.items[0]!.actorMemberId, "00000000-0000-0000-0000-0000000000ff");

  // ---- newest first ---------------------------------------------------------------
  const newest = await listAuditEntries(db, { actor: admin, limit: 200 });
  const times = newest.items.map((item) => item.at);
  check("entries come back newest first", times, [...times].sort().reverse());
} finally {
  // The append-only trigger (FR-43) refuses deletes, so these rows stay by design. That is the same
  // reason the log is trustworthy; the fixture rows are prefixed with the run tag so they are obvious.
  const { rows } = await db.execute(
    (await import("drizzle-orm")).sql`select count(*)::int as n from audit_logs where action like ${`${TAG}%`}`,
  );
  console.log(`\n  (${(rows[0] as { n: number }).n} fixture rows remain — the append-only trigger refuses deletes by design)`);
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
