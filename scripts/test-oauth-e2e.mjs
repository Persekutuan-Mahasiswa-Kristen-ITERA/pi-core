#!/usr/bin/env node
/**
 * PI-CORE OAuth E2E diagnostic script.
 *
 * Usage:
 *   PI_CORE_OAUTH_CLIENT_ID=xxx node scripts/test-oauth-e2e.mjs
 *
 * What it does:
 *   1. Fetches OIDC discovery from staging.
 *   2. Generates PKCE (S256) + state + authorize URL.
 *   3. Starts a local HTTP server on port 9876 to catch the callback.
 *   4. Waits for you to complete login + consent in the browser.
 *   5. Asks for the client secret via stdin (never logs it).
 *   6. Exchanges the authorization code for tokens.
 *   7. Calls GET /api/v1/access with the access token.
 *
 * The script prints diagnostic details at every step so failures are obvious.
 *
 * SECURITY: The client secret is read from stdin and never logged/stored.
 *           Authorization codes are single-use — re-run the script for each attempt.
 */

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { URL, URLSearchParams } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// ── Configuration ──────────────────────────────────────────────────────────────
const ISSUER = "https://pi-core-api-staging.pmkitera.workers.dev";
const CLIENT_ID =
  process.env.PI_CORE_OAUTH_CLIENT_ID ?? "lFzNiYHIEBZAKBwBOCPiByXjQrHCWUUp";
const CALLBACK_PORT = process.env.CALLBACK_PORT
  ? Number(process.env.CALLBACK_PORT)
  : 9876;
const REDIRECT_URI =
  process.env.PI_CORE_REDIRECT_URI ??
  `http://localhost:${CALLBACK_PORT}/callback`;
const SCOPES = "openid profile email pmk:access";
const RESOURCE = process.env.PI_CORE_RESOURCE ?? ISSUER;

function log(label, data) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("═".repeat(60));
  if (data !== undefined) {
    console.log(
      typeof data === "string" ? data : JSON.stringify(data, null, 2),
    );
  }
}

function logStep(n, label) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Step ${n}: ${label}`);
  console.log("─".repeat(60));
}

// ── Step 1: OIDC Discovery ─────────────────────────────────────────────────────
logStep(1, "Fetching OIDC Discovery");
console.log(`  GET ${ISSUER}/.well-known/openid-configuration`);

let discovery;
try {
  const res = await fetch(`${ISSUER}/.well-known/openid-configuration`);
  console.log(`  Status: ${res.status}`);
  if (!res.ok) {
    const body = await res.text();
    console.error("  ❌ Discovery failed:", body.slice(0, 500));
    process.exit(1);
  }
  discovery = await res.json();
  console.log("  ✅ Discovery OK");
  console.log(`  authorization_endpoint: ${discovery.authorization_endpoint}`);
  console.log(`  token_endpoint:         ${discovery.token_endpoint}`);
  console.log(`  jwks_uri:               ${discovery.jwks_uri}`);
  console.log(`  issuer:                 ${discovery.issuer}`);
  console.log(
    `  scopes_supported:       ${JSON.stringify(discovery.scopes_supported)}`,
  );
} catch (err) {
  console.error("  ❌ Network error:", err.message);
  process.exit(1);
}

// ── Step 2: Generate PKCE + Authorize URL ──────────────────────────────────────
logStep(2, "Generating PKCE + authorization URL");

const state = randomBytes(24).toString("base64url");
const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");

console.log(`  state:          ${state.slice(0, 12)}…`);
console.log(
  `  code_verifier:  ${verifier.slice(0, 12)}… (${verifier.length} chars)`,
);
console.log(`  code_challenge: ${challenge.slice(0, 12)}…`);
console.log(`  client_id:      ${CLIENT_ID}`);
console.log(`  redirect_uri:   ${REDIRECT_URI}`);
console.log(`  scope:          ${SCOPES}`);

const authorizeUrl = new URL(discovery.authorization_endpoint);
authorizeUrl.search = new URLSearchParams({
  response_type: "code",
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  scope: SCOPES,
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
  resource: RESOURCE,
}).toString();

log("🌐 Buka URL ini di browser, login dengan Google, lalu klik 'Setujui':");
console.log(authorizeUrl.toString());
console.log(
  "\nBrowser akan redirect ke localhost — script ini menunggu callback.\n" +
    "⚠️  Authorization code sekali pakai. Jika gagal, jalankan ulang script.\n",
);

// ── Step 3: Wait for callback ──────────────────────────────────────────────────
logStep(
  3,
  `Waiting for callback on http://localhost:${CALLBACK_PORT}/callback`,
);

const { code } = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const returnedState = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDesc = url.searchParams.get("error_description");
    const code = url.searchParams.get("code");

    console.log(`  Callback received!`);
    console.log(
      `  state match:        ${returnedState === state ? "✅" : "❌ MISMATCH"}`,
    );
    console.log(`  error:              ${error ?? "(none)"}`);
    console.log(`  error_description:  ${errorDesc ?? "(none)"}`);
    console.log(
      `  code:               ${code ? code.slice(0, 12) + "…" : "(none)"}`,
    );

    if (returnedState !== state) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("State mismatch — possible CSRF.");
      server.close();
      reject(new Error("state mismatch"));
      return;
    }
    if (error) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end(
        `Authorization error: ${error} — ${errorDesc ?? "no description"}`,
      );
      server.close();
      reject(new Error(`authorization error: ${error} — ${errorDesc}`));
      return;
    }
    if (!code) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Missing authorization code.");
      server.close();
      reject(new Error("authorization code missing"));
      return;
    }

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      "<h2>✅ Authorization code diterima</h2>" +
        "<p>Kembali ke terminal untuk melanjutkan token exchange.</p>",
    );
    server.close();
    resolve({ code });
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `  ❌ Port ${CALLBACK_PORT} sudah dipakai. Tutup proses lain atau ganti CALLBACK_PORT.`,
      );
    }
    reject(err);
  });
  server.listen(CALLBACK_PORT, "127.0.0.1", () => {
    console.log(`  Listening on http://127.0.0.1:${CALLBACK_PORT}/callback`);
  });
});

// ── Step 4: Get client secret from stdin ────────────────────────────────────────
logStep(4, "Client secret input");
console.log(
  "  ⚠️  Paste client secret dari hasil POST /api/v1/integrations atau rotate-secret.",
);
console.log("  ⚠️  Ini BUKAN Google Client Secret (GOCSPX-…)!");
console.log("  ⚠️  Secret tidak akan ditampilkan.\n");

let clientSecret = process.env.PI_CORE_CLIENT_SECRET?.trim();
if (!clientSecret) {
  const rl = readline.createInterface({ input, output });
  clientSecret = (await rl.question("  Client Secret: ")).trim();
  rl.close();
}

if (!clientSecret) {
  console.error("  ❌ Client secret kosong.");
  process.exit(1);
}
console.log(`  ✅ Secret received (${clientSecret.length} chars)`);

// ── Step 5: Token exchange ─────────────────────────────────────────────────────
logStep(5, "Token exchange (authorization_code → tokens)");

const tokenEndpoint = discovery.token_endpoint;
console.log(`  POST ${tokenEndpoint}`);

// Use POST body for credentials (application/x-www-form-urlencoded)
// Better Auth accepts both Basic auth header and body params.
// Using body params is simpler and avoids Base64 encoding issues.
const tokenBody = new URLSearchParams({
  grant_type: "authorization_code",
  client_id: CLIENT_ID,
  client_secret: clientSecret,
  code,
  redirect_uri: REDIRECT_URI,
  code_verifier: verifier,
  resource: RESOURCE,
});

console.log("  Body params (secret redacted):");
for (const [k, v] of tokenBody.entries()) {
  if (k === "client_secret")
    console.log(`    ${k} = [${v.length} chars, REDACTED]`);
  else if (k === "code") console.log(`    ${k} = ${v.slice(0, 16)}…`);
  else if (k === "code_verifier") console.log(`    ${k} = ${v.slice(0, 16)}…`);
  else console.log(`    ${k} = ${v}`);
}

let tokenResponse, tokenBodyResult;
try {
  tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  tokenBodyResult = await tokenResponse.text();
  console.log(`\n  Response status: ${tokenResponse.status}`);
} catch (err) {
  console.error(`  ❌ Network error during token exchange: ${err.message}`);
  process.exit(1);
}

let tokenJson;
try {
  tokenJson = JSON.parse(tokenBodyResult);
} catch {
  console.error("  ❌ Response is not JSON:", tokenBodyResult.slice(0, 500));
  process.exit(1);
}

if (!tokenResponse.ok) {
  log("❌ TOKEN EXCHANGE FAILED", {
    status: tokenResponse.status,
    error: tokenJson.error ?? null,
    error_description: tokenJson.error_description ?? null,
    full_response: tokenJson,
  });

  // Provide diagnostic hints
  console.log("\n📋 Diagnosis hints:");
  const errDesc = tokenJson.error_description ?? "";
  const errCode = tokenJson.error ?? "";

  if (errCode === "invalid_client" && errDesc.includes("client_secret")) {
    console.log(
      "  → Client secret salah. Pastikan kamu pakai PLAINTEXT secret dari:",
    );
    console.log("    POST /api/v1/integrations (saat create) ATAU");
    console.log(
      "    POST /api/v1/integrations/:clientId/rotate-secret (saat rotate)",
    );
    console.log("  → BUKAN Google client secret (GOCSPX-…).");
    console.log("  → BUKAN hash yang tersimpan di database.");
    console.log("  → Jika sudah rotate, secret lama TIDAK berlaku lagi.");
  } else if (
    errCode === "invalid_client" &&
    errDesc.includes("missing client")
  ) {
    console.log(
      `  → Client ID '${CLIENT_ID}' tidak ditemukan di database staging.`,
    );
    console.log(
      "  → Pastikan client sudah diregister via POST /api/v1/integrations.",
    );
  } else if (errCode === "invalid_client" && errDesc.includes("disabled")) {
    console.log("  → Client sudah di-disable. Enable kembali via PATCH.");
  } else if (errCode === "invalid_grant" && errDesc.includes("invalid code")) {
    console.log(
      "  → Authorization code sudah expired atau sudah dipakai (single-use).",
    );
    console.log("  → Jalankan ulang script untuk mendapat code baru.");
  } else if (
    errCode === "invalid_request" &&
    errDesc.includes("redirect_uri")
  ) {
    console.log(
      `  → Redirect URI mismatch. Script menggunakan: ${REDIRECT_URI}`,
    );
    console.log(
      "  → Pastikan redirect URI di client registration sama persis.",
    );
  } else if (
    errCode === "invalid_request" &&
    errDesc.includes("code_verifier")
  ) {
    console.log(
      "  → PKCE code_verifier gagal. Ini berarti code_challenge saat authorize",
    );
    console.log("    tidak cocok dengan code_verifier saat exchange.");
    console.log("  → Coba jalankan ulang script (fresh PKCE setiap run).");
  } else {
    console.log("  → Error tidak dikenali. Periksa full_response di atas.");
  }
  process.exit(1);
}

log("✅ TOKEN EXCHANGE SUCCESS", {
  token_type: tokenJson.token_type,
  expires_in: tokenJson.expires_in,
  scope: tokenJson.scope,
  has_access_token: typeof tokenJson.access_token === "string",
  has_refresh_token: typeof tokenJson.refresh_token === "string",
  has_id_token: typeof tokenJson.id_token === "string",
});

const accessToken = tokenJson.access_token;
if (typeof accessToken !== "string") {
  console.error("  ❌ No access_token in response.");
  process.exit(1);
}

// Decode JWT for debugging (no verification — just inspect claims)
try {
  const parts = accessToken.split(".");
  if (parts.length === 3) {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    log("🔍 Access token JWT claims (decoded, unverified)", {
      iss: payload.iss ?? null,
      aud: payload.aud ?? null,
      sub: payload.sub ? `${payload.sub.slice(0, 8)}…` : null,
      scope: payload.scope ?? null,
      exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
    });
  }
} catch {
  console.log("  (Could not decode JWT — might be opaque token)");
}

// ── Step 6: Call /api/v1/access ────────────────────────────────────────────────
logStep(6, "Calling GET /api/v1/access with Bearer token");
console.log(`  GET ${ISSUER}/api/v1/access`);

let accessResponse, accessBodyResult;
try {
  accessResponse = await fetch(`${ISSUER}/api/v1/access`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  accessBodyResult = await accessResponse.text();
  console.log(`  Response status: ${accessResponse.status}`);
} catch (err) {
  console.error(`  ❌ Network error: ${err.message}`);
  process.exit(1);
}

let accessJson;
try {
  accessJson = JSON.parse(accessBodyResult);
} catch {
  accessJson = { raw: accessBodyResult.slice(0, 500) };
}

if (accessResponse.ok) {
  log("✅ ACCESS ENDPOINT SUCCESS (200)", {
    member_email: accessJson.member?.email ?? null,
    member_status: accessJson.member?.status ?? null,
    active_period: accessJson.activePeriod?.name ?? null,
    roles: accessJson.roles ?? null,
    permission_count: Array.isArray(accessJson.permissions)
      ? accessJson.permissions.length
      : null,
    token_meta: accessJson.token ?? null,
  });
  console.log("\n🎉 Full OAuth E2E flow berhasil!");
} else {
  log("❌ ACCESS ENDPOINT FAILED", {
    status: accessResponse.status,
    response: accessJson,
  });

  if (accessResponse.status === 401) {
    console.log("\n📋 Diagnosis hints (401 Unauthorized):");
    const msg = accessJson.error?.message ?? "";
    if (msg.includes("Bearer")) {
      console.log("  → Header Authorization tidak ada atau format salah.");
    } else if (msg.includes("expired")) {
      console.log("  → Token sudah expired. Check exp claim di atas.");
    } else {
      console.log("  → Token signature, issuer, atau audience mismatch.");
      console.log("  → Bandingkan JWT claims di atas dengan konfigurasi:");
      console.log(`    Expected issuer:  ${ISSUER}/api/auth`);
      console.log(`    Expected audience: ${ISSUER}`);
    }
  }
}
