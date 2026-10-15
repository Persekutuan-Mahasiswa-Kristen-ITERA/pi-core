/**
 * Live verification of the mobile hand-off (story 3.3) against the **deployed** Worker.
 *
 * It exercises the real HTTP surface, not a unit of it: mint a code through `finish`, exchange it with
 * the PKCE verifier, use the returned token as a bearer credential, then prove the code cannot be
 * replayed, a wrong verifier is refused, a foreign redirect URI is refused, and sign-out really ends
 * the session.
 *
 * It plants one session row directly so it has a credential to start from — which is also the claim
 * the `exchange` endpoint makes, so the run doubles as proof that a session row created outside Better
 * Auth is accepted by Better Auth's own session lookup.
 *
 *   DIRECT_URL=… pnpm --filter @pi-core/api exec tsx scripts/verify-mobile-handoff.ts
 */
import { codeChallengeFor, createDb } from "@pi-core/db";
import { authSessions, members } from "@pi-core/db/schema";
import { eq } from "drizzle-orm";

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
    `  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`}`,
  );
}

const TAG = `verify-mobile-${Date.now()}`;
const REDIRECT = "picore://auth";
const plantedToken = `${TAG}-planted`;
let sessionId: string | undefined;
let memberId: string | undefined;

try {
  // A real member to act as — the owner's bootstrap row already exists, so reuse it.
  const member = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.status, "active"))
    .limit(1);
  memberId = member[0]?.id;
  if (memberId === undefined) {
    console.log("SKIP: no active member to act as");
    process.exit(0);
  }

  const inserted = await db
    .insert(authSessions)
    .values({
      token: plantedToken,
      expiresAt: new Date(Date.now() + 3_600_000),
      userId: memberId,
    })
    .returning({ id: authSessions.id });
  sessionId = inserted[0]!.id;

  // ---- a planted session is a usable credential ------------------------------
  console.log("FR-2 — a session row created outside Better Auth is accepted as a bearer credential");
  const whoami = await fetch(`${API}/api/auth/get-session`, {
    headers: { authorization: `Bearer ${plantedToken}` },
  });
  const whoamiBody = (await whoami.json()) as { user?: { id?: string } } | null;
  check("get-session resolves the member", whoamiBody?.user?.id, memberId);

  // ---- the guard rails ------------------------------------------------------
  console.log("\n3.3 — the hand-off refuses a redirect URI that is not on the allowlist");
  const evil = await fetch(
    `${API}/api/v1/auth/mobile/finish?redirect_uri=${encodeURIComponent("https://evil.example/steal")}&code_challenge=abc`,
    { headers: { authorization: `Bearer ${plantedToken}` }, redirect: "manual" },
  );
  check("status", evil.status, 400);

  console.log("\n3.3 — and refuses to mint without a session");
  const anon = await fetch(
    `${API}/api/v1/auth/mobile/finish?redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=abc`,
    { redirect: "manual" },
  );
  check("status", anon.status, 400);

  // ---- leg 2: mint ----------------------------------------------------------
  console.log("\nFR-2 — leg 2 mints a code and redirects to the app's deep link");
  const verifier = `${TAG}-${"v".repeat(50)}`;
  const challenge = await codeChallengeFor(verifier);
  const finish = await fetch(
    `${API}/api/v1/auth/mobile/finish?redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${challenge}&state=${TAG}`,
    { headers: { authorization: `Bearer ${plantedToken}` }, redirect: "manual" },
  );
  check("status is a redirect", finish.status, 302);
  const location = finish.headers.get("location") ?? "";
  const deepLink = new URL(location);
  check("it goes to the app's scheme", `${deepLink.protocol}//${deepLink.host}`, REDIRECT);
  check("the state is echoed back", deepLink.searchParams.get("state"), TAG);
  const code = deepLink.searchParams.get("code") ?? "";
  check("a code is present", code.length > 20, true);

  // ---- leg 3: exchange -----------------------------------------------------
  console.log("\n3.3 — a wrong verifier is refused");
  const wrong = await fetch(`${API}/api/v1/auth/mobile/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, verifier: `${verifier}-wrong`, redirectUri: REDIRECT }),
  });
  check("status", wrong.status, 401);
  check("one generic error code", ((await wrong.json()) as { error?: { code?: string } }).error?.code, "invalid_grant");

  console.log("\nFR-2/NFR-16 — the correct verifier exchanges the code for a session token");
  const exchange = await fetch(`${API}/api/v1/auth/mobile/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, verifier, redirectUri: REDIRECT }),
  });
  check("status", exchange.status, 200);
  const issued = (await exchange.json()) as { token?: string; tokenType?: string; expiresAt?: string };
  check("it is a bearer token", issued.tokenType, "Bearer");
  check("with a token", typeof issued.token === "string" && issued.token.length > 20, true);

  console.log("\n3.3 — the code is single-use: replaying it fails");
  const replay = await fetch(`${API}/api/v1/auth/mobile/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, verifier, redirectUri: REDIRECT }),
  });
  check("status", replay.status, 401);

  // ---- the issued token works, then sign-out ends it ------------------------
  console.log("\nFR-2 — the issued token authenticates a request");
  const withToken = await fetch(`${API}/api/auth/get-session`, {
    headers: { authorization: `Bearer ${issued.token ?? ""}` },
  });
  check("get-session resolves the member", ((await withToken.json()) as { user?: { id?: string } } | null)?.user?.id, memberId);

  console.log("\n3.3 — sign-out revokes exactly that session");
  const signOut = await fetch(`${API}/api/v1/auth/mobile/sign-out`, {
    method: "POST",
    headers: { authorization: `Bearer ${issued.token ?? ""}` },
  });
  check("status", signOut.status, 200);

  // The row IS deleted (confirmed by querying the database directly afterwards), but a read issued
  // immediately after the write can still see it — the same read-after-write window that produced a
  // duplicate `auth.identity_linked` audit row earlier. Measure the window instead of hiding it behind
  // a fixed sleep, so the number is on the record.
  const startedAt = Date.now();
  let stillValid: unknown = "unknown";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const res = await fetch(`${API}/api/auth/get-session`, {
      headers: { authorization: `Bearer ${issued.token ?? ""}` },
    });
    stillValid = await res.json();
    if (stillValid === null) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check("the token eventually stops working", stillValid, null);
  console.log(`         (read-after-write window observed: ~${Date.now() - startedAt} ms)`);
} finally {
  if (sessionId !== undefined) await db.delete(authSessions).where(eq(authSessions.id, sessionId));
  if (memberId !== undefined) {
    await db.delete(authSessions).where(eq(authSessions.token, plantedToken));
  }
  await pool.end();
}

console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
