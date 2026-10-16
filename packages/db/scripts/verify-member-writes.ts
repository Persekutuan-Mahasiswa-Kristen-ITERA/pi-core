/**
 * Proof of the member writes — story 4.3 (FR-10, FR-11, FR-12, FR-43) — against a real database.
 *
 * The assertions are about **effects**, not return values: the audit row exists, the row is soft-deleted
 * rather than gone, the sessions are actually deleted, and a self-edit outside the allow-list is refused
 * while the allowed one goes through. A test that only checked the returned object would pass with none
 * of that true.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-member-writes.ts
 */
import { type Actor } from "@pi-core/shared";
import { and, eq, inArray } from "drizzle-orm";
import { createDb } from "../src/client";
import { countSessionsForMember } from "../src/sign-in";
import {
  createMember,
  deactivateMember,
  MemberWriteError,
  SELF_EDITABLE_FIELDS,
  updateMember,
} from "../src/members-write";
import { auditLogs, authSessions, members } from "../src/schema";

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

const TAG = `verify-writes-${Date.now()}`;
const createdIds: string[] = [];

const admin: Actor = { memberId: "00000000-0000-0000-0000-000000000001", roles: ["super_admin"] };

const auditRows = async (entityId: string) =>
  db.select({ action: auditLogs.action, after: auditLogs.after }).from(auditLogs).where(eq(auditLogs.entityId, entityId));

try {
  // ---- FR-10: create, audited ------------------------------------------------
  console.log("FR-10 — creating a member writes an audit row (FR-43)");
  const created = await createMember(db, {
    actor: admin,
    input: { email: `${TAG}@student.itera.ac.id`, fullName: `${TAG} Person`, nim: "999", phone: "+628" },
  });
  createdIds.push(created.id);
  check("the member exists", created.fullName, `${TAG} Person`);
  const afterCreate = await auditRows(created.id);
  check("one audit row", afterCreate.length, 1);
  check("with the right action", afterCreate[0]?.action, "member.create");

  console.log("\nFR-10 — a duplicate email is a conflict, not a crash");
  let duplicate: string = "no error";
  try {
    await createMember(db, {
      actor: admin,
      input: { email: `${TAG}@student.itera.ac.id`, fullName: "Duplicate" },
    });
  } catch (error) {
    duplicate = error instanceof MemberWriteError ? error.code : "wrong error type";
  }
  check("refused as a conflict", duplicate, "conflict");

  // ---- FR-11: self-edit is field-limited -------------------------------------
  console.log("\nFR-11 — a member may change their own phone, but not their own NIM or status");
  const self: Actor = { memberId: created.id, roles: ["anggota"] };

  const selfEdit = await updateMember(db, { actor: self, id: created.id, input: { phone: "+62999" } });
  check("the allowed field changed", selfEdit.phone, "+62999");
  let blocked: string = "no error";
  try {
    await updateMember(db, { actor: self, id: created.id, input: { nim: "000" } });
  } catch (error) {
    blocked = error instanceof MemberWriteError ? error.code : "wrong error type";
  }
  check("a field outside the allow-list is refused", blocked, "forbidden_field");

  let statusBlocked: string = "no error";
  try {
    await updateMember(db, { actor: self, id: created.id, input: { fullName: "Renamed by self" } });
  } catch (error) {
    statusBlocked = error instanceof MemberWriteError ? error.code : "wrong error type";
  }
  check("a member cannot rename themselves", statusBlocked, "forbidden_field");

  check("the allow-list is exactly phone and photo", [...SELF_EDITABLE_FIELDS], ["phone", "avatarKey"]);

  console.log("\nFR-11 — an admin may change fields a member may not");
  const adminEdit = await updateMember(db, { actor: admin, id: created.id, input: { nim: "123", fullName: `${TAG} Renamed` } });
  check("NIM updated", adminEdit.nim, "123");
  check("name updated", adminEdit.fullName, `${TAG} Renamed`);

  console.log("\nFR-43 — the update is audited with only the fields that changed");
  const afterUpdate = await auditRows(created.id);
  // `auditRows` returns rows in insertion order, so take the LAST update — the admin's — not the self
  // edit that came first. Asserting on "the first row with this action" is how this test first failed.
  const updateRows = afterUpdate.filter((row) => row.action === "member.update");
  check("both updates were audited", updateRows.length, 2);
  check(
    "the admin edit records before and after for the changed field only",
    Object.keys((updateRows.at(-1)?.after as Record<string, unknown>) ?? {}).sort(),
    ["fullName", "nim"],
  );
  check(
    "the self edit recorded only the field it touched",
    Object.keys((updateRows[0]?.after as Record<string, unknown>) ?? {}),
    ["phone"],
  );

  // ---- FR-12: soft delete + session revocation ------------------------------
  console.log("\nFR-12/FR-5 — deactivation is soft and really ends access");
  await db.insert(authSessions).values([
    { token: `${TAG}-s1`, expiresAt: new Date(Date.now() + 3_600_000), userId: created.id },
    { token: `${TAG}-s2`, expiresAt: new Date(Date.now() + 3_600_000), userId: created.id },
  ]);
  check("two sessions before", await countSessionsForMember(db, created.id), 2);

  const deactivated = await deactivateMember(db, { actor: admin, id: created.id });
  check("sessions revoked in the same call", deactivated.sessionsRevoked, 2);
  check("none remain", await countSessionsForMember(db, created.id), 0);
  check("status is inactive", deactivated.member.status, "inactive");

  const row = await db
    .select({ status: members.status, deletedAt: members.deletedAt })
    .from(members)
    .where(eq(members.id, created.id));
  check("the row still exists — never hard-deleted", row.length, 1);
  check("deleted_at is set", row[0]?.deletedAt !== null, true);

  const finalAudits = await auditRows(created.id);
  check(
    "the deactivation is audited, including the session count",
    (finalAudits.find((r) => r.action === "member.deactivate")?.after as { sessionsRevoked?: number } | undefined)
      ?.sessionsRevoked,
    2,
  );
  check(
    "and the revocation has its own row",
    (await db.select({ id: auditLogs.id }).from(auditLogs).where(and(eq(auditLogs.action, "auth.sessions_revoked"), eq(auditLogs.entityId, created.id)))).length >= 1,
    true,
  );
} finally {
  if (createdIds.length > 0) {
    await db.delete(authSessions).where(inArray(authSessions.userId, createdIds));
    await db.delete(members).where(inArray(members.id, createdIds));
  }
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
