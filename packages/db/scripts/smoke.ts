/**
 * Local smoke test for `@pi-core/db`.
 *
 * Proves the Drizzle client works over a real Postgres, that `citext` email uniqueness is
 * case-insensitive, and that the org-unit uniqueness rules hold. Run against a throwaway DB:
 *
 *   DIRECT_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/picore \
 *     pnpm --filter @pi-core/db db:smoke
 */
import { eq } from "drizzle-orm";
import { createDb } from "../src/client";
import { members, orgUnits } from "../src/schema";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) {
  console.error("DIRECT_DATABASE_URL is required");
  process.exit(1);
}

const { db, pool } = createDb(url);
let failures = 0;

function check(name: string, ok: boolean): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures += 1;
}

async function rejects(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

const stamp = Date.now();
const email = `smoke+${stamp}@itera.ac.id`;

try {
  // 1. write + read back through the client
  const inserted = await db.insert(members).values({ email, fullName: "Smoke Test" }).returning();
  check("insert member + returning", inserted[0]?.id !== undefined);

  // 2. citext: lookup is case-insensitive
  const found = await db.select().from(members).where(eq(members.email, email.toUpperCase()));
  check("citext lookup is case-insensitive", found.length === 1);

  // 3. citext: duplicate email rejected even with different casing
  check(
    "duplicate email rejected case-insensitively",
    await rejects(() => db.insert(members).values({ email: email.toUpperCase(), fullName: "Dup" })),
  );

  // 4. org tree uniqueness
  const root = (
    await db
      .insert(orgUnits)
      .values({ type: "organization", name: "Smoke Root", slug: `root-${stamp}` })
      .returning()
  )[0]!;
  check(
    "duplicate root slug rejected (partial unique index)",
    await rejects(() =>
      db.insert(orgUnits).values({ type: "organization", name: "Root Dup", slug: root.slug }),
    ),
  );

  const dept = (
    await db
      .insert(orgUnits)
      .values({ parentId: root.id, type: "department", name: "Dept A", slug: "dept-a" })
      .returning()
  )[0]!;
  check(
    "duplicate slug within the same parent rejected",
    await rejects(() =>
      db.insert(orgUnits).values({ parentId: root.id, type: "department", name: "Dept A2", slug: "dept-a" }),
    ),
  );

  const other = (
    await db
      .insert(orgUnits)
      .values({ parentId: root.id, type: "department", name: "Dept B", slug: "dept-b" })
      .returning()
  )[0]!;
  const nested = await db
    .insert(orgUnits)
    .values({ parentId: other.id, type: "division", name: "Div", slug: "dept-a" })
    .returning();
  check("same slug under a different parent allowed", nested[0]?.id !== undefined);

  // 5. parent with children cannot be deleted
  check(
    "parent with children cannot be deleted (on delete restrict)",
    await rejects(() => db.delete(orgUnits).where(eq(orgUnits.id, root.id))),
  );

  // cleanup (leaf first — the FK is restrictive)
  await db.delete(members).where(eq(members.email, email));
  await db.delete(orgUnits).where(eq(orgUnits.parentId, other.id));
  await db.delete(orgUnits).where(eq(orgUnits.parentId, dept.id));
  await db.delete(orgUnits).where(eq(orgUnits.id, other.id));
  await db.delete(orgUnits).where(eq(orgUnits.id, dept.id));
  await db.delete(orgUnits).where(eq(orgUnits.id, root.id));
} finally {
  await pool.end();
}

console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
