"use client";

import type { JSX } from "react";
import { ShieldCheck, Shield, Key, Layers, Lock, CheckCircle2 } from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";

const ROLES_CATALOG = [
  { key: "super_admin", name: "Super Admin", scope: "O (Full Scope)", isSystem: true, grants: 22, desc: "Hak penuh mutlak atas seluruh sistem, konfigurasi organisasi, integrasi OIDC, audit log, dan manajemen peran." },
  { key: "organization_admin", name: "Organization Admin", scope: "O (Organisasi)", isSystem: true, grants: 17, desc: "Pengelola operasional organisasi, data anggota, periode kepengurusan, dan penugasan jabatan." },
  { key: "bph", name: "BPH (Badan Pengurus Harian)", scope: "O (Organisasi)", isSystem: true, grants: 7, desc: "Ketua Umum, Wakil Ketua, Sekretaris Umum, dan Bendahara Umum PMK ITERA." },
  { key: "kepala_departemen", name: "Kepala Departemen / Biro", scope: "U (Subtree Unit)", isSystem: true, grants: 7, desc: "Memimpin departemen/biro pelaksana serta seluruh divisi yang berada di bawah hierarkinya." },
  { key: "sekretaris", name: "Sekretaris Departemen", scope: "U (Subtree Unit)", isSystem: true, grants: 9, desc: "Mengelola administrasi persuratan dan pembacaan keanggotaan dalam unitnya." },
  { key: "kepala_divisi", name: "Kepala Divisi", scope: "U (Divisi)", isSystem: true, grants: 6, desc: "Memimpin pelaksanaan program kerja spesifik pada divisi operasional tertentu." },
  { key: "staff", name: "Staff Divisi", scope: "U (Divisi)", isSystem: true, grants: 5, desc: "Pengurus aktif dalam divisi operasional pelaksana kegiatan." },
  { key: "bendahara", name: "Bendahara", scope: "U (Biro Kas)", isSystem: true, grants: 4, desc: "Marker role dengan hak akses khusus pencatatan dan pelaporan kas organisasi." },
  { key: "panitia", name: "Panitia Acara", scope: "U (Event Scope)", isSystem: true, grants: 4, desc: "Hak penugasan sementara khusus kepanitiaan acara perayaan Natal & Paskah." },
  { key: "anggota", name: "Anggota Biasa", scope: "S (Data Mandiri)", isSystem: true, grants: 4, desc: "Anggota umum terdaftar PMK ITERA (akses mandiri direktori, profil, dan kontak)." },
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
              <p className="eyebrow">Role-Based Access Control (RBAC)</p>
              <h1>Katalog Peran & Izin Otorisasi</h1>
              <p className="subtitle">
                10 peran resmi organisasi dengan 23 granular permissions, validasi guard bertingkat, dan hierarki rank.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="badge badge-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
                <Lock size={13} />
                <span>100% Immutable System Roles</span>
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
            {ROLES_CATALOG.map((role) => (
              <article className="card card-hover" key={role.key} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 8, borderRadius: 10, backgroundColor: "rgba(124, 58, 237, 0.08)", color: "#7c3aed" }}>
                      <Shield size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>{role.name}</h3>
                      <span style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "monospace" }}>{role.key}</span>
                    </div>
                  </div>
                  <span className="badge badge-blue">
                    <Key size={11} />
                    <span>{role.grants} Izin</span>
                  </span>
                </div>

                <p style={{ fontSize: 13, color: "var(--color-body)", margin: "0 0 16px", flex: 1, lineHeight: 1.5 }}>
                  {role.desc}
                </p>

                <div
                  style={{
                    borderTop: "1px solid rgba(0, 0, 0, 0.06)",
                    paddingTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)" }}>
                    <Layers size={13} />
                    <span>Lingkup: <strong>{role.scope}</strong></span>
                  </div>
                  <span className="badge badge-green" style={{ fontSize: 10 }}>
                    <CheckCircle2 size={10} />
                    Terpasang
                  </span>
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
