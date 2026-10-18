"use client";

import { useState, type JSX } from "react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";

type AssignmentItem = {
  id: string;
  memberName: string;
  unitName: string;
  positionName: string;
  rank: number;
  periodName: string;
  status: "Aktif" | "Selesai";
};

const INITIAL_ASSIGNMENTS: AssignmentItem[] = [
  { id: "asg_1", memberName: "Jonathan Sitorus", unitName: "BPH", positionName: "Ketua Umum", rank: 10, periodName: "2026/2027", status: "Aktif" },
  { id: "asg_2", memberName: "Maria Simanjuntak", unitName: "Departemen Pelayanan", positionName: "Sekretaris Departemen", rank: 40, periodName: "2026/2027", status: "Aktif" },
  { id: "asg_3", memberName: "Daniel Hutapea", unitName: "Divisi Ibadah", positionName: "Kepala Divisi", rank: 60, periodName: "2026/2027", status: "Aktif" },
  { id: "asg_4", memberName: "Grace Lumbantoruan", unitName: "Divisi Media & Kreatif", positionName: "Staff", rank: 70, periodName: "2026/2027", status: "Aktif" },
  { id: "asg_5", memberName: "Samuel Nababan", unitName: "Biro Bendahara", positionName: "Bendahara Umum", rank: 30, periodName: "2026/2027", status: "Aktif" },
];

export default function PenugasanPage(): JSX.Element {
  const [assignments, setAssignments] = useState<AssignmentItem[]>(INITIAL_ASSIGNMENTS);
  const [modal, setModal] = useState(false);
  const [member, setMember] = useState("");
  const [unit, setUnit] = useState("Divisi Ibadah");
  const [position, setPosition] = useState("Staff");

  function handleCreate() {
    if (!member.trim()) return;
    const newAsg: AssignmentItem = {
      id: `asg_${Date.now()}`,
      memberName: member,
      unitName: unit,
      positionName: position,
      rank: position === "Kepala Divisi" ? 60 : 70,
      periodName: "2026/2027",
      status: "Aktif",
    };
    setAssignments((prev) => [newAsg, ...prev]);
    setMember("");
    setModal(false);
  }

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Penugasan Jabatan" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Struktur Jabatan</p>
              <h1>Penugasan Pengurus</h1>
              <p className="subtitle">Petakan anggota ke jabatan unit organisasi dengan batasan rank hierarki.</p>
            </div>
            <button className="button" type="button" onClick={() => setModal(true)}>
              + Buat Penugasan
            </button>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Anggota</th>
                    <th>Unit Organisasi</th>
                    <th>Posisi Jabatan</th>
                    <th>Rank Hierarki</th>
                    <th>Periode</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((asg) => (
                    <tr key={asg.id}>
                      <td><strong>{asg.memberName}</strong></td>
                      <td><span className="badge badge-gold">{asg.unitName}</span></td>
                      <td><strong>{asg.positionName}</strong></td>
                      <td>Rank {asg.rank}</td>
                      <td>{asg.periodName}</td>
                      <td><span className="status">{asg.status}</span></td>
                      <td>
                        <button
                          className="button button-secondary"
                          type="button"
                          style={{ minHeight: 32, padding: "4px 10px", fontSize: 11 }}
                          onClick={() => setAssignments((prev) => prev.filter((a) => a.id !== asg.id))}
                        >
                          Akhiri
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {modal && (
            <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
              <div className="card" style={{ width: 460, margin: "auto", padding: 28 }}>
                <h2>Buat Penugasan Baru</h2>
                <p className="subtitle" style={{ marginBottom: 16 }}>Tugaskan anggota ke jabatan unit organisasi.</p>
                <div style={{ display: "grid", gap: 12 }}>
                  <div className="form-field">
                    <label>Nama Anggota</label>
                    <input
                      type="text"
                      placeholder="Masukkan nama pengurus..."
                      value={member}
                      onChange={(e) => setMember(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Unit Organisasi</label>
                    <select
                      className="select-input"
                      style={{ width: "100%" }}
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    >
                      <option value="BPH">BPH</option>
                      <option value="Departemen Pelayanan">Departemen Pelayanan</option>
                      <option value="Divisi Ibadah">Divisi Ibadah</option>
                      <option value="Divisi Doa">Divisi Doa</option>
                      <option value="Divisi Musik">Divisi Musik</option>
                      <option value="Divisi Media & Kreatif">Divisi Media & Kreatif</option>
                      <option value="Biro Bendahara">Biro Bendahara</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Posisi Jabatan</label>
                    <select
                      className="select-input"
                      style={{ width: "100%" }}
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                    >
                      <option value="Kepala Divisi">Kepala Divisi (Rank 60)</option>
                      <option value="Sekretaris Divisi">Sekretaris Divisi (Rank 65)</option>
                      <option value="Staff">Staff (Rank 70)</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                  <button className="button button-secondary" type="button" onClick={() => setModal(false)}>
                    Batal
                  </button>
                  <button className="button" type="button" onClick={handleCreate}>
                    Tetapkan Penugasan
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
