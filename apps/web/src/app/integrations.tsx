"use client";

import { useEffect, useState, type JSX } from "react";

type Integration = {
  clientId: string;
  name: string | null;
  redirectUris: string[];
  scopes: string[] | null;
  enabled: boolean;
  status: "connected" | "not_connected" | "disabled";
  lastAuthorizedAt: string | null;
};

type Props = { apiBaseUrl: string };

function statusLabel(status: Integration["status"]): string {
  if (status === "connected") return "Terhubung";
  if (status === "disabled") return "Dinonaktifkan";
  return "Belum terhubung";
}

export function IntegrationsPanel({ apiBaseUrl }: Props): JSX.Element {
  const [items, setItems] = useState<Integration[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/api/v1/integrations`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("integration request failed");
        const body = (await response.json()) as { items?: Integration[] };
        setItems(body.items ?? []);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [apiBaseUrl]);

  if (state === "loading") return <section className="state-panel" aria-live="polite"><div><strong>Memuat integrasi…</strong><p>Status koneksi sedang diperiksa.</p></div></section>;
  if (state === "error") return <section className="state-panel" role="alert"><div><strong>Integrasi belum tersedia</strong><p>Pastikan Anda memiliki izin integration:read dan coba lagi.</p></div></section>;
  if (items.length === 0) return <section className="state-panel"><div><strong>Belum ada integrasi</strong><p>Daftarkan aplikasi consumer melalui API registry.</p></div></section>;

  return (
    <section aria-labelledby="integrations-title">
      <div className="card-heading"><div><p className="eyebrow">SSO & OIDC</p><h2 id="integrations-title">Integrasi aplikasi</h2></div><span className="breadcrumb">Status aktif dalam 30 hari terakhir</span></div>
      <div className="integration-grid">
        {items.map((item) => (
          <article className="card integration-card" key={item.clientId}>
            <div className="integration-card-heading"><div><h3>{item.name ?? "Aplikasi tanpa nama"}</h3><p className="integration-client">{item.clientId}</p></div><span className={`integration-status ${item.status}`}><span aria-hidden="true">●</span>{statusLabel(item.status)}</span></div>
            <dl className="integration-details"><div><dt>Redirect URI</dt><dd>{item.redirectUris.join(", ")}</dd></div><div><dt>Scopes</dt><dd>{item.scopes?.join(", ") || "—"}</dd></div><div><dt>Terakhir diotorisasi</dt><dd>{item.lastAuthorizedAt === null ? "Belum pernah" : new Date(item.lastAuthorizedAt).toLocaleString("id-ID")}</dd></div></dl>
          </article>
        ))}
      </div>
    </section>
  );
}
