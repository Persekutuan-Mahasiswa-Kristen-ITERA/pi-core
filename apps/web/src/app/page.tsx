"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type JSX } from "react";
import {
  Users,
  CalendarRange,
  ShieldCheck,
  Briefcase,
  Settings,
  Activity,
  ArrowRight,
  TrendingUp,
  Radio,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";
import { Sidebar, MobileNav } from "../components/Sidebar";
import { TopHeader } from "../components/TopHeader";
import { MemberSheet, type MemberForm } from "./member-sheet";
import { IntegrationsPanel } from "./integrations";
import { useRealtime } from "./realtime";
import { apiFetch } from "../lib/api-client";
import { API_BASE_URL } from "../lib/oidc";
import { useSession } from "../lib/session";

/** The subset of `GET /api/v1/members` this screen renders. */
interface MemberRow {
  id: string;
  name: string;
  email: string;
  nim: string | null;
  status: string;
}

export default function DashboardPage(): JSX.Element {
  const apiBaseUrl = API_BASE_URL;
  const { state: session } = useSession();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [liveActivities, setLiveActivities] = useState<Array<{ id: string; text: string; time: string; topic: string }>>([]);

  /**
   * Reads the six most recently updated members through the bearer-token client.
   *
   * `sensitiveIncluded` is deliberately not assumed: NIM is present only when the signed-in member
   * holds `member:read_sensitive` (FR-9), so a row without it renders a dash rather than a guess.
   */
  const loadMembers = useCallback(async (): Promise<void> => {
    if (session.status !== "authenticated") {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    setMembersError(null);
    try {
      const response = await apiFetch("/api/v1/members?limit=6");
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const payload = (await response.json()) as {
        items?: Array<{
          id: string;
          fullName?: string;
          email: string;
          nim?: string | null;
          status: string;
        }>;
      };
      setMembers(
        (payload.items ?? []).map((item) => ({
          id: item.id,
          name: item.fullName ?? item.email,
          email: item.email,
          nim: item.nim ?? null,
          status: item.status,
        })),
      );
    } catch (error) {
      setMembers([]);
      setMembersError(
        error instanceof Error ? error.message : "Gagal memuat anggota.",
      );
    } finally {
      setMembersLoading(false);
    }
  }, [session.status]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

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
        { id: `${event.topic}-${event.id}-${Date.now()}`, text: description, time: "Baru saja", topic: event.topic },
        ...prev.slice(0, 4),
      ]);
    },
  });

  /**
   * Creates the member through the API (FR-10: the request body is `.strict()`, so the payload is
   * built field by field and empty strings become `null` rather than being sent as "").
   */
  async function handleAddMember(form: MemberForm): Promise<void> {
    const orNull = (value: string): string | null =>
      value.trim() === "" ? null : value.trim();
    const cohortYear = form.cohortYear.trim() === "" ? null : Number(form.cohortYear);

    const response = await apiFetch("/api/v1/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        nim: orNull(form.nim),
        faculty: orNull(form.faculty),
        studyProgram: orNull(form.studyProgram),
        cohortYear,
        phone: orNull(form.phone),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setMembersError(
        payload?.error?.message ??
          `Gagal menyimpan anggota (HTTP ${String(response.status)}).`,
      );
      return;
    }

    await loadMembers();
  }

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Dashboard" />
        <main className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">Portal Manajemen Terpusat</p>
              <h1>Shalom, Pengurus PMK ITERA!</h1>
              <p className="subtitle">
                Pantau seluruh identitas anggota, struktur organisasi, izin peranan (RBAC), dan otentikasi SSO dalam satu dashboard.
              </p>
            </div>
            <MemberSheet onSave={(form) => void handleAddMember(form)} />
          </section>

          {/* Stat Cards */}
          <section className="stats">
            <article className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Total Anggota</span>
                <div className="stat-icon">
                  <Users size={18} />
                </div>
              </div>
              <strong className="stat-value">
                {session.status === "authenticated" ? members.length : "—"}
              </strong>
              <div className="stat-meta">
                <TrendingUp size={14} />
                <span>Terbaru dari API</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Periode Aktif</span>
                <div className="stat-icon" style={{ color: "#d97706", backgroundColor: "rgba(217, 119, 6, 0.1)" }}>
                  <CalendarRange size={18} />
                </div>
              </div>
              <strong className="stat-value">
                {session.status === "authenticated"
                  ? (session.access.activePeriod?.label ?? "Belum ada")
                  : "—"}
              </strong>
              <div className="stat-meta" style={{ color: "#059669" }}>
                <span className="badge-dot" style={{ backgroundColor: "#059669" }} />
                <span>Masa Bakti Berjalan</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Struktur Unit</span>
                <div className="stat-icon" style={{ color: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.1)" }}>
                  <Layers size={18} />
                </div>
              </div>
              <strong className="stat-value">25 Unit</strong>
              <div className="stat-meta neutral">
                <span>1 BPH · 8 Dept · 16 Divisi</span>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Peran & Izin RBAC</span>
                <div className="stat-icon" style={{ color: "#7c3aed", backgroundColor: "rgba(124, 58, 237, 0.1)" }}>
                  <ShieldCheck size={18} />
                </div>
              </div>
              <strong className="stat-value">10 Peran</strong>
              <div className="stat-meta neutral">
                <span>23 Granular Permissions</span>
              </div>
            </article>
          </section>

          {/* Main Grid */}
          <div className="grid">
            <article className="card card-hover">
              <div className="card-heading">
                <div>
                  <h2>Anggota Terdaftar Terbaru</h2>
                  <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                    Daftar mahasiswa yang baru saja diperbarui atau terdaftar
                  </p>
                </div>
                <Link className="button button-secondary" href="/anggota" style={{ minHeight: 34, padding: "6px 12px", fontSize: 12 }}>
                  <span>Lihat Semua</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mahasiswa</th>
                      <th>NIM</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.status !== "authenticated" ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "20px 16px", textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
                          Masuk dengan Google untuk melihat data anggota yang sebenarnya.
                        </td>
                      </tr>
                    ) : membersLoading ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "20px 16px", textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
                          Memuat anggota…
                        </td>
                      </tr>
                    ) : membersError !== null ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "20px 16px", textAlign: "center", color: "#b91c1c", fontSize: 13 }}>
                          {membersError}
                        </td>
                      </tr>
                    ) : members.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "20px 16px", textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
                          Belum ada anggota pada lingkup akun ini.
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div className="avatar avatar-sm">
                                {m.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <strong style={{ color: "var(--color-heading)", display: "block" }}>{m.name}</strong>
                                <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>{m.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: "var(--color-heading-secondary)" }}>{m.nim ?? "—"}</span>
                          </td>
                          <td>
                            <span className={m.status === "active" ? "badge badge-green" : "badge badge-gold"}>
                              <span className="badge-dot" />
                              {m.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link href="/anggota" className="button button-secondary" style={{ minHeight: 30, padding: "4px 10px", fontSize: 11.5 }}>
                              Detail
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {/* Quick Navigation Card */}
            <article className="card card-hover">
              <div className="card-heading">
                <div>
                  <h2>Akses Modul Cepat</h2>
                  <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                    Pintasan langsung ke modul sistem
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <Link className="button button-secondary" href="/anggota" style={{ justifyContent: "space-between", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 6, borderRadius: 8, backgroundColor: "rgba(90, 62, 27, 0.08)", color: "var(--color-primary)" }}>
                      <Users size={16} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <span style={{ fontWeight: 600, display: "block" }}>Direktori Anggota</span>
                      <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>Kelola 128 mahasiswa PMK</span>
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--color-muted)" }} />
                </Link>

                <Link className="button button-secondary" href="/penugasan" style={{ justifyContent: "space-between", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 6, borderRadius: 8, backgroundColor: "rgba(37, 99, 235, 0.08)", color: "#2563eb" }}>
                      <Briefcase size={16} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <span style={{ fontWeight: 600, display: "block" }}>Penugasan Jabatan</span>
                      <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>BPH, Kadep, Kadiv & Staff</span>
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--color-muted)" }} />
                </Link>

                <Link className="button button-secondary" href="/peran" style={{ justifyContent: "space-between", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 6, borderRadius: 8, backgroundColor: "rgba(124, 58, 237, 0.08)", color: "#7c3aed" }}>
                      <ShieldCheck size={16} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <span style={{ fontWeight: 600, display: "block" }}>Peran & Izin (RBAC)</span>
                      <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>Lingkup O, U, and S</span>
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--color-muted)" }} />
                </Link>

                <Link className="button button-secondary" href="/periode" style={{ justifyContent: "space-between", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 6, borderRadius: 8, backgroundColor: "rgba(217, 119, 6, 0.08)", color: "#d97706" }}>
                      <CalendarRange size={16} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <span style={{ fontWeight: 600, display: "block" }}>Periode Kepengurusan</span>
                      <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>Masa bakti & arsip sejarah</span>
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--color-muted)" }} />
                </Link>

                <Link className="button button-secondary" href="/pengaturan" style={{ justifyContent: "space-between", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 6, borderRadius: 8, backgroundColor: "rgba(71, 85, 105, 0.08)", color: "#475569" }}>
                      <Settings size={16} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <span style={{ fontWeight: 600, display: "block" }}>Pengaturan Organisasi</span>
                      <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>Domain @itera.ac.id whitelist</span>
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--color-muted)" }} />
                </Link>
              </div>
            </article>
          </div>

          {/* Real-time Activity Feed */}
          <section className="card card-hover" style={{ marginTop: 24 }}>
            <div className="card-heading">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Radio size={18} style={{ color: "#10b981" }} />
                <h2>Aktivitas Sistem Real-Time (Live Sync)</h2>
              </div>
              <Link className="button button-secondary" href="/audit-log" style={{ minHeight: 32, padding: "4px 10px", fontSize: 12 }}>
                <span>Log Audit Lengkap</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {liveActivities.length === 0 ? (
                <div style={{ padding: "12px 16px", borderRadius: 10, backgroundColor: "#fbfbfa", border: "1px solid rgba(0,0,0,0.04)", color: "var(--color-muted)", fontSize: 13 }}>
                  Belum ada aktivitas pada sesi ini. Peristiwa baru akan muncul di sini saat data berubah.
                </div>
              ) : null}
              {liveActivities.map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: 10,
                    backgroundColor: "#fbfbfa",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="badge-dot" style={{ backgroundColor: "#10b981", width: 8, height: 8 }} />
                    <span style={{ color: "var(--color-heading)", fontSize: 13.5, fontWeight: 500 }}>{act.text}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-muted)", fontSize: 12 }}>
                    <Clock size={12} />
                    <span>{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Integrations (OIDC) Panel */}
          <section className="card card-hover" style={{ marginTop: 24 }} id="integrations">
            <IntegrationsPanel apiBaseUrl={apiBaseUrl} />
          </section>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
