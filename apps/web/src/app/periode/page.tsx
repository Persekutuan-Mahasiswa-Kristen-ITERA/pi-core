"use client";

import { useState, type JSX } from "react";
import { CalendarRange, CalendarPlus, CheckCircle2, Clock, Sparkles, X, Plus, Calendar } from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";

type PeriodItem = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

const INITIAL_PERIODS: PeriodItem[] = [
  { id: "per_2026", name: "2026/2027", startDate: "2026-08-01", endDate: "2027-07-31", isActive: true },
  { id: "per_2025", name: "2025/2026", startDate: "2025-08-01", endDate: "2026-07-31", isActive: false },
  { id: "per_2024", name: "2024/2025", startDate: "2024-08-01", endDate: "2025-07-31", isActive: false },
];

export default function PeriodePage(): JSX.Element {
  const [periods, setPeriods] = useState<PeriodItem[]>(INITIAL_PERIODS);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function handleActivate(id: string) {
    setPeriods((prev) => prev.map((p) => ({ ...p, isActive: p.id === id })));
  }

  function handleCreate() {
    if (!name.trim()) return;
    const newP: PeriodItem = {
      id: `per_${Date.now()}`,
      name,
      startDate: startDate || "2027-08-01",
      endDate: endDate || "2028-07-31",
      isActive: false,
    };
    setPeriods((prev) => [...prev, newP]);
    setName("");
    setStartDate("");
    setEndDate("");
    setModal(false);
  }

  const activePeriod = periods.find((p) => p.isActive);

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Periode Kepengurusan" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Manajemen Masa Bakti</p>
              <h1>Periode Kepengurusan</h1>
              <p className="subtitle">
                Atur tahun kepengurusan aktif dan kelola arsip sejarah kepengurusan organisasi PMK ITERA.
              </p>
            </div>
            <button className="button button-gold" type="button" onClick={() => setModal(true)}>
              <Plus size={16} />
              <span>Tambah Periode Baru</span>
            </button>
          </div>

          {/* Active Period Hero Banner */}
          {activePeriod && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(90, 62, 27, 0.08) 0%, rgba(230, 198, 92, 0.16) 100%)",
                border: "1.5px solid var(--color-gold)",
                borderRadius: "var(--radius-card)",
                padding: "26px 28px",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 4px 20px -2px rgba(230, 198, 92, 0.15)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span className="badge badge-green">
                    <span className="badge-dot" />
                    PERIODE AKTIF SAAT INI
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-muted)" }}>Database Constraint: Single Active</span>
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--color-heading)", margin: "4px 0 8px" }}>
                  Masa Bakti Tahun {activePeriod.name}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-muted)", fontSize: 13.5 }}>
                  <Calendar size={15} style={{ color: "var(--color-accent)" }} />
                  <span>
                    Rentang waktu: <strong>{activePeriod.startDate}</strong> s/d <strong>{activePeriod.endDate}</strong>
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span className="badge badge-gold" style={{ padding: "6px 14px", fontSize: 13, fontWeight: 700 }}>
                  <Sparkles size={14} />
                  <span>Sedang Berjalan</span>
                </span>
                <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>Semua penugasan merujuk ke periode ini</span>
              </div>
            </div>
          )}

          {/* Periods Table */}
          <div className="card card-hover">
            <div className="card-heading">
              <div>
                <h2>Riwayat Semua Periode Kepengurusan</h2>
                <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                  Hanya 1 periode yang dapat berstatus aktif sekaligus.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tahun Kepengurusan</th>
                    <th>Tanggal Mulai</th>
                    <th>Tanggal Selesai</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Aksi Otorisasi</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ padding: 6, borderRadius: 8, backgroundColor: p.isActive ? "rgba(230,198,92,0.2)" : "rgba(0,0,0,0.04)" }}>
                            <CalendarRange size={16} style={{ color: p.isActive ? "var(--color-accent)" : "var(--color-muted)" }} />
                          </div>
                          <strong style={{ fontSize: 15, color: "var(--color-heading)" }}>{p.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: "var(--color-heading-secondary)", fontWeight: 500 }}>{p.startDate}</span>
                      </td>
                      <td>
                        <span style={{ color: "var(--color-heading-secondary)", fontWeight: 500 }}>{p.endDate}</span>
                      </td>
                      <td>
                        {p.isActive ? (
                          <span className="badge badge-green">
                            <span className="badge-dot" />
                            Aktif Sekarang
                          </span>
                        ) : (
                          <span className="badge badge-gray">
                            <span className="badge-dot" />
                            Arsip Sejarah
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {p.isActive ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--color-positive)", fontWeight: 700, fontSize: 12.5 }}>
                            <CheckCircle2 size={15} />
                            <span>Periode Utama</span>
                          </span>
                        ) : (
                          <button
                            className="button button-secondary"
                            type="button"
                            style={{ minHeight: 32, padding: "4px 12px", fontSize: 12 }}
                            onClick={() => handleActivate(p.id)}
                          >
                            Jadikan Periode Aktif
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal */}
          {modal && (
            <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
              <div className="card" style={{ width: 440, margin: "auto", padding: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2>Tambah Periode Baru</h2>
                  <button className="icon-button" type="button" onClick={() => setModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <p className="subtitle" style={{ marginBottom: 18 }}>Tambahkan tahun kepengurusan baru ke basis data.</p>
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="form-field">
                    <label>Nama Periode</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: 2027/2028"
                    />
                  </div>
                  <div className="form-field">
                    <label>Tanggal Mulai</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Tanggal Selesai</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <button className="button button-secondary" type="button" onClick={() => setModal(false)}>
                    Batal
                  </button>
                  <button className="button button-gold" type="button" onClick={handleCreate}>
                    Simpan Periode
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
