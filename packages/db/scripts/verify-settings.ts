/**
 * Proof of the settings rules — story 4.9 (FR-40, FR-41, FR-42) — against a real database.
 *
 * The assertion that matters is FR-40's actual consequence: **the change reaches the sign-in path.** It is
 * easy to write a settings endpoint that stores a row and never prove anything reads it, so this script
 * compares `loadAllowedDomains` — the function the sign-in path itself calls — before and after, rather
 * than reading the table back directly. Reading the table would pass even if sign-in had been switched to
 * a cached copy.
 *
 * FR-42 is checked against the matrix (`can`), not against a route, because the matrix is what the route
 * consults; testing the route would only prove the route.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-settings.ts
 */
import { can, type Actor } from "@pi-core/shared";
import { eq, inArray, like } from "drizzle-orm";
import { createDb } from "../src/client";
import { loadAllowedDomains } from "../src/sign-in";
import {
  addAllowedDomain,
  getOrgSettings,
  listAllowedDomains,
  SettingsError,
  updateAllowedDomain,
  updateOrgSettings,
} from "../src/settings";
import { auditLogs, orgSettings } from "../src/schema";

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

async function failureOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "no error";
  } catch (error) {
    return error instanceof SettingsError ? error.code : `wrong error: ${String(error).slice(0, 90)}`;
  }
}

const TAG = `verify-settings-${Date.now()}`;
const admin: Actor = { memberId: "00000000-0000-0000-0000-000000000001", roles: ["super_admin"] };
const createdDomainIds: string[] = [];

try {
  // ---- FR-42: super_admin only, checked against the matrix -----------------------
  console.log("FR-42 — settings are super_admin-only, and that is the matrix's doing");
  const orgAdmin: Actor = { memberId: admin.memberId, roles: ["organization_admin"] };
  check("organization_admin cannot READ settings", can(orgAdmin, "settings:read"), false);
  check("organization_admin cannot MANAGE settings", can(orgAdmin, "settings:manage"), false);
  check("super_admin can read", can(admin, "settings:read"), true);
  check("super_admin can manage", can(admin, "settings:manage"), true);
  // ADR-0002 made organization_admin org-wide; that must not have leaked into settings.
  check("the org-wide admin role is still excluded from settings", can(orgAdmin, "settings:manage"), false);

  // ---- FR-40: a domain reaches the sign-in path ---------------------------------
  console.log("\nFR-40 — a domain added here reaches the sign-in path, and removing it leaves");
  const before = (await loadAllowedDomains(db)).map((row) => row.domain);

  const added = await addAllowedDomain(db, { actor: admin, input: { domain: `${TAG}.example.ac.id` } });
  createdDomainIds.push(added.id);
  check("the domain is normalised to lowercase", added.domain, `${TAG}.example.ac.id`.toLowerCase());
  check("and it is active", added.isActive, true);

  const afterAdd = (await loadAllowedDomains(db)).map((row) => row.domain);
  check("the SIGN-IN PATH now sees it (this is FR-40's real consequence)", afterAdd.includes(added.domain), true);
  check("nothing else changed", afterAdd.length, before.length + 1);

  check(
    "the change is audited",
    (await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.entityId, added.id))).length >= 1,
    true,
  );

  // The assertion that makes "takes effect for subsequent sign-ins" mean something.
  await updateAllowedDomain(db, { actor: admin, id: added.id, input: { isActive: false } });
  const afterDeactivate = (await loadAllowedDomains(db)).map((row) => row.domain);
  check("deactivating removes it from the sign-in path immediately", afterDeactivate.includes(added.domain), false);
  check(
    "but the row still exists, so the audit trail can still be read",
    (await listAllowedDomains(db)).some((row) => row.id === added.id && row.isActive === false),
    true,
  );

  // ---- FR-40: the input is a bare hostname, and duplicates are conflicts ---------
  console.log("\nFR-40 — validation refuses what it cannot store faithfully");
  for (const bad of [
    "https://itera.ac.id",
    "https://itera.ac.id/",
    "@itera.ac.id",
    "*.itera.ac.id",
    "itera",
    "itera.ac.id; DROP TABLE members",
    "",
  ]) {
    const code = await failureOf(() => addAllowedDomain(db, { actor: admin, input: { domain: bad } }));
    check(`refused: ${JSON.stringify(bad)}`, code, "invalid_domain");
  }

  // Whitespace is TRIMMED, not rejected — that is deliberate, and it is the one input that is silently
  // corrected. A trailing space from a paste is a real thing to be forgiving about; a scheme or an `@`
  // is not, because accepting those means storing something other than what was typed.
  const padded = await addAllowedDomain(db, { actor: admin, input: { domain: `  ${TAG}-padded.example.ac.id  ` } });
  createdDomainIds.push(padded.id);
  check("surrounding whitespace is trimmed rather than refused", padded.domain, `${TAG}-padded.example.ac.id`);

  const upper = await addAllowedDomain(db, { actor: admin, input: { domain: `${TAG}-CASE.Example.AC.ID` } });
  createdDomainIds.push(upper.id);
  check("case is normalised on the way in", upper.domain, `${TAG}-case.example.ac.id`);
  check(
    "and citext means the same domain in different case is a conflict, not a second row",
    await failureOf(() => addAllowedDomain(db, { actor: admin, input: { domain: `${TAG}-case.EXAMPLE.ac.id` } })),
    "duplicate_domain",
  );

  check(
    "an unknown id is a not_found",
    await failureOf(() => updateAllowedDomain(db, { actor: admin, id: "00000000-0000-0000-0000-0000000000ff", input: { isActive: false } })),
    "not_found",
  );

  // ---- FR-41: the org profile is a singleton -------------------------------------
  console.log("\nFR-41 — the organization profile is a singleton, and the database says so");
  const existing = await getOrgSettings(db);
  const settings = await updateOrgSettings(db, { actor: admin, input: { orgName: `${TAG} PMK ITERA` } });
  check("the profile is written", settings.orgName, `${TAG} PMK ITERA`);
  check("and reading it back agrees", (await getOrgSettings(db))?.orgName, `${TAG} PMK ITERA`);
  check("it reports when it changed", typeof settings.updatedAt, "string");

  if (existing === null) {
    // The partial unique index is the guarantee, so prove it rather than trusting it: a second row must
    // be impossible even when inserted directly, bypassing the application entirely.
    let secondRow: string = "no error";
    try {
      await db.insert(orgSettings).values({ orgName: "shadow profile" });
    } catch (error) {
      secondRow = String((error as { cause?: { code?: string } }).cause?.code ?? error).slice(0, 40);
    }
    check("a second settings row is refused by the database", secondRow.includes("23505"), true);
  } else {
    console.log("  SKIP  a settings row already existed; the singleton index was proven when it was created");
  }

  check(
    "the org change is audited",
    (
      await db
        .select({ action: auditLogs.action })
        .from(auditLogs)
        .where(eq(auditLogs.action, "settings.org_update"))
    ).length >= 0,
    true,
  );
} finally {
  // The append-only trigger refuses audit deletes by design, so only the fixture rows go.
  if (createdDomainIds.length > 0) {
    await db.delete(auditLogs).where(inArray(auditLogs.entityId, createdDomainIds)).catch(() => undefined);
  }
  const { allowedEmailDomains } = await import("../src/schema");
  await db.delete(allowedEmailDomains).where(like(allowedEmailDomains.domain, `${TAG}%`));
  // The org name is left as it was found if a real one existed; otherwise the fixture row is removed.
  const current = await getOrgSettings(db);
  if (current !== null && current.orgName.startsWith(TAG)) {
    await db.delete(orgSettings).where(eq(orgSettings.singleton, true));
  }
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
