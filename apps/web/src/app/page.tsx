"use client";

import Link from "next/link";
import { useState, type JSX } from "react";
import { Sidebar, MobileNav } from "../components/Sidebar";
import { TopHeader } from "../components/TopHeader";
import { MemberSheet, type MemberForm } from "./member-sheet";
import { IntegrationsPanel } from "./integrations";
import { useRealtime } from "./realtime";

export default function DashboardPage(): JSX.Element {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://pi-core-api-staging.pmkitera.workers.dev";
  const [members, setMembers] = useState([
    { id: "1", name: "Jonathan Sitorus", role: "Ketua Umum", unit: "BPH", status: "Aktif" },
    { id: "2", name: "Maria Simanjuntak", role: "Sekretaris", unit: "Dept Pelayanan", status: "Aktif" },
    { id: "3", name: "Daniel Hutapea", role: "Kepala Divisi", unit: "Divisi Ibadah", status: "Aktif" },
    { id: "4", name: "Grace Lumbantoruan", role: "Staff", unit: "Divisi Media", status: "Aktif" },
  ]);

  const [liveActivities, setLiveActivities] = useState<Array<{ id: string; text: string; time: string }>>([
    { id: "init_1", text: "Periode 2026/2027 diaktifkan (periods_single_active_uq)", time: "Hari ini, 07:15" },
    { id: "init_2", text: "Penugasan pengurus Divisi Ibadah disetujui", time: "Kemarin, 16:20" },
  ]);

  useRealtime({
    apiBaseUrl,
    onEvent: (event) => {
      let description = `Pembaruan data pada ${event.topic} (${event.action})`;
      if (event.topic === "members") description = `Data anggota diperbarui (${event.action})`;
      else if (event.topic === "periods") description = `Periode organisasi diperbarui (${event.action})`;
      else if (event.topic === "integrations") description = `Integrasi OAuth diperbarui (${event.action})`;
      else if (event.topic === "assignments") description = `Penugasan organisasi diperbarui (${event.action})`;
      else if (event.topic === "roles") description = `Peran atau hak akses diperbarui (${event.action})`;
      else if (event.topic === "settings") description = `Pengaturan organisasi diperbarui (${event.action})`;

      setLiveActivities((prev) => [
        { id: `${event.topic}-${event.id}-${Date.now()}`, text: description, time: "Baru saja" },
        ...prev.slice(0, 4),
      ]);
    },
  });

  function handleAddMember(form: MemberForm) {
    setMembers((prev) => [
      { id: String(Date.now()), name: form.fullName, role: "Anggota", unit: "Anggota Umum", status: "Aktif" },
      ...prev,
    ]);
  }

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Dashboard" />
        <main className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">Portal Manajemen</p>
              <h1>Shalom, Pengurus!</h1>
              <p className="subtitle">Pantau dan kelola seluruh identitas organisasi PMK ITERA dari satu tempat.</p>
            </div>
            <MemberSheet onSave={handleAddMember} />
          </section>

          <section className="stats">
            <article className="card">
              <span className="stat-label">TOTAL ANGGOTA</span>
              <strong className="stat-value">{members.length + 124}</strong>
              <span className="stat-meta">↑ Terdaftar aktif</span>
            </article>
            <article className="card">
              <span className="stat-label">PERIODE AKTIF</span>
              <strong className="stat-value">2026/2027</strong>
              <span className="stat-meta neutral">Status: Berjalan</span>
            </article>
            <article className="card">
              <span className="stat-label">HAK AKSES / PERAN</span>
              <strong className="stat-value">10</strong>
              <span className="stat-meta neutral">23 Granular Permissions</span>
            </article>
          </section>

          <div className="grid">
            <article className="card">
              <div className="card-heading">
                <h2>Anggota Terdaftar Terbaru</h2>
                <Link className="text-link" href="/anggota">
                  Buka Halaman Anggota →
                </Link>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Unit</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td><strong>{m.name}</strong></td>
                        <td>{m.unit}</td>
                        <td><span className="status">{m.status}</span></td>
                        <td>
                          <Link href="/anggota" className="button button-secondary" style={{ minHeight: 32, padding: "4px 10px", fontSize: 11 }}>
                            Kelola
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="card">
              <div className="card-heading">
                <h2>Menu Navigasi Cepat</h2>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <Link className="button button-secondary" href="/anggota">
                  👥 Direktori Anggota
                </Link>
                <Link className="button button-secondary" href="/penugasan">
                  📋 Buat Penugasan Jabatan
                </Link>
                <Link className="button button-secondary" href="/periode">
                  📅 Kelola Periode Kepengurusan
                </Link>
                <Link className="button button-secondary" href="/peran">
                  🛡️ Matriks Peran & Hak Akses
                </Link>
                <Link className="button button-secondary" href="/pengaturan">
                  ⚙️ Pengaturan & Domain Whitelist
                </Link>
                <Link className="button button-secondary" href="/audit-log">
                  📜 Log Audit Keamanan
                </Link>
              </div>
            </article>
          </div>

          <section className="card" style={{ marginTop: 24 }}>
            <div className="card-heading">
              <h2>Aktivitas Sistem Terakhir (Real-Time Live)</h2>
              <Link className="text-link" href="/audit-log">
                Buka Log Lengkap →
              </Link>
            </div>
            <ul className="activity-list">
              {liveActivities.map((act) => (
                <li className="activity" key={act.id}>
                  <span className="activity-dot" style={{ backgroundColor: "#10b981" }} aria-hidden="true" />
                  <div>
                    <p><strong>{act.text}</strong></p>
                    <time>{act.time}</time>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card" style={{ marginTop: 24 }} id="integrations">
            <IntegrationsPanel apiBaseUrl={apiBaseUrl} />
          </section>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
