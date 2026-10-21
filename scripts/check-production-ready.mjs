#!/usr/bin/env node
/**
 * Production preflight.
 *
 * Production deploy is an approval gate, and the cheapest way to respect that gate is to make the
 * machine say out loud what is still missing instead of a human remembering. This script checks the
 * things that are cheap to get wrong and expensive to discover after a deploy:
 *
 *   1. both Workers declare an `env.production` block with a custom domain route;
 *   2. the API and web hosts agree — `BETTER_AUTH_URL` is the API route, `CORS_ORIGINS` contains the web
 *      route — so the browser sends tokens to the Worker that verifies them;
 *   3. no production var still names a staging origin or a `REPLACE` placeholder;
 *   4. the API's data plane is deliberate: sharing the staging Hyperdrive config is only allowed when
 *      `DATA_PLANE: "shared"` says so (ADR-0019), and a placeholder id is always refused;
 *   5. the required secrets exist on the production Worker — names only, never values.
 *
 * It never deploys, never writes, and never prints a secret value. Exit code 1 means "not ready".
 *
 * Usage: node scripts/check-production-ready.mjs [--skip-secrets]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP_SECRETS = process.argv.includes("--skip-secrets");

const REQUIRED_SECRETS = [
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];

const failures = [];
const notes = [];

/** `wrangler.jsonc` allows comments; strip them so it can be parsed as JSON. */
function readWrangler(relativePath) {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  const withoutBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(withoutLineComments);
}

function hyperdriveId(config, env) {
  const scope = env === null ? config : (config.env?.[env] ?? null);
  if (scope === null) return null;
  const binding = (scope.hyperdrive ?? config.hyperdrive ?? [])[0];
  return binding?.id ?? null;
}

function varsFor(config, env) {
  return { ...(config.vars ?? {}), ...(config.env?.[env]?.vars ?? {}) };
}

/** The custom domain a scope serves on, if it declares one. */
function routeHost(config, env) {
  const scope = config.env?.[env] ?? config;
  const route = (scope.routes ?? [])[0];
  if (route?.pattern === undefined) return null;
  return String(route.pattern).replace(/\/\*$/, "");
}

const api = readWrangler("apps/api/wrangler.jsonc");
const web = readWrangler("apps/web/wrangler.jsonc");

// 1 — production environments must exist before the runbook's commands mean anything.
for (const [name, config] of [
  ["apps/api/wrangler.jsonc", api],
  ["apps/web/wrangler.jsonc", web],
]) {
  if (config.env?.production === undefined) {
    failures.push(
      `${name}: no "env.production" block — \`wrangler deploy --env production\` would fail`,
    );
  }
}

if (failures.length === 0) {
  // 1b — a deployment without a route is reachable only on `*.workers.dev`, which is not the plan.
  const apiHost = routeHost(api, "production");
  const webHost = routeHost(web, "production");
  if (apiHost === null) {
    failures.push("apps/api: production has no custom domain route (expected api.core.pmkitera.web.id)");
  }
  if (webHost === null) {
    failures.push("apps/web: production has no custom domain route (expected core.pmkitera.web.id)");
  }

  // 2 — the data plane. ADR-0019 decided production shares the staging Supabase project and bucket, so
  // an identical Hyperdrive id is expected — but only when the config says so out loud. The failure this
  // guards against is not "shared" but "silently shared": someone pointing production at a database
  // without realising it, or leaving the all-zeros placeholder and believing production is configured.
  const apiStaging = hyperdriveId(api, "staging");
  const apiProduction = hyperdriveId(api, "production");
  const productionApiVars = varsFor(api, "production");
  if (apiProduction === null) {
    failures.push("apps/api: production has no HYPERDRIVE id");
  } else if (/^0+$/.test(apiProduction)) {
    failures.push("apps/api: production HYPERDRIVE id is still the all-zeros placeholder");
  } else if (apiProduction === apiStaging && productionApiVars.DATA_PLANE !== "shared") {
    failures.push(
      `apps/api: production HYPERDRIVE is the same config as staging (${apiProduction}) ` +
        'and DATA_PLANE is not "shared" — sharing a database must be a written decision (ADR-0019)',
    );
  } else if (apiProduction === apiStaging) {
    notes.push("data plane SHARED with staging: live rows are the rows the workers.dev URL touches");
  }

  // 3 — a staging origin left in a production var sends sign-in or CORS to the wrong place.
  const productionVars = {
    ...productionApiVars,
    ...varsFor(web, "production"),
  };
  for (const [key, value] of Object.entries(productionVars)) {
    if (
      typeof value === "string" &&
      (value.includes("staging") || value.includes("REPLACE"))
    ) {
      failures.push(
        `${key} still points at staging or is a placeholder: ${value}`,
      );
    }
  }

  // 2 (cont.) — the web app must send tokens to the Worker that verifies them, and the API must accept
  // the web origin. These are compared against the routes, not against each other, so a typo in either
  // hostname is caught here instead of as a silent 401 or a CORS failure in the browser.
  const apiOrigin = productionVars.BETTER_AUTH_URL ?? "";
  const corsOrigins = (productionVars.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
  const publicApiUrl = productionVars.NEXT_PUBLIC_API_URL;
  if (apiOrigin === "") {
    failures.push("BETTER_AUTH_URL is not set for production");
  } else if (apiHost !== null && new URL(apiOrigin).hostname !== apiHost) {
    failures.push(
      `BETTER_AUTH_URL host (${new URL(apiOrigin).hostname}) is not the API route (${apiHost})`,
    );
  }
  if (corsOrigins.length === 0) {
    failures.push("CORS_ORIGINS is not set for production");
  } else if (webHost !== null && !corsOrigins.some((origin) => origin === `https://${webHost}`)) {
    failures.push(`CORS_ORIGINS does not include the web route (https://${webHost})`);
  }
  if (publicApiUrl !== undefined && publicApiUrl !== apiOrigin) {
    failures.push(
      `NEXT_PUBLIC_API_URL (${publicApiUrl}) does not match BETTER_AUTH_URL (${apiOrigin})`,
    );
  }
  notes.push(`API host: ${apiHost ?? "(no route)"} · web host: ${webHost ?? "(no route)"}`);
  notes.push(`API origin: ${apiOrigin || "(unset)"}`);
  notes.push(`CORS origins: ${corsOrigins.join(", ") || "(unset)"}`);
}

// 4 — secret names only. Values are never read, printed or compared.
if (!SKIP_SECRETS && failures.length === 0) {
  try {
    const raw = execFileSync(
      "pnpm",
      [
        "--filter",
        "@pi-core/api",
        "exec",
        "wrangler",
        "secret",
        "list",
        "--env",
        "production",
      ],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const names = JSON.parse(raw.slice(raw.indexOf("["))).map(
      (item) => item.name,
    );
    const missing = REQUIRED_SECRETS.filter((name) => !names.includes(name));
    if (missing.length > 0) {
      failures.push(
        `apps/api: production is missing secrets: ${missing.join(", ")}`,
      );
    }
    notes.push(
      `production secrets present: ${String(names.length)} (names only)`,
    );
  } catch (error) {
    // `execFileSync` puts the interesting text in stderr; `error.message` is only the command line.
    const stderr = error.stderr === undefined ? "" : String(error.stderr);
    const detail =
      stderr.split("\n").find((line) => line.trim() !== "") ?? String(error.message).split("\n")[0];
    if (/not found|couldn't find|does not exist|10090/i.test(stderr)) {
      failures.push(
        "the production Worker does not exist yet — its first `wrangler deploy --env production` " +
          "creates it; set the 5 secrets afterwards and re-run this check",
      );
    } else {
      failures.push(`could not list production secrets: ${detail}`);
    }
  }
}

if (notes.length > 0) {
  for (const note of notes) console.log(`  · ${note}`);
}

if (failures.length > 0) {
  console.error("\nNOT READY FOR PRODUCTION:\n");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(
    "\nProduction deploy stays an approval gate: create the resources, set the secrets, then re-run this script.",
  );
  process.exit(1);
}

console.log(
  "\nProduction preflight passed. Deploying is still an owner decision (AGENTS.md).",
);
