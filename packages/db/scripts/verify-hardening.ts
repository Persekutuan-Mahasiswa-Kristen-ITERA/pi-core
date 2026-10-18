/**
 * Story 7.1 — Security Hardening Verification Script.
 *
 * Verifies non-negotiable security rules from SECURITY.md against the live staging environment
 * and PostgreSQL database:
 *
 * 1. Security headers on web and API staging workers (NFR-10).
 * 2. Request body size limits on API (NFR-11).
 * 3. PostgreSQL Row Level Security (RLS) enabled on 100% of public tables with 0 public policies (NFR-7).
 * 4. Audit log append-only trigger protection against UPDATE and DELETE (NFR-14).
 * 5. Recursive sensitive data redaction (NFR-6).
 * 6. Protection of the last remaining super_admin against accidental deletion (NFR-4).
 *
 * Usage:
 *   DIRECT_URL=… pnpm --filter @pi-core/db exec tsx scripts/verify-hardening.ts
 */
import { redactForAudit } from "@pi-core/shared";
import { sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { auditLogs, systemGrants } from "../src/schema";

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
    `  ${ok ? "PASS" : "FAIL"}  ${label}${
      ok
        ? ""
        : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`
    }`,
  );
}

async function run(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  PI-CORE Security Hardening Verification (Story 7.1)");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── 1. Database RLS Posture ──────────────────────────────────────────────────
  console.log("Section 1: Database Row Level Security (NFR-7)");

  const tablesResult = await db.execute<{ tablename: string; rowsecurity: boolean }>(
    sql`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`,
  );
  const tables = tablesResult.rows;
  const nonRlsTables = tables.filter((t) => !t.rowsecurity);
  check("RLS enabled on every public table", nonRlsTables.length, 0);
  check("Catalog contains expected minimum table count (>= 20)", tables.length >= 20, true);

  const policiesResult = await db.execute<{ count: number }>(
    sql`SELECT count(*)::int as count FROM pg_policies WHERE schemaname = 'public';`,
  );
  check("Zero public policies in pg_policies (Supabase Data API returns 0 rows)", policiesResult.rows[0]?.count, 0);

  // ── 2. Audit Log Append-Only Protection ─────────────────────────────────────
  console.log("\nSection 2: Audit Log Immutability (NFR-14)");

  // Insert a test audit row
  const testAuditId = crypto.randomUUID();
  await db.insert(auditLogs).values({
    id: testAuditId,
    action: "hardening_check",
    entityType: "system",
    entityId: "test",
    actorMemberId: null,
    before: null,
    after: { test: true },
    requestId: "hardening-check",
  });

  // Attempt UPDATE on audit_logs
  let updateRefused = false;
  try {
    await db.execute(sql`UPDATE "audit_logs" SET "action" = 'tampered' WHERE "id" = ${testAuditId};`);
  } catch {
    updateRefused = true;
  }
  check("Audit log trigger refuses UPDATE for any role", updateRefused, true);

  // Attempt DELETE on audit_logs
  let deleteRefused = false;
  try {
    await db.execute(sql`DELETE FROM "audit_logs" WHERE "id" = ${testAuditId};`);
  } catch {
    deleteRefused = true;
  }
  check("Audit log trigger refuses DELETE for any role", deleteRefused, true);

  // ── 3. Data Protection & Redaction ──────────────────────────────────────────
  console.log("\nSection 3: Sensitive Data Redaction (NFR-6)");

  interface PiiPayload {
    nim: string;
    phone: string;
    name: string;
    tokens: { access_token: string; id_token: string };
    nestedArray: Array<{ password_hash: string; email: string }>;
  }

  const payloadWithPii: PiiPayload = {
    nim: "124140031",
    phone: "081234567890",
    name: "Febrian Yoel",
    tokens: {
      access_token: "secret-token",
      id_token: "secret-id",
    },
    nestedArray: [{ password_hash: "hash123", email: "febrian@student.itera.ac.id" }],
  };
  const redacted = redactForAudit(payloadWithPii) as unknown as PiiPayload;
  check("Redaction strips NIM", redacted.nim, "[redacted]");
  check("Redaction strips phone", redacted.phone, "[redacted]");
  check("Redaction strips nested tokens", redacted.tokens.access_token, "[redacted]");
  check("Redaction strips nested array passwords", redacted.nestedArray[0]?.password_hash, "[redacted]");
  check("Redaction preserves non-sensitive fields", redacted.name, "Febrian Yoel");

  // ── 4. Web Staging Security Headers ─────────────────────────────────────────
  console.log("\nSection 4: Web Security Headers on Staging (NFR-10)");

  try {
    const webRes = await fetch("https://pi-core-web-staging.pmkitera.workers.dev/");
    check("Web staging responds HTTP 200", webRes.status, 200);
    check("Web includes Strict-Transport-Security", webRes.headers.get("strict-transport-security")?.includes("max-age=31536000"), true);
    check("Web includes nosniff", webRes.headers.get("x-content-type-options"), "nosniff");
    check("Web includes frame-ancestors none in CSP", webRes.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"), true);
    check("Web includes X-Frame-Options DENY", webRes.headers.get("x-frame-options"), "DENY");
    check("Web removes X-Powered-By header", webRes.headers.get("x-powered-by"), null);
  } catch (err) {
    console.error("  FAIL  Web fetch failed:", err);
    failed += 1;
  }

  // ── 5. API Staging Security Headers & Limits ────────────────────────────────
  console.log("\nSection 5: API Security Headers & Request Limits on Staging (NFR-10, NFR-11)");

  try {
    const apiRes = await fetch("https://pi-core-api-staging.pmkitera.workers.dev/api/v1/health");
    check("API staging responds HTTP 200", apiRes.status, 200);
    check("API includes Strict-Transport-Security", apiRes.headers.get("strict-transport-security")?.includes("max-age=31536000"), true);
    check("API includes nosniff", apiRes.headers.get("x-content-type-options"), "nosniff");
    check("API includes CSP default-src 'none'", apiRes.headers.get("content-security-policy")?.includes("default-src 'none'"), true);
    check("API includes X-Frame-Options DENY", apiRes.headers.get("x-frame-options"), "DENY");
    check("API includes correlation X-Request-Id", Boolean(apiRes.headers.get("x-request-id")), true);

    // Test payload size limit on staging (> 1 MiB)
    const oversizedBody = "x".repeat(1024 * 1024 + 100);
    const payloadRes = await fetch("https://pi-core-api-staging.pmkitera.workers.dev/api/v1/health", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: oversizedBody,
    });
    check("API rejects oversized payload with HTTP 413", payloadRes.status, 413);
    const errorJson = (await payloadRes.json()) as { error?: { code?: string } };
    check("API returns uniform payload_too_large code", errorJson.error?.code, "payload_too_large");
  } catch (err) {
    console.error("  FAIL  API fetch failed:", err);
    failed += 1;
  }

  // ── 6. Super Admin Protection ───────────────────────────────────────────────
  console.log("\nSection 6: Super Admin Protection (NFR-4)");

  const superAdmins = await db.select().from(systemGrants).where(sql`${systemGrants.roleKey} = 'super_admin'`);
  if (superAdmins.length === 1 && superAdmins[0]) {
    let deleteRefused = false;
    try {
      await db.delete(systemGrants).where(sql`${systemGrants.id} = ${superAdmins[0].id}`);
    } catch {
      deleteRefused = true;
    }
    check("Sole super_admin protected by trigger against deletion", deleteRefused, true);
  } else {
    console.log(`  INFO  Found ${superAdmins.length} super_admins; trigger test skipped to preserve state.`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  Summary: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════\n");

  await pool.end();
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
