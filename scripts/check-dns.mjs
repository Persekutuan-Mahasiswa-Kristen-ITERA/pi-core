#!/usr/bin/env node
/**
 * DNS cutover check for `pmkitera.web.id`.
 *
 * The zone is moving from Rumahweb to Cloudflare so that Workers can hold custom domains
 * (`core.` / `api.core.`) — Cloudflare cannot create a Custom Domain on a zone it does not host
 * (https://developers.cloudflare.com/workers/configuration/routing/custom-domains/). Four Vercel
 * apps already live on that zone and must keep answering afterwards, so the cutover has a
 * before/after shape and this script is the checklist for both:
 *
 *   node scripts/check-dns.mjs                 # before: zone at Rumahweb, 4 Vercel hosts up
 *   node scripts/check-dns.mjs --after-cutover # after: zone at Cloudflare, core/api.core up too
 *
 * It answers from public DNS and public HTTP only. No credentials, no writes.
 */
import { resolve4, resolve6, resolveCname, resolveMx, resolveNs, resolveTxt } from "node:dns/promises";

const AFTER = process.argv.includes("--after-cutover");
const ZONE = "pmkitera.web.id";

/** The four Vercel deployments that predate PI-CORE. Their apps are out of this repo's scope — the
 *  records must be reproduced identically, nothing about the apps changes. */
const VERCEL_HOSTS = [
  { host: ZONE, kind: "A", label: "situs utama" },
  { host: `www.${ZONE}`, kind: "CNAME", label: "www" },
  { host: `form.${ZONE}`, kind: "CNAME", label: "PMK FORM" },
  { host: `ark.${ZONE}`, kind: "CNAME", label: "PI-ARK" },
  { host: `s.${ZONE}`, kind: "CNAME", label: "PMK S" },
];

/** Hostnames PI-CORE will take over. Absent before the cutover, required after it. */
const PI_CORE_HOSTS = [`core.${ZONE}`, `api.core.${ZONE}`];

const results = [];
const failures = [];

function record(level, line) {
  results.push(`${level} ${line}`);
}

async function checkNameservers() {
  const ns = (await resolveNs(ZONE)).map((name) => name.toLowerCase()).sort();
  const cloudflare = ns.filter((name) => name.endsWith(".ns.cloudflare.com"));
  const where = cloudflare.length > 0 ? "Cloudflare" : "bukan Cloudflare";

  if (cloudflare.length === ns.length && ns.length > 0) {
    record("✓", `NS: ${ns.join(", ")} — zona aktif di Cloudflare`);
  } else if (cloudflare.length === 0) {
    record(AFTER ? "✗" : "·", `NS: ${ns.join(", ")} — ${where} (belum pindah)`);
    if (AFTER) failures.push("nameserver belum Cloudflare");
  } else {
    record("!", `NS campuran: ${ns.join(", ")} — propagasi belum selesai`);
    if (AFTER) failures.push("nameserver masih campuran");
  }
}

async function checkVercelHost({ host, kind, label }) {
  try {
    if (kind === "A") {
      const addresses = await resolve4(host);
      const ok = addresses.includes("216.198.79.1");
      record(ok ? "✓" : "✗", `${host} A ${addresses.join(", ")} (${label})`);
      if (!ok) failures.push(`${host} tidak lagi menunjuk Vercel (${addresses.join(", ")})`);
      return;
    }
    const target = (await resolveCname(host))[0] ?? "(tanpa CNAME)";
    const ok = target.includes("vercel-dns");
    record(ok ? "✓" : "✗", `${host} CNAME ${target} (${label})`);
    if (!ok) failures.push(`${host} bukan CNAME Vercel (${target})`);
  } catch (error) {
    record("✗", `${host} tidak dapat di-resolve (${error.code ?? error.message}) — ${label}`);
    failures.push(`${host} gagal resolve`);
  }
}

async function checkPiCoreHost(host) {
  const [addresses, cname] = await Promise.all([
    resolve4(host).catch(() => []),
    resolveCname(host).catch(() => []),
  ]);
  // Both resolvers swallow their own error above, so "empty" is the absence signal — never a tick.
  if (addresses.length === 0 && cname.length === 0) {
    record(AFTER ? "✗" : "·", `${host} belum ada`);
    if (AFTER) failures.push(`${host} belum resolve`);
    return;
  }
  const where = cname.length > 0 ? `CNAME ${cname[0]}` : `A ${addresses.join(", ")}`;
  record("✓", `${host} ${where}`);
}

async function checkMail() {
  const [mx, txt] = await Promise.all([resolveMx(ZONE).catch(() => []), resolveTxt(ZONE).catch(() => [])]);
  record("·", `MX: ${mx.length === 0 ? "tidak ada" : mx.map((entry) => entry.exchange).join(", ")}`);
  record("·", `TXT: ${txt.length === 0 ? "tidak ada" : String(txt.length) + " record"}`);
}

async function checkHttp(host) {
  const url = `https://${host}/`;
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const ok = response.status < 400;
    record(ok ? "✓" : "✗", `${url} → ${String(response.status)}`);
    if (!ok) failures.push(`${url} menjawab ${String(response.status)}`);
  } catch (error) {
    record("✗", `${url} → ${error.name === "TimeoutError" ? "timeout" : String(error.message)}`);
    failures.push(`${url} tidak menjawab`);
  }
}

await checkNameservers();
for (const host of VERCEL_HOSTS) await checkVercelHost(host);
for (const host of PI_CORE_HOSTS) await checkPiCoreHost(host);
await checkMail();

if (AFTER) {
  for (const host of [...VERCEL_HOSTS.map((entry) => entry.host), ...PI_CORE_HOSTS]) {
    await checkHttp(host);
  }
}

console.log(`\n${AFTER ? "SETELAH" : "SEBELUM"} cutover — zona ${ZONE}\n`);
for (const line of results) console.log(`  ${line}`);

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} masalah:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(
  AFTER
    ? "\nCutover sehat: Cloudflare memegang zona, situs lama hidup, dan hostname PI-CORE menjawab.\n"
    : "\nZona masih di provider lama; hostname PI-CORE memang belum ada. Siap untuk cutover.\n",
);
