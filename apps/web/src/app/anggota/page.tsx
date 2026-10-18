"use client";

import { useState, type JSX } from "react";
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
      unit: "Anggota Umum",
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
    return matchSearch && matchUnit;
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
              <h1>Manajemen Anggota</h1>
              <p className="subtitle">Kelola seluruh data mahasiswa, status keanggotaan, dan informasi kontak.</p>
            </div>
            <MemberSheet onSave={handleAdd} />
          </div>

          <div className="filter-bar">
            <input
              type="text"
              className="search-input"
              placeholder="Cari nama, NIM, atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="select-input" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
              <option value="Semua">Semua Unit</option>
              <option value="BPH">BPH</option>
              <option value="Pelayanan">Departemen Pelayanan</option>
              <option value="Media">Divisi Media</option>
              <option value="Ibadah">Divisi Ibadah</option>
              <option value="Doa">Divisi Doa</option>
              <option value="Bendahara">Biro Bendahara</option>
            </select>
            <span style={{ fontSize: 12, color: "var(--color-muted)", marginLeft: "auto" }}>
              Menampilkan {filtered.length} dari {members.length} anggota
            </span>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Anggota</th>
                    <th>NIM / Angkatan</th>
                    <th>Program Studi</th>
                    <th>Penugasan Unit</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.fullName}</strong>
                        <br />
                        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{m.email}</span>
                      </td>
                      <td>
                        <strong>{m.nim}</strong>
                        <br />
                        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Angkatan {m.cohortYear}</span>
                      </td>
                      <td>
                        {m.studyProgram}
                        <br />
                        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{m.faculty}</span>
                      </td>
                      <td>
                        <span className="badge badge-gold">{m.unit}</span>
                      </td>
                      <td>
                        <span className={`status ${m.status === "Aktif" ? "" : "badge-gray"}`}>{m.status}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
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
                            style={{ minHeight: 36, padding: "4px 10px", fontSize: 12 }}
                            onClick={() => handleToggleStatus(m.id)}
                          >
                            {m.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                          </button>
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
