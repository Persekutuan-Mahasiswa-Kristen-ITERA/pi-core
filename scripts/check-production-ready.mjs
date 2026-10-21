#!/usr/bin/env node
/**
 * Production preflight.
 *
 * Production deploy is an approval gate, and the cheapest way to respect that gate is to make the
 * machine say out loud what is still missing instead of a human remembering. This script checks the
 * things that are cheap to get wrong and expensive to discover after a deploy:
 *
 *   1. both Workers declare an `env.production` block;
 *   2. production does **not** point at the staging Hyperdrive config (the mistake that would put live
 *      traffic on staging data);
 *   3. production vars do not name a staging origin anywhere (auth issuer, CORS, API URL);
 *   4. the required secrets exist on the production Worker — names only, never values;
 *   5. the API and web origins agree, so the browser sends tokens to the Worker that verifies them.
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
  // 2 — the staging/production split is the whole point of the second Hyperdrive config.
  const apiStaging = hyperdriveId(api, "staging");
  const apiProduction = hyperdriveId(api, "production");
  if (apiProduction === null) {
    failures.push("apps/api: production has no HYPERDRIVE id");
  } else if (apiProduction === apiStaging) {
    failures.push(
      `apps/api: production HYPERDRIVE is the staging config (${apiProduction}) — live traffic would read and write staging data`,
    );
  } else if (/^0+$/.test(apiProduction)) {
    failures.push(
      "apps/api: production HYPERDRIVE id is still the placeholder — create the production Supabase project and Hyperdrive config, then paste its id",
    );
  }

  // 3 — a staging origin left in a production var sends sign-in or CORS to the wrong place.
  const productionVars = {
    ...varsFor(api, "production"),
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

  // 5 — the web app must send tokens to the Worker that verifies them.
  const apiOrigin = productionVars.BETTER_AUTH_URL ?? "";
  const corsOrigins = (productionVars.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim());
  const publicApiUrl = productionVars.NEXT_PUBLIC_API_URL;
  if (apiOrigin === "") {
    failures.push("BETTER_AUTH_URL is not set for production");
  }
  if (corsOrigins.length === 0 || corsOrigins[0] === "") {
    failures.push("CORS_ORIGINS is not set for production");
  }
  if (publicApiUrl !== undefined && publicApiUrl !== apiOrigin) {
    failures.push(
      `NEXT_PUBLIC_API_URL (${publicApiUrl}) does not match BETTER_AUTH_URL (${apiOrigin})`,
    );
  }
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
    failures.push(
      `could not list production secrets: ${String(error.message).split("\n")[0]}`,
    );
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
