"use client";

import { useState, type JSX } from "react";
import { Search, Filter, CheckCircle, XCircle, Users, Download } from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";
import { MemberSheet, type MemberForm } from "../member-sheet";

type MemberItem = {
  id: string;
  fullName: string;
  email: string;
  nim: string;
  faculty: string;
  studyProgram: string;
  cohortYear: string;
  phone: string;
  unit: string;
  role: string;
  status: "Aktif" | "Nonaktif";
};

const INITIAL_MEMBERS: MemberItem[] = [
  { id: "mem_1", fullName: "Jonathan Sitorus", email: "jonathan.sitorus@itera.ac.id", nim: "121140022", faculty: "FTI", studyProgram: "Teknik Informatika", cohortYear: "2021", phone: "+6281234567890", unit: "BPH", role: "Ketua Umum", status: "Aktif" },
  { id: "mem_2", fullName: "Maria Simanjuntak", email: "maria.simanjuntak@student.itera.ac.id", nim: "122140088", faculty: "FTI", studyProgram: "Teknik Informatika", cohortYear: "2022", phone: "+6281234567891", unit: "Departemen Pelayanan", role: "Sekretaris", status: "Aktif" },
  { id: "mem_3", fullName: "Daniel Hutapea", email: "daniel.hutapea@student.itera.ac.id", nim: "122130045", faculty: "FTI", studyProgram: "Teknik Elektro", cohortYear: "2022", phone: "+6281234567892", unit: "Divisi Ibadah", role: "Kepala Divisi", status: "Aktif" },
  { id: "mem_4", fullName: "Grace Lumbantoruan", email: "grace.lumban@student.itera.ac.id", nim: "123140012", faculty: "FS", studyProgram: "Farmasi", cohortYear: "2023", phone: "+6281234567893", unit: "Divisi Media", role: "Staff", status: "Aktif" },
  { id: "mem_5", fullName: "Samuel Nababan", email: "samuel.nababan@student.itera.ac.id", nim: "121110034", faculty: "FTSP", studyProgram: "Teknik Sipil", cohortYear: "2021", phone: "+6281234567894", unit: "Biro Bendahara", role: "Bendahara Umum", status: "Aktif" },
  { id: "mem_6", fullName: "Debora Pasaribu", email: "debora.pasaribu@student.itera.ac.id", nim: "123120056", faculty: "FTI", studyProgram: "Teknik Geomatika", cohortYear: "2023", phone: "+6281234567895", unit: "Divisi Doa", role: "Staff", status: "Aktif" },
];

export default function AnggotaPage(): JSX.Element {
  const [members, setMembers] = useState<MemberItem[]>(INITIAL_MEMBERS);
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");

  function handleAdd(form: MemberForm) {
    const newM: MemberItem = {
      id: `mem_${Date.now()}`,
      fullName: form.fullName,
      email: form.email,
      nim: form.nim || "124140001",
      faculty: form.faculty || "FTI",
      studyProgram: form.studyProgram || "Teknik Informatika",
      cohortYear: form.cohortYear || "2024",
      phone: form.phone || "-",
      unit: "Anggota Biasa",
      role: "Anggota",
      status: "Aktif",
    };
    setMembers((prev) => [newM, ...prev]);
  }

  function handleToggleStatus(id: string) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: m.status === "Aktif" ? "Nonaktif" : "Aktif" } : m)),
    );
  }

  const filtered = members.filter((m) => {
    const matchSearch =
      m.fullName.toLowerCase().includes(search.toLowerCase()) ||
      m.nim.includes(search) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchUnit = unitFilter === "Semua" || m.unit.includes(unitFilter);
    const matchStatus = statusFilter === "Semua" || m.status === statusFilter;
    return matchSearch && matchUnit && matchStatus;
  });

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
                Kelola data profil, verifikasi email resmi ITERA, status keaktifan, dan penugasan unit organisasi.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => alert("Mengekspor direktori ke CSV...")}
              >
                <Download size={15} />
                <span>Ekspor CSV</span>
              </button>
              <MemberSheet onSave={handleAdd} />
            </div>
          </div>

          {/* Filter Bar */}
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
              <select className="select-input" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                <option value="Semua">Semua Unit</option>
                <option value="BPH">BPH</option>
                <option value="Pelayanan">Departemen Pelayanan</option>
                <option value="Media">Divisi Media</option>
                <option value="Ibadah">Divisi Ibadah</option>
                <option value="Doa">Divisi Doa</option>
                <option value="Bendahara">Biro Bendahara</option>
              </select>

              <select className="select-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="Semua">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

            <span style={{ fontSize: 12.5, color: "var(--color-muted)", marginLeft: "auto", fontWeight: 500 }}>
              Menampilkan <strong>{filtered.length}</strong> dari {members.length} anggota
            </span>
          </div>

          {/* Members Table */}
          <div className="card card-hover">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nama & Email</th>
                    <th>NIM & Angkatan</th>
                    <th>Fakultas / Prodi</th>
                    <th>Penugasan Unit</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "48px 16px" }}>
                        <Users size={36} style={{ margin: "0 auto 12px", color: "var(--color-muted)", opacity: 0.5 }} />
                        <strong style={{ display: "block", color: "var(--color-heading)", fontSize: 15 }}>
                          Tidak ada anggota ditemukan
                        </strong>
                        <p style={{ margin: "4px 0 0", color: "var(--color-muted)", fontSize: 13 }}>
                          Coba ganti kata kunci pencarian atau sesuaikan filter unit/status.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div className="avatar avatar-sm">
                              {m.fullName.split(" ").map(n => n[0]).slice(0, 2).join("")}
                            </div>
                            <div>
                              <strong style={{ color: "var(--color-heading)", display: "block", fontSize: 14 }}>
                                {m.fullName}
                              </strong>
                              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{m.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: "var(--color-heading-secondary)" }}>{m.nim}</strong>
                          <span style={{ fontSize: 12, color: "var(--color-muted)", display: "block" }}>
                            Angkatan {m.cohortYear}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: "var(--color-heading-secondary)", fontWeight: 500 }}>{m.studyProgram}</span>
                          <span style={{ fontSize: 12, color: "var(--color-muted)", display: "block" }}>{m.faculty}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span className="badge badge-gold">{m.unit}</span>
                            <span style={{ fontSize: 11, color: "var(--color-muted)", paddingLeft: 4 }}>{m.role}</span>
                          </div>
                        </td>
                        <td>
                          {m.status === "Aktif" ? (
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
                                fullName: m.fullName,
                                email: m.email,
                                nim: m.nim,
                                faculty: m.faculty,
                                studyProgram: m.studyProgram,
                                cohortYear: m.cohortYear,
                                phone: m.phone,
                              }}
                              onSave={(updated) => {
                                setMembers((prev) => prev.map((item) => (item.id === m.id ? { ...item, ...updated } : item)));
                              }}
                            />
                            <button
                              className="button button-secondary"
                              type="button"
                              style={{ minHeight: 32, padding: "4px 10px", fontSize: 12 }}
                              onClick={() => handleToggleStatus(m.id)}
                              title={m.status === "Aktif" ? "Nonaktifkan anggota" : "Aktifkan anggota"}
                            >
                              {m.status === "Aktif" ? (
                                <span style={{ color: "var(--color-negative)" }}>Nonaktifkan</span>
                              ) : (
                                <span style={{ color: "var(--color-positive)" }}>Aktifkan</span>
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
