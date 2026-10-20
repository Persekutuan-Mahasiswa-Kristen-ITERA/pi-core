"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import { Shield, Key, Layers, Lock, CheckCircle2, RefreshCw, Users } from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";
import { apiFetch } from "../../lib/api-client";
import { useSession } from "../../lib/session";

/** `listRoles` in `packages/db/src/roles.ts`. */
interface RolePermission {
  key: string;
  scope: string;
  description: string | null;
}

interface RoleRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: RolePermission[];
}

const SCOPE_LABEL: Record<string, string> = {
  O: "O (Organisasi)",
  U: "U (Subtree Unit)",
  S: "S (Data Mandiri)",
};

export default function PeranPage(): JSX.Element {
  const session = useSession();
  const authenticated = session.state.status === "authenticated";

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!authenticated) {
      setRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/v1/roles");
      if (response.status === 401 || response.status === 403) {
        setError("Sesi ini tidak memiliki izin role:read.");
        setRoles([]);
        return;
      }
      if (!response.ok) {
        setError(`Gagal memuat peran (HTTP ${String(response.status)}).`);
        return;
      }
      const body = (await response.json()) as { items: RoleRow[] };
      setRoles(body.items);
    } catch {
      setError("Tidak dapat menghubungi API. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const permissionKeys = new Set(roles.flatMap((role) => role.permissions.map((grant) => grant.key)));
  const systemCount = roles.filter((role) => role.isSystem).length;

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Peran & Hak Akses" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Role-Based Access Control (RBAC)</p>
              <h1>Katalog Peran &amp; Izin Otorisasi</h1>
              <p className="subtitle">
                {loading
                  ? "Memuat katalog peran…"
                  : `${String(roles.length)} peran (${String(systemCount)} sistem) dengan ${String(permissionKeys.size)} izin berbeda, langsung dari tabel roles dan role_permissions.`}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="badge badge-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
                <Lock size={13} />
                <span>Peran sistem bersifat read-only</span>
              </span>
            </div>
          </div>

          {error !== null ? (
            <div
              className="card"
              style={{ padding: "10px 14px", marginBottom: 16, fontSize: 13, borderColor: "var(--color-negative)" }}
            >
              <strong style={{ color: "var(--color-negative)" }}>Terjadi kesalahan.</strong> {error}
              <button
                className="button button-secondary"
                type="button"
                style={{ marginLeft: 12, minHeight: 28, padding: "2px 10px", fontSize: 12 }}
                onClick={() => void load()}
              >
                <RefreshCw size={13} /> Coba lagi
              </button>
            </div>
          ) : null}

          {!authenticated && !loading ? (
            <div className="card" style={{ padding: "48px 16px", textAlign: "center" }}>
              <Users size={36} style={{ margin: "0 auto 12px", color: "var(--color-muted)", opacity: 0.5 }} />
              <strong style={{ display: "block", color: "var(--color-heading)", fontSize: 15 }}>
                Masuk untuk melihat katalog peran
              </strong>
              <p style={{ margin: "4px 0 12px", color: "var(--color-muted)", fontSize: 13 }}>
                Daftar izin per peran hanya tersedia untuk pemegang <code>role:read</code>.
              </p>
              <button className="button button-primary" type="button" onClick={() => void session.signIn()}>
                Masuk dengan Google
              </button>
            </div>
          ) : roles.length === 0 && !loading ? (
            <div className="card" style={{ padding: "48px 16px", textAlign: "center", color: "var(--color-muted)" }}>
              Tidak ada peran yang dapat ditampilkan.
            </div>
          ) : (
            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}
            >
              {roles.map((role) => {
                const scopes = [...new Set(role.permissions.map((grant) => grant.scope))].sort();
                return (
                  <article
                    className="card card-hover"
                    key={role.id}
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
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            padding: 8,
                            borderRadius: 10,
                            backgroundColor: "rgba(124, 58, 237, 0.08)",
                            color: "#7c3aed",
                          }}
                        >
                          <Shield size={18} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{role.name}</h3>
                          <span
                            style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "monospace" }}
                          >
                            {role.key}
                          </span>
                        </div>
                      </div>
                      <span className="badge badge-blue">
                        <Key size={11} />
                        <span>{String(role.permissions.length)} Izin</span>
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--color-body)",
                        margin: "0 0 16px",
                        flex: 1,
                        lineHeight: 1.5,
                      }}
                    >
                      {role.description ?? "Tanpa deskripsi."}
                    </p>

                    <div
                      style={{
                        borderTop: "1px solid rgba(0, 0, 0, 0.06)",
                        paddingTop: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 12,
                        gap: 8,
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)" }}
                      >
                        <Layers size={13} />
                        <span>
                          Lingkup:{" "}
                          <strong>
                            {scopes.length === 0
                              ? "—"
                              : scopes.map((scope) => SCOPE_LABEL[scope] ?? scope).join(", ")}
                          </strong>
                        </span>
                      </div>
                      {role.isSystem ? (
                        <span className="badge badge-green" style={{ fontSize: 10 }}>
                          <CheckCircle2 size={10} />
                          Sistem
                        </span>
                      ) : (
                        <span className="badge badge-gold" style={{ fontSize: 10 }}>
                          Kustom
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
