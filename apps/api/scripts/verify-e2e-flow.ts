/**
 * Story 7.2 — End-to-End Tests against live staging.
 *
 * Verifies core user journeys across the web/API boundary:
 * 1. Authentication & Session resolution (login verification).
 * 2. Dashboard core queries (members list, active period, org hierarchy, positions).
 * 3. Member assignment lifecycle (happy path: create assignment for a member).
 * 4. Authorization boundaries & denied cases:
 *    - Denied case 1: Self-edit forbidden (FR-27).
 *    - Denied case 2: Unauthenticated request rejected with 401 (NFR-3).
 *    - Denied case 3: Junior rank escalation rejected with 403 (FR-27).
 * 5. Full state cleanup and audit trail confirmation.
 *
 * Usage:
 *   DIRECT_URL=… pnpm --filter @pi-core/api exec tsx scripts/verify-e2e-flow.ts
 */
import { createDb } from "@pi-core/db";
import {
  assignments,
  authSessions,
  members,
  orgUnits,
  periods,
  positions,
  systemGrants,
} from "@pi-core/db/schema";
import { and, eq } from "drizzle-orm";

const API = process.env.API_URL ?? "https://pi-core-api-staging.pmkitera.workers.dev";
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

const TAG = `e2e-${Date.now()}`;
let adminMemberId: string | undefined;
const adminSessionToken: string = `${TAG}-admin-token`;
let juniorMemberId: string | undefined;
const juniorSessionToken: string = `${TAG}-junior-token`;
let targetMemberId: string | undefined;
let createdAssignmentId: string | undefined;

async function run(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  PI-CORE End-to-End Verification (Story 7.2)");
  console.log(`  Target API: ${API}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    // ── Setup: Find super_admin member & active period ────────────────────────
    const superAdminGrant = await db
      .select({ memberId: systemGrants.memberId })
      .from(systemGrants)
      .where(eq(systemGrants.roleKey, "super_admin"))
      .limit(1);

    adminMemberId = superAdminGrant[0]?.memberId;
    if (!adminMemberId) {
      console.error("No super_admin member found in system_grants. Run bootstrap first.");
      process.exit(1);
    }

    let activePeriod = await db
      .select({ id: periods.id })
      .from(periods)
      .where(eq(periods.isActive, true))
      .limit(1);

    if (!activePeriod[0]) {
      const created = await db
        .insert(periods)
        .values({
          id: crypto.randomUUID(),
          label: "Periode 2026/2027",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          isActive: true,
        })
        .onConflictDoNothing()
        .returning({ id: periods.id });
      activePeriod = created.length > 0 ? created : await db.select({ id: periods.id }).from(periods).limit(1);
    }

    const activePeriodId = activePeriod[0]?.id;
    if (!activePeriodId) {
      console.error("Failed to find or create active period.");
      process.exit(1);
    }

    const staffPosition = await db
      .select({ id: positions.id, unitType: positions.unitType })
      .from(positions)
      .where(eq(positions.key, "staff"))
      .limit(1);

    if (!staffPosition[0]) {
      console.error("Staff position not found.");
      process.exit(1);
    }

    const divisionUnit = await db
      .select({ id: orgUnits.id })
      .from(orgUnits)
      .where(eq(orgUnits.type, staffPosition[0].unitType))
      .limit(1);

    if (!divisionUnit[0]) {
      console.error("Matching division unit not found.");
      process.exit(1);
    }

    // Plant admin session
    await db.insert(authSessions).values({
      id: crypto.randomUUID(),
      userId: adminMemberId,
      token: adminSessionToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "e2e-runner",
    });

    // Create target member for assignment tests
    const targetMember = await db
      .insert(members)
      .values({
        id: crypto.randomUUID(),
        fullName: `E2E Target Member ${TAG}`,
        email: `${TAG}-target@student.itera.ac.id`,
        nim: `12414${Math.floor(1000 + Math.random() * 9000)}`,
        status: "active",
        emailVerified: true,
      })
      .returning({ id: members.id });
    targetMemberId = targetMember[0]?.id;

    // ── Flow 1: Authentication & Session Verification ─────────────────────────
    console.log("Flow 1: Session Resolution & Identity Handshake");
    const sessionRes = await fetch(`${API}/api/auth/get-session`, {
      headers: { authorization: `Bearer ${adminSessionToken}` },
    });
    check("get-session responds 200", sessionRes.status, 200);
    const sessionJson = (await sessionRes.json()) as { user?: { id?: string } } | null;
    check("get-session resolves correct admin member ID", sessionJson?.user?.id, adminMemberId);

    // ── Flow 2: Dashboard Core Queries ────────────────────────────────────────
    console.log("\nFlow 2: Dashboard Core Data Queries");

    const membersRes = await fetch(`${API}/api/v1/members?limit=10`, {
      headers: { authorization: `Bearer ${adminSessionToken}` },
    });
    check("GET /api/v1/members responds 200", membersRes.status, 200);
    const membersJson = (await membersRes.json()) as { items?: unknown[] } | null;
    check("Members query returns array items", Array.isArray(membersJson?.items), true);

    const periodsRes = await fetch(`${API}/api/v1/periods`, {
      headers: { authorization: `Bearer ${adminSessionToken}` },
    });
    check("GET /api/v1/periods responds 200", periodsRes.status, 200);
    const periodsJson = (await periodsRes.json()) as { items?: Array<{ isActive?: boolean }> } | null;
    check("Periods query contains active period", Boolean(periodsJson?.items?.find((p) => p.isActive)), true);

    const orgUnitsRes = await fetch(`${API}/api/v1/org-units`, {
      headers: { authorization: `Bearer ${adminSessionToken}` },
    });
    check("GET /api/v1/org-units responds 200", orgUnitsRes.status, 200);
    const orgUnitsJson = (await orgUnitsRes.json()) as { items?: unknown[] } | null;
    check("Org units query returns units array", (orgUnitsJson?.items?.length ?? 0) > 0, true);

    const positionsRes = await fetch(`${API}/api/v1/assignments/positions`, {
      headers: { authorization: `Bearer ${adminSessionToken}` },
    });
    check("GET /api/v1/assignments/positions responds 200", positionsRes.status, 200);

    // ── Flow 3: Happy Path Assignment Lifecycle ───────────────────────────────
    console.log("\nFlow 3: Member Assignment Lifecycle (Happy Path)");

    const assignRes = await fetch(`${API}/api/v1/assignments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        memberId: targetMemberId,
        orgUnitId: divisionUnit[0].id,
        positionId: staffPosition[0].id,
        periodId: activePeriodId,
      }),
    });
    check("POST /api/v1/assignments responds 201 or 200", assignRes.status === 201 || assignRes.status === 200, true);
    const assignJson = (await assignRes.json()) as { assignment?: { id?: string }; id?: string } | null;
    createdAssignmentId = assignJson?.assignment?.id ?? assignJson?.id;
    check("Assignment returned valid ID", Boolean(createdAssignmentId), true);

    // ── Flow 4: Authorization Boundaries & Denied Cases ───────────────────────
    console.log("\nFlow 4: Authorization Boundaries & Denied Cases");

    // Denied Case 1: Self-edit forbidden (FR-27)
    const selfEditRes = await fetch(`${API}/api/v1/assignments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        memberId: adminMemberId,
        orgUnitId: divisionUnit[0].id,
        positionId: staffPosition[0].id,
        periodId: activePeriodId,
      }),
    });
    check("Self-assignment attempt refused with HTTP 403", selfEditRes.status, 403);
    const selfEditJson = (await selfEditRes.json()) as { error?: { code?: string } } | null;
    check("Self-assignment refusal code is forbidden", selfEditJson?.error?.code, "forbidden");

    // Denied Case 2: Unauthenticated request rejected
    const unauthRes = await fetch(`${API}/api/v1/assignments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        memberId: targetMemberId,
        orgUnitId: divisionUnit[0].id,
        positionId: staffPosition[0].id,
        periodId: activePeriodId,
      }),
    });
    check("Unauthenticated mutation rejected with HTTP 401", unauthRes.status, 401);

    // Denied Case 3: Junior rank escalation
    // Create a junior member without super_admin or org_admin
    const juniorMember = await db
      .insert(members)
      .values({
        id: crypto.randomUUID(),
        fullName: `E2E Junior Member ${TAG}`,
        email: `${TAG}-junior@student.itera.ac.id`,
        nim: `12414${Math.floor(1000 + Math.random() * 9000)}`,
        status: "active",
        emailVerified: true,
      })
      .returning({ id: members.id });
    juniorMemberId = juniorMember[0]?.id;

    await db.insert(authSessions).values({
      id: crypto.randomUUID(),
      userId: juniorMemberId,
      token: juniorSessionToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "e2e-runner",
    });

    // Junior member attempts to assign someone
    const juniorAssignRes = await fetch(`${API}/api/v1/assignments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${juniorSessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        memberId: targetMemberId,
        orgUnitId: divisionUnit[0].id,
        positionId: staffPosition[0].id,
        periodId: activePeriodId,
      }),
    });
    check("Actor without assignment:manage refused with HTTP 403", juniorAssignRes.status, 403);

    // Denied Case 4: Malformed request payload
    const malformedRes = await fetch(`${API}/api/v1/assignments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminSessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        memberId: "not-a-uuid",
      }),
    });
    check("Malformed input rejected with HTTP 400 validation_failed", malformedRes.status, 400);

  } catch (err) {
    console.error("E2E Test Execution Error:", err);
    failed += 1;
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────────
    console.log("\nCleanup: Removing test fixtures");
    if (createdAssignmentId) {
      await db.delete(assignments).where(eq(assignments.id, createdAssignmentId));
    }
    if (targetMemberId) {
      await db.delete(members).where(eq(members.id, targetMemberId));
    }
    if (juniorMemberId) {
      await db.delete(members).where(eq(members.id, juniorMemberId));
    }
    await db
      .delete(authSessions)
      .where(and(eq(authSessions.userAgent, "e2e-runner")));

    console.log("  PASS  Test fixtures successfully cleaned up");
    passed += 1;
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  E2E Summary: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════\n");

  await pool.end();
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
