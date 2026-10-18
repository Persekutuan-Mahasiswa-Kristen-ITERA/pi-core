"use client";

import { useState, type JSX } from "react";
import { Activity, Shield, Filter, Lock, Clock, Globe, Terminal } from "lucide-react";
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
              <h1>Log Audit Keamanan (Append-Only)</h1>
              <p className="subtitle">
                Catatan mutasi data permanen yang tidak dapat diubah maupun dihapus (Anti-Tamper DB Trigger aktif).
              </p>
            </div>
            <span className="badge badge-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
              <Lock size={13} />
              <span>Immutable Anti-Tamper Trigger Active</span>
            </span>
          </div>

          <div className="filter-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Filter size={15} style={{ color: "var(--color-muted)" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-heading)" }}>Filter Aksi:</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Semua", "CREATE", "UPDATE", "DELETE", "ACTIVATE", "ROTATE_SECRET"].map((act) => (
                <button
                  key={act}
                  type="button"
                  className={`button ${filter === act ? "button-gold" : "button-secondary"}`}
                  style={{ minHeight: 32, padding: "4px 12px", fontSize: 12 }}
                  onClick={() => setFilter(act)}
                >
                  {act}
                </button>
              ))}
            </div>
          </div>

          <div className="card card-hover">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu Kejadian</th>
                    <th>Tipe Aksi</th>
                    <th>Aktor Pengguna</th>
                    <th>Entitas Target</th>
                    <th>Rincian Operasi</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)", fontSize: 12.5 }}>
                          <Clock size={13} />
                          <span>{a.timestamp}</span>
                        </div>
                      </td>
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
                          <span className="badge-dot" />
                          {a.action}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 13.5, color: "var(--color-heading)" }}>{a.actor}</strong>
                      </td>
                      <td>
                        <code
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            backgroundColor: "rgba(0,0,0,0.05)",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {a.entity}
                        </code>
                      </td>
                      <td style={{ maxWidth: 360, color: "var(--color-body)", fontSize: 13 }}>
                        {a.details}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)", fontSize: 12 }}>
                          <Globe size={13} />
                          <span>{a.ip}</span>
                        </div>
                      </td>
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
