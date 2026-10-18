"use client";

import { useState, type JSX } from "react";
import { Building2, Mail, Phone, MapPin, Shield, Plus, X, Cloud, Save, CheckCircle2, Sparkles } from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";

export default function PengaturanPage(): JSX.Element {
  const [orgName, setOrgName] = useState("Persekutuan Mahasiswa Kristen ITERA");
  const [orgEmail, setOrgEmail] = useState("pmk@itera.ac.id");
  const [orgPhone, setOrgPhone] = useState("+62 821-7788-9900");
  const [savedToast, setSavedToast] = useState(false);

  const [domains, setDomains] = useState<string[]>(["itera.ac.id", "student.itera.ac.id"]);
  const [newDomain, setNewDomain] = useState("");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  }

  function handleAddDomain() {
    if (!newDomain.trim()) return;
    const clean = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (!domains.includes(clean)) {
      setDomains((prev) => [...prev, clean]);
      setNewDomain("");
    }
  }

  function handleRemoveDomain(d: string) {
    if (domains.length <= 1) return;
    setDomains((prev) => prev.filter((item) => item !== d));
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
              <h1>Pengaturan & Keamanan Organisasi</h1>
              <p className="subtitle">
                Profil identitas organisasi PMK ITERA, domain email whitelist Google Workspace, dan aset brand.
              </p>
            </div>
          </div>

          <div className="grid">
            <form className="card card-hover" onSubmit={handleSave}>
              <div className="card-heading">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ padding: 8, borderRadius: 10, backgroundColor: "rgba(90, 62, 27, 0.08)", color: "var(--color-primary)" }}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h2>Profil Identitas PMK ITERA</h2>
                    <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                      Informasi resmi yang ditampilkan pada portal dan OIDC consent screen.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                <div className="form-field">
                  <label>Nama Resmi Organisasi</label>
                  <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                </div>

                <div className="form-field">
                  <label>Email Resmi Organisasi</label>
                  <input type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} required />
                </div>

                <div className="form-field">
                  <label>Nomor WhatsApp Sekretariat</label>
                  <input type="text" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
                </div>

                <div className="form-field">
                  <label>Alamat Sekretariat</label>
                  <input type="text" defaultValue="Gedung E ITERA, Jl. Terusan Ryacudu, Way Hui, Jati Agung, Lampung Selatan" />
                </div>
              </div>

              {savedToast && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 8,
                    backgroundColor: "rgba(5, 150, 105, 0.1)",
                    color: "var(--color-positive)",
                    fontSize: 13,
                    fontWeight: 600,
                    marginTop: 18,
                  }}
                  role="status"
                >
                  <CheckCircle2 size={16} />
                  <span>Pengaturan profil organisasi berhasil disimpan!</span>
                </div>
              )}

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <button className="button button-gold" type="submit">
                  <Save size={15} />
                  <span>Simpan Perubahan Profil</span>
                </button>
              </div>
            </form>

            <div style={{ display: "grid", gap: 20 }}>
              {/* Domain Whitelist */}
              <article className="card card-hover">
                <div className="card-heading">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 8, borderRadius: 10, backgroundColor: "rgba(37, 99, 235, 0.08)", color: "#2563eb" }}>
                      <Shield size={18} />
                    </div>
                    <div>
                      <h2>Domain Whitelist Google Sign-In</h2>
                      <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                        Hanya akun Google berdomain ini yang diizinkan login (ADR-0005).
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                  {domains.map((d) => (
                    <span
                      key={d}
                      className="badge badge-gold"
                      style={{ padding: "6px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <span>@{d}</span>
                      <button
                        type="button"
                        aria-label={`Hapus domain ${d}`}
                        style={{
                          background: "transparent",
                          border: 0,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          color: "inherit",
                          padding: 0,
                        }}
                        onClick={() => handleRemoveDomain(d)}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
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
                  <button className="button button-secondary" type="button" onClick={handleAddDomain}>
                    <Plus size={15} />
                    <span>Tambah</span>
                  </button>
                </div>
              </article>

              {/* Brand Asset */}
              <article className="card card-hover">
                <div className="card-heading">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 8, borderRadius: 10, backgroundColor: "rgba(5, 150, 105, 0.08)", color: "var(--color-positive)" }}>
                      <Cloud size={18} />
                    </div>
                    <div>
                      <h2>Brand Asset & Logo Cloudflare R2</h2>
                      <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                        Penyimpanan avatar anggota dan lambang organisasi terdistribusi.
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
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: "var(--color-heading)" }}>Logo Utama PMK ITERA</strong>
                    <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "2px 0 6px" }}>
                      Tersimpan secara publik dan cepat via Edge CDN Cloudflare R2.
                    </p>
                    <span className="badge badge-green">
                      <span className="badge-dot" />
                      Bucket: pmk-core-avatars (Live)
                    </span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
