"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import {
  Link2,
  Plug,
  RefreshCw,
  ShieldOff,
  Clock,
  KeyRound,
} from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";
import { apiFetch } from "../../lib/api-client";
import {
  displayName,
  formatLastAuthorized,
  sortIntegrations,
  statusHint,
  statusLabel,
  type Integration,
} from "../../lib/integrations";
import { useSession } from "../../lib/session";

const BADGE: Record<string, string> = {
  connected: "badge badge-green",
  not_connected: "badge badge-gold",
  disabled: "badge badge-gray",
};

export default function IntegrationsPage(): JSX.Element {
  const session = useSession();
  const authenticated = session.state.status === "authenticated";

  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!authenticated) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/v1/integrations");
      if (response.status === 401) {
        setError("Sesi berakhir. Masuk ulang untuk melihat daftar integrasi.");
        setItems([]);
        return;
      }
      if (response.status === 403) {
        setError("Akun ini tidak memegang izin integration:read.");
        setItems([]);
        return;
      }
      if (!response.ok) {
        setError(`Gagal memuat integrasi (HTTP ${String(response.status)}).`);
        return;
      }
      const body = (await response.json()) as { items?: Integration[] };
      setItems(body.items ?? []);
    } catch {
      setError("Tidak dapat menghubungi API. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = sortIntegrations(items);
  const connected = items.filter((item) => item.status === "connected").length;
  const now = new Date();

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Integrasi" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">OIDC Client Registry</p>
              <h1>Integrasi Aplikasi PMK</h1>
              <p className="subtitle">
                {!authenticated
                  ? "Masuk untuk melihat aplikasi yang terhubung."
                  : loading
                    ? "Memuat daftar klien OIDC…"
                    : `${String(items.length)} aplikasi terdaftar, ${String(connected)} terhubung dalam 30 hari terakhir.`}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="badge badge-blue"
                style={{ padding: "8px 14px", fontSize: 12 }}
              >
                <KeyRound size={13} />
                <span>Secret tidak pernah ditampilkan</span>
              </span>
            </div>
          </div>

          {error !== null ? (
            <div
              className="card"
              style={{
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 13,
                borderColor: "var(--color-negative)",
              }}
            >
              <strong style={{ color: "var(--color-negative)" }}>
                Terjadi kesalahan.
              </strong>{" "}
              {error}
              <button
                className="button button-secondary"
                type="button"
                style={{
                  marginLeft: 12,
                  minHeight: 28,
                  padding: "2px 10px",
                  fontSize: 12,
                }}
                onClick={() => void load()}
              >
                <RefreshCw size={13} /> Coba lagi
              </button>
            </div>
          ) : null}

          {!authenticated && !loading ? (
            <div
              className="card"
              style={{ padding: "48px 16px", textAlign: "center" }}
            >
              <Plug
                size={36}
                style={{
                  margin: "0 auto 12px",
                  color: "var(--color-muted)",
                  opacity: 0.5,
                }}
              />
              <strong
                style={{
                  display: "block",
                  color: "var(--color-heading)",
                  fontSize: 15,
                }}
              >
                Masuk untuk melihat integrasi
              </strong>
              <p
                style={{
                  margin: "4px 0 12px",
                  color: "var(--color-muted)",
                  fontSize: 13,
                }}
              >
                Daftar klien OIDC hanya tersedia untuk pemegang{" "}
                <code>integration:read</code>.
              </p>
              <button
                className="button button-primary"
                type="button"
                onClick={() => void session.signIn()}
              >
                Masuk dengan Google
              </button>
            </div>
          ) : sorted.length === 0 && !loading ? (
            <div
              className="card"
              style={{
                padding: "48px 16px",
                textAlign: "center",
                color: "var(--color-muted)",
              }}
            >
              Belum ada aplikasi yang terdaftar sebagai klien OIDC.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 18,
              }}
            >
              {sorted.map((item) => (
                <article
                  className="card card-hover"
                  key={item.clientId}
                  style={{ display: "flex", flexDirection: "column" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          padding: 8,
                          borderRadius: 10,
                          backgroundColor: "rgba(146, 70, 3, 0.08)",
                          color: "#924603",
                        }}
                      >
                        {item.status === "disabled" ? (
                          <ShieldOff size={18} />
                        ) : (
                          <Link2 size={18} />
                        )}
                      </div>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                          {displayName(item)}
                        </h3>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--color-muted)",
                            fontFamily: "monospace",
                          }}
                        >
                          {item.clientId}
                        </span>
                      </div>
                    </div>
                    <span className={BADGE[item.status] ?? "badge badge-gray"}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: 12.5,
                      color: "var(--color-muted)",
                    }}
                  >
                    {statusHint(item.status)}
                  </p>

                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-muted)",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div>
                      <strong
                        style={{ color: "var(--color-heading-secondary)" }}
                      >
                        Redirect URI:
                      </strong>{" "}
                      <span
                        style={{
                          fontFamily: "monospace",
                          wordBreak: "break-all",
                        }}
                      >
                        {item.redirectUris.length === 0
                          ? "—"
                          : item.redirectUris.join(", ")}
                      </span>
                    </div>
                    <div>
                      <strong
                        style={{ color: "var(--color-heading-secondary)" }}
                      >
                        Scope:
                      </strong>{" "}
                      <span style={{ fontFamily: "monospace" }}>
                        {item.scopes === null || item.scopes.length === 0
                          ? "—"
                          : item.scopes.join(" ")}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Clock size={12} />
                      <span>
                        <strong
                          style={{ color: "var(--color-heading-secondary)" }}
                        >
                          Terakhir diizinkan:
                        </strong>{" "}
                        {formatLastAuthorized(item.lastAuthorizedAt, now)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
