"use client";

import { useState, type JSX } from "react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";

type AuditItem = {
  id: string;
  actor: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "ROTATE_SECRET" | "ACTIVATE";
  entity: string;
  details: string;
  timestamp: string;
  ip: string;
};

const INITIAL_AUDITS: AuditItem[] = [
  { id: "aud_1", actor: "febryan.admin@itera.ac.id", action: "ACTIVATE", entity: "period", details: "Periode 2026/2027 diaktifkan (periods_single_active_uq enforced)", timestamp: "Hari ini, 07:15", ip: "103.111.201.4" },
  { id: "aud_2", actor: "febryan.admin@itera.ac.id", action: "CREATE", entity: "member", details: "Menambahkan anggota baru Grace Lumbantoruan (Farmasi)", timestamp: "Kemarin, 14:22", ip: "103.111.201.4" },
  { id: "aud_3", actor: "febryan.admin@itera.ac.id", action: "CREATE", entity: "assignment", details: "Penugasan Kepala Divisi Ibadah: Daniel Hutapea", timestamp: "16 Okt 2026, 11:05", ip: "103.111.201.4" },
  { id: "aud_4", actor: "febryan.admin@itera.ac.id", action: "ROTATE_SECRET", entity: "integration", details: "Rotasi rahasia OAuth Client PI-NEXUS (AES-256 encrypted)", timestamp: "15 Okt 2026, 18:40", ip: "103.111.201.4" },
  { id: "aud_5", actor: "febryan.admin@itera.ac.id", action: "UPDATE", entity: "settings", details: "Pembaruan domain whitelist email ITERA", timestamp: "15 Okt 2026, 10:12", ip: "103.111.201.4" },
];

export default function AuditLogPage(): JSX.Element {
  const [filter, setFilter] = useState("Semua");

  const filtered = INITIAL_AUDITS.filter((a) => {
    if (filter === "Semua") return true;
    return a.action === filter;
  });

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Log Audit Keamanan" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Keamanan & Kepatuhan</p>
              <h1>Audit Log Append-Only</h1>
              <p className="subtitle">Catatan audit permanen yang tidak dapat diubah maupun dihapus (Anti-Tamper DB Trigger).</p>
            </div>
            <span className="badge badge-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
              🛡️ Immutable DB Trigger Active
            </span>
          </div>

          <div className="filter-bar">
            <span style={{ fontSize: 13, fontWeight: 700 }}>Filter Aksi:</span>
            {["Semua", "CREATE", "UPDATE", "DELETE", "ACTIVATE", "ROTATE_SECRET"].map((act) => (
              <button
                key={act}
                type="button"
                className={`button ${filter === act ? "" : "button-secondary"}`}
                style={{ minHeight: 34, padding: "4px 12px", fontSize: 11 }}
                onClick={() => setFilter(act)}
              >
                {act}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Aksi</th>
                    <th>Aktor</th>
                    <th>Entitas Target</th>
                    <th>Rincian Perubahan</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td><span style={{ fontSize: 12, color: "var(--color-muted)" }}>{a.timestamp}</span></td>
                      <td>
                        <span
                          className={`badge ${
                            a.action === "CREATE"
                              ? "badge-green"
                              : a.action === "ACTIVATE"
                              ? "badge-gold"
                              : a.action === "ROTATE_SECRET"
                              ? "badge-blue"
                              : "badge-gray"
                          }`}
                        >
                          {a.action}
                        </span>
                      </td>
                      <td><strong>{a.actor}</strong></td>
                      <td><code>{a.entity}</code></td>
                      <td style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.details}
                      </td>
                      <td><span style={{ fontSize: 11, color: "var(--color-muted)" }}>{a.ip}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
