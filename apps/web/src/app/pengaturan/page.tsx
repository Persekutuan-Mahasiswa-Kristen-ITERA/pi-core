"use client";

import { useCallback, useEffect, useState, type JSX, type FormEvent } from "react";
import { Building2, Shield, Plus, Cloud, Save, CheckCircle2, RefreshCw, Users } from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";
import { apiFetch } from "../../lib/api-client";
import { useSession } from "../../lib/session";

/** `OrgSettingsView` in `packages/db/src/settings.ts` — `orgName` is the only editable field. */
interface OrgSettings {
  orgName: string;
  logoKey: string | null;
  updatedAt: string;
}

interface AllowedDomain {
  id: string;
  domain: string;
  allowSubdomains: boolean;
  isActive: boolean;
}

export default function PengaturanPage(): JSX.Element {
  const session = useSession();
  const authenticated = session.state.status === "authenticated";

  const [orgName, setOrgName] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const [logoKey, setLogoKey] = useState<string | null>(null);
  const [domains, setDomains] = useState<AllowedDomain[]>([]);
  const [newDomain, setNewDomain] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!authenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [orgResponse, domainsResponse] = await Promise.all([
        apiFetch("/api/v1/settings/org"),
        apiFetch("/api/v1/settings/domains"),
      ]);

      if (orgResponse.status === 401 || orgResponse.status === 403) {
        setError("Sesi ini tidak memiliki izin settings:read.");
        return;
      }
      if (!orgResponse.ok) {
        setError(`Gagal memuat profil organisasi (HTTP ${String(orgResponse.status)}).`);
        return;
      }
      const orgBody = (await orgResponse.json()) as { settings: OrgSettings | null };
      setOrgName(orgBody.settings?.orgName ?? "");
      setSavedName(orgBody.settings?.orgName ?? null);
      setLogoKey(orgBody.settings?.logoKey ?? null);

      if (domainsResponse.ok) {
        const domainBody = (await domainsResponse.json()) as { items: AllowedDomain[] };
        setDomains(domainBody.items);
      }
    } catch {
      setError("Tidak dapat menghubungi API. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (orgName.trim() === "") {
      setError("Nama organisasi tidak boleh kosong.");
      return;
    }
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const response = await apiFetch("/api/v1/settings/org", {
        method: "PATCH",
        body: JSON.stringify({ orgName: orgName.trim() }),
      });
      if (response.status === 403) {
        setError("Peran Anda tidak memiliki izin settings:manage.");
        return;
      }
      if (!response.ok) {
        setError(`Gagal menyimpan profil (HTTP ${String(response.status)}).`);
        return;
      }
      setSavedName(orgName.trim());
      setNotice("Profil organisasi disimpan.");
    } catch {
      setError("Tidak dapat menghubungi API. Perubahan belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddDomain(): Promise<void> {
    const clean = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (clean === "") return;

    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const response = await apiFetch("/api/v1/settings/domains", {
        method: "POST",
        body: JSON.stringify({ domain: clean }),
      });
      if (response.status === 403) {
        setError("Peran Anda tidak memiliki izin settings:manage.");
        return;
      }
      if (response.status === 409) {
        setError("Domain itu sudah ada, atau bukan hostname polos (tanpa skema/path).");
        return;
      }
      if (!response.ok) {
        setError(`Gagal menambah domain (HTTP ${String(response.status)}).`);
        return;
      }
      setNewDomain("");
      setNotice(`@${clean} ditambahkan.`);
      await load();
    } catch {
      setError("Tidak dapat menghubungi API. Domain belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * There is no delete endpoint for a domain — only `PATCH { isActive }`. Offering a "hapus" that
   * cannot delete was the old page's behaviour; the control now says what it actually does.
   */
  async function handleToggleDomain(domain: AllowedDomain): Promise<void> {
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const response = await apiFetch(`/api/v1/settings/domains/${domain.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !domain.isActive }),
      });
      if (!response.ok) {
        setError(`Gagal mengubah domain (HTTP ${String(response.status)}).`);
        return;
      }
      setNotice(`@${domain.domain} ${domain.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
      await load();
    } catch {
      setError("Tidak dapat menghubungi API. Status domain belum berubah.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Pengaturan Organisasi" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Konfigurasi Sistem</p>
              <h1>Pengaturan &amp; Keamanan Organisasi</h1>
              <p className="subtitle">
                Profil identitas organisasi dan domain email yang boleh dipakai masuk. Nilai di halaman ini
                adalah isi basis data, bukan contoh.
              </p>
            </div>
          </div>

          {notice !== null ? (
            <div className="card" style={{ padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {notice}
            </div>
          ) : null}

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
                Masuk untuk mengelola pengaturan
              </strong>
              <button
                className="button button-primary"
                type="button"
                style={{ marginTop: 12 }}
                onClick={() => void session.signIn()}
              >
                Masuk dengan Google
              </button>
            </div>
          ) : (
            <div className="grid">
              <form className="card card-hover" onSubmit={(event) => void handleSave(event)}>
                <div className="card-heading">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        padding: 8,
                        borderRadius: 10,
                        backgroundColor: "rgba(90, 62, 27, 0.08)",
                        color: "var(--color-primary)",
                      }}
                    >
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h2>Profil Identitas PMK ITERA</h2>
                      <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                        Nama ini yang muncul di portal dan di consent screen OIDC.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                  <div className="form-field">
                    <label>Nama Resmi Organisasi</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder={loading ? "Memuat…" : "Persekutuan Mahasiswa Kristen ITERA"}
                      required
                    />
                    <p style={{ fontSize: 11.5, color: "var(--color-muted)", margin: "6px 0 0" }}>
                      Hanya nama organisasi yang tersimpan di PI-CORE. Email, nomor sekretariat dan alamat
                      belum punya kolom di database, jadi tidak ditampilkan sebagai field yang bisa diisi.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <button className="button button-gold" type="submit" disabled={busy}>
                    <Save size={15} />
                    <span>{busy ? "Menyimpan…" : "Simpan Perubahan Profil"}</span>
                  </button>
                  {savedName !== null ? (
                    <p style={{ fontSize: 11.5, color: "var(--color-muted)", margin: "10px 0 0" }}>
                      Nilai tersimpan saat ini: <strong>{savedName}</strong>
                    </p>
                  ) : null}
                </div>
              </form>

              <div style={{ display: "grid", gap: 20 }}>
                <article className="card card-hover">
                  <div className="card-heading">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          padding: 8,
                          borderRadius: 10,
                          backgroundColor: "rgba(37, 99, 235, 0.08)",
                          color: "#2563eb",
                        }}
                      >
                        <Shield size={18} />
                      </div>
                      <div>
                        <h2>Domain Whitelist Google Sign-In</h2>
                        <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                          Hanya akun Google berdomain ini yang diizinkan masuk (ADR-0005).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                    {domains.length === 0 ? (
                      <span style={{ fontSize: 13, color: "var(--color-muted)" }}>
                        {loading ? "Memuat domain…" : "Belum ada domain terdaftar."}
                      </span>
                    ) : (
                      domains.map((domain) => (
                        <span
                          key={domain.id}
                          className={`badge ${domain.isActive ? "badge-gold" : "badge-gray"}`}
                          style={{
                            padding: "6px 12px",
                            fontSize: 13,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span>
                            @{domain.domain}
                            {domain.isActive ? "" : " (nonaktif)"}
                          </span>
                          <button
                            type="button"
                            aria-label={`${domain.isActive ? "Nonaktifkan" : "Aktifkan"} domain ${domain.domain}`}
                            title={domain.isActive ? "Nonaktifkan domain" : "Aktifkan domain"}
                            style={{
                              background: "transparent",
                              border: 0,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              color: "inherit",
                              padding: 0,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                            onClick={() => void handleToggleDomain(domain)}
                            disabled={busy}
                          >
                            {domain.isActive ? "OFF" : "ON"}
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      className="search-input"
                      style={{ minWidth: 0, flex: 1, paddingLeft: 12 }}
                      placeholder="Tambah domain baru (cth: alumni.itera.ac.id)"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                    />
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => void handleAddDomain()}
                      disabled={busy}
                    >
                      <Plus size={15} />
                      <span>Tambah</span>
                    </button>
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--color-muted)", margin: "10px 0 0" }}>
                    Domain tidak bisa dihapus — hanya dinonaktifkan, supaya riwayat audit tetap utuh.
                  </p>
                </article>

                <article className="card card-hover">
                  <div className="card-heading">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          padding: 8,
                          borderRadius: 10,
                          backgroundColor: "rgba(5, 150, 105, 0.08)",
                          color: "var(--color-positive)",
                        }}
                      >
                        <Cloud size={18} />
                      </div>
                      <div>
                        <h2>Logo Organisasi</h2>
                        <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                          Disimpan di Cloudflare R2 dan disajikan lewat API.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        background: "linear-gradient(135deg, var(--color-primary-dark) 0%, #1a1005 100%)",
                        color: "var(--color-gold)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    >
                      <Building2 size={24} />
                    </div>
                    <div>
                      {logoKey === null ? (
                        <>
                          <strong style={{ fontSize: 14, color: "var(--color-heading)" }}>Belum ada logo</strong>
                          <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "2px 0 6px" }}>
                            Unggah logo lewat API sebelum menampilkannya di sini.
                          </p>
                        </>
                      ) : (
                        <>
                          <strong style={{ fontSize: 14, color: "var(--color-heading)" }}>Logo tersimpan</strong>
                          <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "2px 0 6px" }}>
                            Kunci objek: <code>{logoKey}</code>
                          </p>
                          <span className="badge badge-green">
                            <CheckCircle2 size={11} />
                            Tersedia
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              </div>
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
