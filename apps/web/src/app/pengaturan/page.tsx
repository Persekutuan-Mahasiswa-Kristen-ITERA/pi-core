"use client";

import { useState, type JSX } from "react";
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
              <h1>Pengaturan Organisasi</h1>
              <p className="subtitle">Profil organisasi PMK ITERA, domain email yang diizinkan, dan brand asset.</p>
            </div>
          </div>

          <div className="grid">
            <form className="card" onSubmit={handleSave}>
              <div className="card-heading">
                <h2>Profil PMK ITERA</h2>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <div className="form-field">
                  <label>Nama Organisasi</label>
                  <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                </div>
                <div className="form-field">
                  <label>Email Resmi Organisasi</label>
                  <input type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} required />
                </div>
                <div className="form-field">
                  <label>Nomor Telepon / WhatsApp Sekretariat</label>
                  <input type="text" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Alamat Sekretariat</label>
                  <input type="text" defaultValue="Gedung E ITERA, Jl. Terusan Ryacudu, Way Hui, Jati Agung" />
                </div>
              </div>
              {savedToast && (
                <div className="success-message" role="status" style={{ marginTop: 16 }}>
                  ✓ Pengaturan profil organisasi berhasil disimpan!
                </div>
              )}
              <div style={{ marginTop: 20 }}>
                <button className="button" type="submit">
                  Simpan Perubahan
                </button>
              </div>
            </form>

            <div style={{ display: "grid", gap: 20 }}>
              <article className="card">
                <div className="card-heading">
                  <h2>Domain Email Diizinkan (Whitelist)</h2>
                </div>
                <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "0 0 12px" }}>
                  Hanya akun Google dengan domain ini yang diizinkan masuk ke ekosistem PMK ITERA (ADR-0005).
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {domains.map((d) => (
                    <span className="badge badge-gold" key={d} style={{ padding: "6px 12px", fontSize: 12 }}>
                      @{d}
                      <button
                        type="button"
                        style={{ background: "transparent", border: 0, cursor: "pointer", marginLeft: 6, fontWeight: 800 }}
                        onClick={() => handleRemoveDomain(d)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="search-input"
                    style={{ minWidth: 0, flex: 1 }}
                    placeholder="tambah domain (cth: alumni.itera.ac.id)"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                  />
                  <button className="button button-secondary" type="button" onClick={handleAddDomain}>
                    Tambah
                  </button>
                </div>
              </article>

              <article className="card">
                <div className="card-heading">
                  <h2>Logo & Brand Asset</h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "var(--color-primary)",
                      color: "var(--color-gold)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 24,
                      fontWeight: 800,
                    }}
                  >
                    ✚
                  </div>
                  <div>
                    <strong>Logo Utama PMK ITERA</strong>
                    <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "2px 0 6px" }}>
                      Format PNG/SVG transparansi tersimpan di Cloudflare R2
                    </p>
                    <span className="badge badge-green">R2 Bucket: pmk-core-avatars</span>
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
