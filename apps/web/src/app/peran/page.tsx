import type { JSX } from "react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";

const ROLES_CATALOG = [
  { key: "super_admin", name: "Super Admin", scope: "O (Semua)", isSystem: true, grants: 22, desc: "Hak penuh mutlak atas seluruh sistem, konfigurasi, integrasi OIDC, dan peran." },
  { key: "organization_admin", name: "Organization Admin", scope: "O (Organisasi)", isSystem: true, grants: 17, desc: "Pengelola operasional organisasi, anggota, periode, dan pengaturan." },
  { key: "bph", name: "BPH (Badan Pengurus Harian)", scope: "O (Organisasi)", isSystem: true, grants: 7, desc: "Ketua, Wakil, Sekretaris Umum, dan Bendahara Umum PMK ITERA." },
  { key: "kepala_departemen", name: "Kepala Departemen / Biro", scope: "U (Subtree Unit)", isSystem: true, grants: 7, desc: "Memimpin departemen/biro dan divisi di bawahnya sesuai hierarki." },
  { key: "sekretaris", name: "Sekretaris Departemen", scope: "U (Subtree Unit)", isSystem: true, grants: 9, desc: "Mengelola administrasi dan pembacaan data anggota dalam unitnya." },
  { key: "kepala_divisi", name: "Kepala Divisi", scope: "U (Divisi)", isSystem: true, grants: 6, desc: "Memimpin pelaksanaan program kerja pada divisi tertentu." },
  { key: "staff", name: "Staff Divisi", scope: "U (Divisi)", isSystem: true, grants: 5, desc: "Anggota pengurus aktif dalam divisi operasional." },
  { key: "bendahara", name: "Bendahara", scope: "U (Biro Kas)", isSystem: true, grants: 4, desc: "Marker role untuk pencatatan dan pelaporan keuangan." },
  { key: "panitia", name: "Panitia Acara", scope: "U (Event Scope)", isSystem: true, grants: 4, desc: "Hak penugasan sementara khusus kepanitiaan perayaan Natal/Paskah." },
  { key: "anggota", name: "Anggota Biasa", scope: "S (Data Mandiri)", isSystem: true, grants: 4, desc: "Anggota umum terdaftar PMK ITERA (akses mandiri direktori & profil)." },
];

export default function PeranPage(): JSX.Element {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Peran & Hak Akses" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Role-Based Access Control</p>
              <h1>Peran & Matriks Izin</h1>
              <p className="subtitle">10 peran resmi organisasi dengan 23 granular permissions dan guard bertingkat.</p>
            </div>
            <span className="badge badge-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
              ✓ 100% Immutable System Roles
            </span>
          </div>

          <div className="role-grid">
            {ROLES_CATALOG.map((role) => (
              <article className="card" key={role.key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 16 }}>{role.name}</h3>
                  <span className="badge badge-blue">{role.grants} Izin</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--color-muted)", minHeight: 48, margin: "6px 0 12px" }}>
                  {role.desc}
                </p>
                <div style={{ borderTop: "1px solid rgba(161,89,18,0.1)", paddingTop: 10, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-muted)" }}>Scope: <strong>{role.scope}</strong></span>
                  <span className="badge badge-gray">{role.key}</span>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
