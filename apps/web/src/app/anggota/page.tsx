"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { Search, Filter, Users, Download, RefreshCw } from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";
import { apiFetch } from "../../lib/api-client";
import { useSession } from "../../lib/session";
import { MemberSheet, type MemberForm } from "../member-sheet";

/** Mirrors `listMembers` in `packages/db/src/members.ts` — the server decides which fields exist. */
interface MemberRow {
  id: string;
  email: string;
  fullName: string;
  status: "active" | "inactive";
  nim?: string | null;
  phone?: string | null;
}

interface MembersResponse {
  items: MemberRow[];
  nextCursor: string | null;
  /** False when the actor lacks `member:read_sensitive`; the UI must not imply the data is missing. */
  sensitiveIncluded: boolean;
}

const PAGE_SIZE = 50;

export default function AnggotaPage(): JSX.Element {
  const session = useSession();
  const authenticated = session.state.status === "authenticated";

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [sensitiveIncluded, setSensitiveIncluded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");

  const load = useCallback(async (): Promise<void> => {
    if (!authenticated) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/v1/members?limit=${String(PAGE_SIZE)}`);
      if (response.status === 401 || response.status === 403) {
        setError("Sesi ini tidak lagi memiliki akses ke direktori anggota.");
        setMembers([]);
        return;
      }
      if (!response.ok) {
        setError(`Gagal memuat anggota (HTTP ${String(response.status)}).`);
        return;
      }
      const body = (await response.json()) as MembersResponse;
      setMembers(body.items);
      setSensitiveIncluded(body.sensitiveIncluded);
    } catch {
      setError("Tidak dapat menghubungi API. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The dashboard creates through the same endpoint, so they share its `.strict()` body. */
  async function handleAdd(form: MemberForm): Promise<void> {
    setNotice(null);
    setError(null);
    try {
      const response = await apiFetch("/api/v1/members", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          fullName: form.fullName,
          nim: form.nim === "" ? null : form.nim,
          phone: form.phone === "" ? null : form.phone,
          faculty: form.faculty === "" ? null : form.faculty,
          studyProgram: form.studyProgram === "" ? null : form.studyProgram,
          cohortYear: form.cohortYear === "" ? null : Number(form.cohortYear),
        }),
      });

      if (response.status === 403) {
        setError("Peran Anda tidak memiliki izin member:create.");
        return;
      }
      if (response.status === 409) {
        setError("Email tersebut sudah terdaftar.");
        return;
      }
      if (!response.ok) {
        setError(`Gagal menambah anggota (HTTP ${String(response.status)}).`);
        return;
      }
      setNotice(`${form.fullName} ditambahkan.`);
      await load();
    } catch {
      setError("Tidak dapat menghubungi API. Anggota belum tersimpan.");
    }
  }

  /**
   * Deactivation is a one-way soft delete (`POST /members/:id/deactivate`) and there is no reactivate
   * endpoint, so the button only ever offers "Nonaktifkan" — an "Aktifkan" that cannot work would be a
   * lie the prototype told.
   */
  async function handleDeactivate(member: MemberRow): Promise<void> {
    if (!window.confirm(`Nonaktifkan ${member.fullName}? Akses mereka dicabut pada permintaan berikutnya.`)) {
      return;
    }
    setNotice(null);
    setError(null);
    try {
      const response = await apiFetch(`/api/v1/members/${member.id}/deactivate`, { method: "POST" });
      if (response.status === 403) {
        setError("Peran Anda tidak memiliki izin member:deactivate.");
        return;
      }
      if (!response.ok) {
        setError(`Gagal menonaktifkan anggota (HTTP ${String(response.status)}).`);
        return;
      }
      setNotice(`${member.fullName} dinonaktifkan.`);
      await load();
    } catch {
      setError("Tidak dapat menghubungi API. Status belum berubah.");
    }
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch =
        needle === "" ||
        member.fullName.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle) ||
        (member.nim ?? "").toLowerCase().includes(needle);
      const matchesStatus =
        statusFilter === "Semua" ||
        (statusFilter === "Aktif" ? member.status === "active" : member.status === "inactive");
      return matchesSearch && matchesStatus;
    });
  }, [members, search, statusFilter]);

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Manajemen Anggota" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Direktori Terpusat</p>
              <h1>Direktori Anggota PMK ITERA</h1>
              <p className="subtitle">
                Data langsung dari PI-CORE. Isi tabel dibatasi peran Anda: anggota di luar cakupan unit tidak
                dikirim server sama sekali.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="button button-secondary"
                type="button"
                disabled
                title="Ekspor belum tersedia — API belum punya endpoint ekspor."
              >
                <Download size={15} />
                <span>Ekspor CSV</span>
              </button>
              <MemberSheet onSave={(form) => void handleAdd(form)} />
            </div>
          </div>

          {notice !== null ? (
            <div className="card" style={{ padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
              {notice}
            </div>
          ) : null}

          {error !== null ? (
            <div
              className="card"
              style={{ padding: "10px 14px", marginBottom: 12, fontSize: 13, borderColor: "var(--color-negative)" }}
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

          <div className="filter-bar">
            <div className="search-input-group">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Cari berdasarkan nama, NIM, atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Filter size={15} style={{ color: "var(--color-muted)" }} />
              <select
                className="select-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Semua">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

            <span style={{ fontSize: 12.5, color: "var(--color-muted)", marginLeft: "auto", fontWeight: 500 }}>
              {loading
                ? "Memuat…"
                : `Menampilkan ${String(filtered.length)} dari ${String(members.length)} anggota`}
            </span>
          </div>

          <div className="card card-hover">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nama &amp; Email</th>
                    <th>NIM</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!authenticated && !loading ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "48px 16px" }}>
                        <Users size={36} style={{ margin: "0 auto 12px", color: "var(--color-muted)", opacity: 0.5 }} />
                        <strong style={{ display: "block", color: "var(--color-heading)", fontSize: 15 }}>
                          Masuk untuk melihat direktori
                        </strong>
                        <p style={{ margin: "4px 0 12px", color: "var(--color-muted)", fontSize: 13 }}>
                          Direktori berisi data pribadi, jadi tidak ditampilkan sebelum Anda masuk.
                        </p>
                        <button className="button button-primary" type="button" onClick={() => void session.signIn()}>
                          Masuk dengan Google
                        </button>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "48px 16px" }}>
                        <Users size={36} style={{ margin: "0 auto 12px", color: "var(--color-muted)", opacity: 0.5 }} />
                        <strong style={{ display: "block", color: "var(--color-heading)", fontSize: 15 }}>
                          {loading
                            ? "Memuat anggota…"
                            : members.length === 0
                              ? "Belum ada anggota"
                              : "Tidak ada anggota ditemukan"}
                        </strong>
                        <p style={{ margin: "4px 0 0", color: "var(--color-muted)", fontSize: 13 }}>
                          {members.length === 0
                            ? "Tambahkan anggota pertama lewat tombol di kanan atas."
                            : "Coba ganti kata kunci pencarian atau filter status."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div className="avatar avatar-sm">
                              {member.fullName
                                .split(" ")
                                .map((part) => part[0])
                                .slice(0, 2)
                                .join("")}
                            </div>
                            <div>
                              <strong style={{ color: "var(--color-heading)", display: "block", fontSize: 14 }}>
                                {member.fullName}
                              </strong>
                              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{member.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {member.nim != null && member.nim !== "" ? (
                            <strong style={{ color: "var(--color-heading-secondary)" }}>{member.nim}</strong>
                          ) : (
                            <span style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
                              {sensitiveIncluded ? "—" : "Tidak berhak"}
                            </span>
                          )}
                        </td>
                        <td>
                          {member.status === "active" ? (
                            <span className="badge badge-green">
                              <span className="badge-dot" />
                              Aktif
                            </span>
                          ) : (
                            <span className="badge badge-gray">
                              <span className="badge-dot" />
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <MemberSheet
                              mode="edit"
                              initialValues={{
                                fullName: member.fullName,
                                email: member.email,
                                nim: member.nim ?? "",
                                faculty: "",
                                studyProgram: "",
                                cohortYear: "",
                                phone: member.phone ?? "",
                              }}
                              onSave={() => {
                                setNotice("Penyuntingan belum tersambung ke API — tidak ada perubahan yang disimpan.");
                              }}
                            />
                            <button
                              className="button button-secondary"
                              type="button"
                              style={{ minHeight: 32, padding: "4px 10px", fontSize: 12 }}
                              onClick={() => void handleDeactivate(member)}
                              disabled={member.status === "inactive"}
                              title={member.status === "active" ? "Nonaktifkan anggota" : "Anggota ini sudah nonaktif"}
                            >
                              {member.status === "active" ? (
                                <span style={{ color: "var(--color-negative)" }}>Nonaktifkan</span>
                              ) : (
                                <span style={{ color: "var(--color-positive)" }}>Nonaktif</span>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
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
