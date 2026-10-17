"use client";

import { useEffect, useState, type FormEvent, type JSX } from "react";

type Integration = {
  clientId: string;
  name: string | null;
  redirectUris: string[];
  scopes: string[] | null;
  enabled: boolean;
  status: "connected" | "not_connected" | "disabled";
  lastAuthorizedAt: string | null;
};

type CreatedIntegration = { client_id?: string; client_secret?: string };
type Props = { apiBaseUrl: string };

function statusLabel(status: Integration["status"]): string {
  if (status === "connected") return "Terhubung";
  if (status === "disabled") return "Dinonaktifkan";
  return "Belum terhubung";
}

export function IntegrationsPanel({ apiBaseUrl }: Props): JSX.Element {
  const [items, setItems] = useState<Integration[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState<"idle" | "submitting" | "error">("idle");
  const [formError, setFormError] = useState("");
  const [newCredentials, setNewCredentials] = useState<CreatedIntegration | null>(null);

  async function loadIntegrations(signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/api/v1/integrations`, { credentials: "include", ...(signal === undefined ? {} : { signal }) });
    if (!response.ok) throw new Error("integration request failed");
    const body = (await response.json()) as { items?: Integration[] };
    setItems(body.items ?? []);
    setState("ready");
  }

  useEffect(() => {
    const controller = new AbortController();
    loadIntegrations(controller.signal).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState("error");
    });
    return () => controller.abort();
  }, [apiBaseUrl]);

  async function createIntegration(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormState("submitting");
    setFormError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const redirectUri = String(form.get("redirectUri") ?? "").trim();
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/integrations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          redirectUris: [redirectUri],
          scopes: ["openid", "profile", "email", "pmk:access"],
          type: "web",
        }),
      });
      const body = (await response.json()) as { integration?: CreatedIntegration; error?: { message?: string } };
      if (!response.ok || body.integration === undefined) throw new Error(body.error?.message ?? "Integrasi gagal dibuat.");
      setNewCredentials(body.integration);
      setShowForm(false);
      setFormState("idle");
      await loadIntegrations();
    } catch (error) {
      setFormState("error");
      setFormError(error instanceof Error ? error.message : "Integrasi gagal dibuat.");
    }
  }

  if (state === "loading") return <section className="state-panel" aria-live="polite"><div><strong>Memuat integrasi…</strong><p>Status koneksi sedang diperiksa.</p></div></section>;
  if (state === "error") return <section className="state-panel" role="alert"><div><strong>Integrasi belum tersedia</strong><p>Pastikan Anda memiliki izin integration:read dan coba lagi.</p></div></section>;

  return (
    <section aria-labelledby="integrations-title">
      <div className="card-heading">
        <div><p className="eyebrow">SSO & OIDC</p><h2 id="integrations-title">Integrasi aplikasi</h2></div>
        <button className="button" type="button" onClick={() => { setShowForm((current) => !current); setNewCredentials(null); }}>{showForm ? "Tutup" : "+ Buat integrasi"}</button>
      </div>
      <p className="integration-hint">Kelola aplikasi consumer PI-CORE dengan Authorization Code + PKCE.</p>
      {newCredentials?.client_secret !== undefined && (
        <div className="credential-panel" role="alert">
          <strong>Client berhasil dibuat. Simpan secret sekarang.</strong>
          <p>Secret hanya ditampilkan pada respons pembuatan ini dan tidak ditampilkan ulang.</p>
          <label>Client ID<input readOnly value={newCredentials.client_id ?? ""} /></label>
          <label>Client Secret<input readOnly value={newCredentials.client_secret} /></label>
        </div>
      )}
      {showForm && (
        <form className="integration-form" onSubmit={(event) => void createIntegration(event)}>
          <label>Nama aplikasi<input required maxLength={120} name="name" placeholder="PI-CORE OAuth Test" /></label>
          <label>Redirect URI<input required name="redirectUri" placeholder="http://localhost:8787/callback" type="url" /></label>
          <p className="form-help">Scopes otomatis: openid, profile, email, pmk:access. PKCE selalu wajib.</p>
          {formState === "error" && <p className="form-error" role="alert">{formError}</p>}
          <button className="button" disabled={formState === "submitting"} type="submit">{formState === "submitting" ? "Membuat…" : "Buat client"}</button>
        </form>
      )}
      {items.length === 0 ? <div className="state-panel"><div><strong>Belum ada integrasi</strong><p>Gunakan tombol di atas untuk mendaftarkan aplikasi consumer.</p></div></div> : (
        <div className="integration-grid">
          {items.map((item) => (
            <article className="card integration-card" key={item.clientId}>
              <div className="integration-card-heading"><div><h3>{item.name ?? "Aplikasi tanpa nama"}</h3><p className="integration-client">{item.clientId}</p></div><span className={`integration-status ${item.status}`}><span aria-hidden="true">●</span>{statusLabel(item.status)}</span></div>
              <dl className="integration-details"><div><dt>Redirect URI</dt><dd>{item.redirectUris.join(", ")}</dd></div><div><dt>Scopes</dt><dd>{item.scopes?.join(", ") || "—"}</dd></div><div><dt>Terakhir diotorisasi</dt><dd>{item.lastAuthorizedAt === null ? "Belum pernah" : new Date(item.lastAuthorizedAt).toLocaleString("id-ID")}</dd></div></dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
