/**
 * A minimal sign-in entry point, served by the API Worker itself.
 *
 * Why it exists: the OAuth `state` is kept in an `HttpOnly` cookie scoped to this origin with a
 * 5-minute life (`__Secure-better-auth.state`), so a sign-in must be *started by the browser that
 * will finish it*. Serving the page from the same origin as the callback is what makes the cookie
 * work at all; the admin web app is a different origin and would need `SameSite=None` cross-site
 * cookies instead (noted in ADR-0015).
 *
 * This is a **staging placeholder**, not the product UI — the real sign-in screen comes from the
 * Figma design in Epic 4. It deliberately shows the session it obtained (member id and effective
 * roles) because that is the end-to-end proof that the whole chain works: Google consent → callback
 * → session cookie → admission → RBAC roles.
 *
 * Public in the FR-25 registry: a sign-in page is by definition reachable without a session.
 */
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { sessionMiddleware } from "../middleware/session";

export const signInPageRoutes = new Hono<AppEnv>();

signInPageRoutes.use("*", sessionMiddleware);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared page shell — the palette is from docs/DESIGN.md. */
function page(body: string): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Masuk — PI-CORE</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#F8F7F6; color:#0F172A;
         font-family: Manrope, Inter, system-ui, sans-serif; }
  main { background:#fff; border:1px solid #E2E1DF; border-radius:12px;
         padding:40px 36px; width:min(92vw, 420px); text-align:center;
         box-shadow:0 1px 3px rgba(15,23,42,.06); }
  h1 { font-size:20px; margin:0 0 6px; color:#5A3E1B; }
  p  { font-size:14px; color:#475569; line-height:1.55; margin:0 0 24px; }
  button { width:100%; padding:13px 16px; border:0; border-radius:12px; cursor:pointer;
           background:#924603; color:#fff; font-size:15px; font-weight:600; font-family:inherit; }
  button:hover { background:#5A3E1B; }
  button:disabled { opacity:.6; cursor:progress; }
  dl { text-align:left; font-size:14px; margin:0; }
  dt { color:#64748B; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  dd { margin:2px 0 14px; word-break:break-all; }
  .roles { display:flex; flex-wrap:wrap; gap:6px; }
  .role { background:#E6C65C33; border:1px solid #E6C65C; border-radius:30px;
          padding:2px 10px; font-size:13px; }
  .note { margin-top:22px; padding-top:16px; border-top:1px solid #E2E1DF;
          font-size:12px; color:#64748B; }
  .err { background:#E11D4812; border:1px solid #E11D48; border-radius:8px;
         padding:10px 12px; font-size:13px; color:#E11D48; margin-top:16px; text-align:left; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

signInPageRoutes.get("/", (c) => {
  const actor = c.get("actor");
  const email = c.get("sessionEmail");

  /**
   * Mobile hand-off (story 3.3): when the app sends its PKCE challenge and deep link, the post-consent
   * redirect goes to the hand-off endpoint instead of back to this page. Passed through verbatim —
   * `finish` re-validates the redirect URI against the configured allowlist, so nothing is trusted
   * merely because it arrived here.
   */
  const redirectUri = c.req.query("redirect_uri") ?? "";
  const codeChallenge = c.req.query("code_challenge") ?? "";
  const state = c.req.query("state") ?? "";
  const isMobile = redirectUri !== "" && codeChallenge !== "";

  const callbackUrl = isMobile
    ? `/api/v1/auth/mobile/finish?${new URLSearchParams({
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        ...(state !== "" ? { state } : {}),
      }).toString()}`
    : "/sign-in";

  if (actor !== undefined && email !== undefined) {
    if (isMobile) {
      return c.redirect(callbackUrl);
    }
    const roles =
      actor.roles.length > 0
        ? actor.roles.map((r) => `<span class="role">${escapeHtml(r)}</span>`).join("")
        : `<span class="role">anggota</span>`;
    return c.html(
      page(`
        <h1>Sudah masuk</h1>
        <p>Login berhasil — seluruh rantai bekerja: consent Google → callback → cookie sesi →
           pemeriksaan admission → peran RBAC.</p>
        <dl>
          <dt>Email</dt><dd>${escapeHtml(email)}</dd>
          <dt>Member id</dt><dd>${escapeHtml(actor.memberId)}</dd>
          <dt>Peran efektif</dt><dd><div class="roles">${roles}</div></dd>
        </dl>
        <div class="note">Halaman uji sementara (story 3.1). Layar login sebenarnya dibuat di Epic 4
          dari desain Figma.</div>
      `),
    );
  }

  return c.html(
    page(`
      <h1>Masuk ke PI-CORE</h1>
      <p>Gunakan akun Google ITERA Anda (<code>@itera.ac.id</code> atau
         <code>@student.itera.ac.id</code>).</p>
      <button id="go" type="button">Masuk dengan Google</button>
      <div id="err"></div>
      <div class="note">Halaman uji sementara (story 3.1). Tidak ada sign-in kata sandi —
        hanya Google, sesuai FR-1.</div>
      <script>
        const btn = document.getElementById('go');
        const err = document.getElementById('err');
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Mengalihkan ke Google…';
          try {
            const res = await fetch('/api/auth/sign-in/social', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ provider: 'google', callbackURL: ${JSON.stringify(callbackUrl)} }),
            });
            const data = await res.json();
            if (data && data.url) { window.location.href = data.url; return; }
            err.className = 'err';
            err.textContent = 'Tidak bisa memulai login. ' + (data && data.message ? data.message : '');
            btn.disabled = false;
            btn.textContent = 'Masuk dengan Google';
          } catch (e) {
            err.className = 'err';
            err.textContent = 'Gagal menghubungi server: ' + e;
            btn.disabled = false;
            btn.textContent = 'Masuk dengan Google';
          }
        });
      </script>
    `),
  );
});
