"use client";

import { useState, type JSX } from "react";
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

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Periode Kepengurusan" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Masa Bakti</p>
              <h1>Periode Kepengurusan</h1>
              <p className="subtitle">Atur periode kepengurusan aktif dan arsip masa bakti PMK ITERA.</p>
            </div>
            <button className="button" type="button" onClick={() => setModal(true)}>
              + Tambah Periode
            </button>
          </div>

          {periods.filter((p) => p.isActive).map((active) => (
            <div className="period-banner" key={active.id}>
              <div>
                <span className="badge badge-green" style={{ marginBottom: 6 }}>● PERIODE AKTIF SAAT INI</span>
                <h2 style={{ fontSize: 24, margin: "4px 0" }}>Tahun Kepengurusan {active.name}</h2>
                <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>
                  Rentang waktu: <strong>{active.startDate}</strong> s/d <strong>{active.endDate}</strong>.
                </p>
              </div>
              <span className="status">Sedang Berjalan</span>
            </div>
          ))}

          <div className="card">
            <div className="card-heading">
              <h2>Riwayat Semua Periode</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tahun Periode</th>
                    <th>Tanggal Mulai</th>
                    <th>Tanggal Selesai</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.startDate}</td>
                      <td>{p.endDate}</td>
                      <td>
                        <span className={`status ${p.isActive ? "" : "badge-gray"}`}>
                          {p.isActive ? "Aktif" : "Selesai"}
                        </span>
                      </td>
                      <td>
                        {p.isActive ? (
                          <span style={{ fontSize: 12, color: "var(--color-positive)", fontWeight: 700 }}>
                            ✓ Sedang Aktif
                          </span>
                        ) : (
                          <button
                            className="button button-secondary"
                            type="button"
                            style={{ minHeight: 32, padding: "4px 12px", fontSize: 11 }}
                            onClick={() => handleActivate(p.id)}
                          >
                            Aktifkan Periode Ini
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {modal && (
            <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
              <div className="card" style={{ width: 440, margin: "auto", padding: 28 }}>
                <h2>Tambah Periode Baru</h2>
                <p className="subtitle" style={{ marginBottom: 16 }}>Tambahkan tahun kepengurusan baru.</p>
                <div style={{ display: "grid", gap: 12 }}>
                  <div className="form-field">
                    <label>Nama Periode (contoh: 2027/2028)</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="2027/2028"
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
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                  <button className="button button-secondary" type="button" onClick={() => setModal(false)}>
                    Batal
                  </button>
                  <button className="button" type="button" onClick={handleCreate}>
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
