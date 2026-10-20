"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Sparkles,
  X,
  Plus,
  Calendar,
  RefreshCw,
  Users,
} from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";
import { apiFetch } from "../../lib/api-client";
import { useSession } from "../../lib/session";

/** `listPeriods` in `packages/db/src/periods.ts`. Dates arrive as `YYYY-MM-DD`. */
interface PeriodRow {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface PeriodsResponse {
  items: PeriodRow[];
  activePeriodId: string | null;
}

export default function PeriodePage(): JSX.Element {
  const session = useSession();
  const authenticated = session.state.status === "authenticated";

  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [modal, setModal] = useState(false);
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async (): Promise<void> => {
    if (!authenticated) {
      setPeriods([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/v1/periods");
      if (response.status === 401 || response.status === 403) {
        setError("Sesi ini tidak memiliki izin period:read.");
        setPeriods([]);
        return;
      }
      if (!response.ok) {
        setError(`Gagal memuat periode (HTTP ${String(response.status)}).`);
        return;
      }
      const body = (await response.json()) as PeriodsResponse;
      setPeriods(body.items);
    } catch {
      setError("Tidak dapat menghubungi API. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleActivate(period: PeriodRow): Promise<void> {
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const response = await apiFetch(`/api/v1/periods/${period.id}/activate`, { method: "POST" });
      if (response.status === 403) {
        setError("Peran Anda tidak memiliki izin period:activate.");
        return;
      }
      if (!response.ok) {
        setError(`Gagal mengaktifkan periode (HTTP ${String(response.status)}).`);
        return;
      }
      setNotice(`${period.label} sekarang menjadi periode aktif.`);
      await load();
    } catch {
      setError("Tidak dapat menghubungi API. Periode aktif belum berubah.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(): Promise<void> {
    if (label.trim() === "" || startDate === "" || endDate === "") {
      setError("Nama, tanggal mulai, dan tanggal selesai wajib diisi.");
      return;
    }

    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const response = await apiFetch("/api/v1/periods", {
        method: "POST",
        body: JSON.stringify({ label: label.trim(), startDate, endDate }),
      });
      if (response.status === 403) {
        setError("Peran Anda tidak memiliki izin period:manage.");
        return;
      }
      if (response.status === 409) {
        setError("Periode dengan nama tersebut sudah ada.");
        return;
      }
      if (response.status === 400) {
        setError("Tanggal tidak valid — selesai tidak boleh mendahului mulai.");
        return;
      }
      if (!response.ok) {
        setError(`Gagal menambah periode (HTTP ${String(response.status)}).`);
        return;
      }
      setLabel("");
      setStartDate("");
      setEndDate("");
      setModal(false);
      setNotice("Periode baru ditambahkan.");
      await load();
    } catch {
      setError("Tidak dapat menghubungi API. Periode belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }

  const activePeriod = periods.find((period) => period.isActive);

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
            <button
              className="button button-gold"
              type="button"
              onClick={() => setModal(true)}
              disabled={!authenticated}
              title={authenticated ? undefined : "Masuk terlebih dahulu"}
            >
              <Plus size={16} />
              <span>Tambah Periode Baru</span>
            </button>
          </div>

          {notice !== null ? (
            <div className="card" style={{ padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              {notice}
            </div>
          ) : null}

          {error !== null ? (
            <div
              className="card"
              style={{ padding: "10px 14px", marginBottom: 14, fontSize: 13, borderColor: "var(--color-negative)" }}
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

          {activePeriod !== undefined ? (
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
                  <span style={{ fontSize: 12, color: "var(--color-muted)" }}>Hanya satu periode aktif</span>
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--color-heading)", margin: "4px 0 8px" }}>
                  Masa Bakti Tahun {activePeriod.label}
                </h2>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--color-muted)",
                    fontSize: 13.5,
                  }}
                >
                  <Calendar size={15} style={{ color: "var(--color-accent)" }} />
                  <span>
                    Rentang waktu: <strong>{activePeriod.startDate}</strong> s/d{" "}
                    <strong>{activePeriod.endDate}</strong>
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span className="badge badge-gold" style={{ padding: "6px 14px", fontSize: 13, fontWeight: 700 }}>
                  <Sparkles size={14} />
                  <span>Sedang Berjalan</span>
                </span>
                <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
                  Semua penugasan merujuk ke periode ini
                </span>
              </div>
            </div>
          ) : null}

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
                  {!authenticated && !loading ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "48px 16px" }}>
                        <Users size={36} style={{ margin: "0 auto 12px", color: "var(--color-muted)", opacity: 0.5 }} />
                        <strong style={{ display: "block", color: "var(--color-heading)", fontSize: 15 }}>
                          Masuk untuk melihat periode
                        </strong>
                        <button
                          className="button button-primary"
                          type="button"
                          style={{ marginTop: 12 }}
                          onClick={() => void session.signIn()}
                        >
                          Masuk dengan Google
                        </button>
                      </td>
                    </tr>
                  ) : periods.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-muted)" }}
                      >
                        {loading ? "Memuat periode…" : "Belum ada periode kepengurusan."}
                      </td>
                    </tr>
                  ) : (
                    periods.map((period) => (
                      <tr key={period.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                padding: 6,
                                borderRadius: 8,
                                backgroundColor: period.isActive ? "rgba(230,198,92,0.2)" : "rgba(0,0,0,0.04)",
                              }}
                            >
                              <CalendarRange
                                size={16}
                                style={{ color: period.isActive ? "var(--color-accent)" : "var(--color-muted)" }}
                              />
                            </div>
                            <strong style={{ fontSize: 15, color: "var(--color-heading)" }}>{period.label}</strong>
                          </div>
                        </td>
                        <td>
                          <span style={{ color: "var(--color-heading-secondary)", fontWeight: 500 }}>
                            {period.startDate}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: "var(--color-heading-secondary)", fontWeight: 500 }}>
                            {period.endDate}
                          </span>
                        </td>
                        <td>
                          {period.isActive ? (
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
                          {period.isActive ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                color: "var(--color-positive)",
                                fontWeight: 700,
                                fontSize: 12.5,
                              }}
                            >
                              <CheckCircle2 size={15} />
                              <span>Periode Utama</span>
                            </span>
                          ) : (
                            <button
                              className="button button-secondary"
                              type="button"
                              style={{ minHeight: 32, padding: "4px 12px", fontSize: 12 }}
                              onClick={() => void handleActivate(period)}
                              disabled={busy}
                            >
                              Jadikan Periode Aktif
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {modal && (
            <div
              className="sheet-backdrop"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setModal(false);
              }}
            >
              <div className="card" style={{ width: 440, margin: "auto", padding: 28 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <h2>Tambah Periode Baru</h2>
                  <button className="icon-button" type="button" onClick={() => setModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <p className="subtitle" style={{ marginBottom: 18 }}>
                  Tambahkan tahun kepengurusan baru ke basis data.
                </p>
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="form-field">
                    <label>Nama Periode</label>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Contoh: 2027/2028"
                    />
                  </div>
                  <div className="form-field">
                    <label>Tanggal Mulai</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Tanggal Selesai</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    marginTop: 24,
                    paddingTop: 16,
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <button className="button button-secondary" type="button" onClick={() => setModal(false)}>
                    Batal
                  </button>
                  <button className="button button-gold" type="button" onClick={() => void handleCreate()} disabled={busy}>
                    {busy ? "Menyimpan…" : "Simpan Periode"}
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
