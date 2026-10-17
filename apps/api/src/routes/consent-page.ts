import { oauthClients } from "@pi-core/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { sessionMiddleware } from "../middleware/session";

export const consentPageRoutes = new Hono<AppEnv>();
consentPageRoutes.use("*", sessionMiddleware);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(body: string): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Persetujuan akses — PI-CORE</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#F8F7F6; color:#0F172A; font-family:Manrope,Inter,system-ui,sans-serif; }
  main { width:min(92vw,460px); padding:32px; border:1px solid rgba(161,89,18,.2); border-radius:12px; background:#fff; box-shadow:0 1px 3px rgba(15,23,42,.06); }
  h1 { margin:0 0 8px; color:#5A3E1B; font-size:22px; }
  p { color:#475569; font-size:14px; line-height:1.55; }
  .app { margin:20px 0; padding:16px; border-radius:12px; background:rgba(161,89,18,.1); }
  .app strong { display:block; color:#1E293B; font-size:17px; }
  .muted { color:#64748B; font-size:12px; word-break:break-all; }
  ul { padding-left:22px; color:#475569; line-height:1.8; }
  .actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:24px; }
  button { min-height:44px; border:0; border-radius:9999px; cursor:pointer; font:inherit; font-weight:700; }
  .allow { background:#5A3E1B; color:#fff; }
  .deny { border:1px solid rgba(161,89,18,.2); background:#fff; color:#5A3E1B; }
  .note { margin-top:20px; padding-top:16px; border-top:1px solid #E2E1DF; color:#64748B; font-size:12px; }
  .error { margin-top:16px; padding:10px 12px; border:1px solid #E11D48; border-radius:8px; color:#E11D48; font-size:13px; }
</style>
</head>
<body><main>${body}</main>
<script>
for (const form of document.querySelectorAll('form[data-consent]')) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    if (button) { button.disabled = true; button.textContent = 'Memproses…'; }
    const data = new FormData(form);
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ accept: data.get('accept') === 'true', scope: data.get('scope'), oauth_query: data.get('oauth_query') }),
      });
      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); } catch { result = {}; }
      if (response.ok && typeof result.redirect_uri === 'string' && result.redirect_uri.length > 0) { window.location.assign(result.redirect_uri); return; }
      const description = typeof result.error_description === 'string' ? result.error_description : typeof result.message === 'string' ? result.message : 'Server mengembalikan HTTP ' + response.status + '.';
      throw new Error(description);
    } catch (error) {
      const message = document.createElement('div');
      message.className = 'error';
      message.setAttribute('role', 'alert');
      message.textContent = error instanceof Error ? error.message : 'Persetujuan gagal diproses.';
      form.parentElement.appendChild(message);
      if (button) { button.disabled = false; button.textContent = button.dataset.label || 'Coba lagi'; }
    }
  });
}
</script>
</body>
</html>`;
}

consentPageRoutes.get("/", async (c) => {
  const query = new URL(c.req.url).searchParams;
  const clientId = query.get("client_id") ?? "";
  const requestedScopes = (query.get("scope") ?? "").split(" ").filter(Boolean);
  const db = c.get("db");
  const client = db === undefined || clientId === ""
    ? undefined
    : (await db.select({ name: oauthClients.name, clientId: oauthClients.clientId }).from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1))[0];
  const appName = client?.name ?? "Aplikasi consumer PI-CORE";
  const oauthQuery = query.toString();
  const scopeItems = requestedScopes.length > 0
    ? requestedScopes.map((scope) => `<li>${escapeHtml(scope)}</li>`).join("")
    : "<li>Akses dasar OIDC</li>";
  const encodedQuery = escapeHtml(oauthQuery);
  const form = (accept: boolean, label: string, className: string) => `<form data-consent method="post" action="/api/auth/oauth2/consent"><input type="hidden" name="accept" value="${accept ? "true" : "false"}"><input type="hidden" name="scope" value="${escapeHtml(requestedScopes.join(" "))}"><input type="hidden" name="oauth_query" value="${encodedQuery}"><button class="${className}" data-label="${label}" type="submit">${label}</button></form>`;

  return c.html(page(`
    <h1>Persetujuan akses</h1>
    <p>Aplikasi ini meminta izin untuk mengakses data PI-CORE atas nama akun Anda.</p>
    <div class="app"><strong>${escapeHtml(appName)}</strong><span class="muted">${escapeHtml(client?.clientId ?? clientId)}</span></div>
    <p><strong>Izin yang diminta:</strong></p>
    <ul>${scopeItems}</ul>
    <div class="actions">${form(false, "Tolak", "deny")}${form(true, "Setujui", "allow")}</div>
    <div class="note">PI-CORE menggunakan Authorization Code + PKCE. Persetujuan ini hanya berlaku untuk aplikasi dan akun yang ditampilkan.</div>
  `));
});
