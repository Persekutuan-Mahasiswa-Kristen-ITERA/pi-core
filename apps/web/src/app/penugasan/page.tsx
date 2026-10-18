"use client";

import { useState, type JSX } from "react";
import { Briefcase, Plus, X, Layers, Shield, Trash2, CheckCircle2 } from "lucide-react";
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
  { id: "asg_4", memberName: "Grace Lumbantoruan", unitName: "Divisi Media & Kreatif", positionName: "Staff Divisi", rank: 70, periodName: "2026/2027", status: "Aktif" },
  { id: "asg_5", memberName: "Samuel Nababan", unitName: "Biro Bendahara", positionName: "Bendahara Umum", rank: 30, periodName: "2026/2027", status: "Aktif" },
];

export default function PenugasanPage(): JSX.Element {
  const [assignments, setAssignments] = useState<AssignmentItem[]>(INITIAL_ASSIGNMENTS);
  const [modal, setModal] = useState(false);
  const [member, setMember] = useState("");
  const [unit, setUnit] = useState("Divisi Ibadah");
  const [position, setPosition] = useState("Staff Divisi");

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
              <p className="eyebrow">Struktur & Hierarki</p>
              <h1>Penugasan Jabatan Pengurus</h1>
              <p className="subtitle">
                Petakan anggota ke jabatan unit organisasi dengan batasan rank hierarki resmi PMK ITERA.
              </p>
            </div>
            <button className="button button-gold" type="button" onClick={() => setModal(true)}>
              <Plus size={16} />
              <span>Buat Penugasan Baru</span>
            </button>
          </div>

          <div className="card card-hover">
            <div className="card-heading">
              <div>
                <h2>Daftar Penugasan Aktif (Periode 2026/2027)</h2>
                <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                  Masa jabatan berlaku sepanjang periode aktif berlangsung.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pengurus Terpilih</th>
                    <th>Unit Organisasi</th>
                    <th>Posisi Jabatan</th>
                    <th>Rank Hierarki</th>
                    <th>Periode</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((asg) => (
                    <tr key={asg.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="avatar avatar-sm">
                            {asg.memberName.split(" ").map(n => n[0]).slice(0, 2).join("")}
                          </div>
                          <strong style={{ fontSize: 14, color: "var(--color-heading)" }}>{asg.memberName}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-gold">{asg.unitName}</span>
                      </td>
                      <td>
                        <strong style={{ color: "var(--color-heading-secondary)" }}>{asg.positionName}</strong>
                      </td>
                      <td>
                        <span className="badge badge-blue">Rank {asg.rank}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: "var(--color-body)" }}>{asg.periodName}</span>
                      </td>
                      <td>
                        <span className="badge badge-green">
                          <span className="badge-dot" />
                          {asg.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="button button-secondary"
                          type="button"
                          style={{ minHeight: 32, padding: "4px 10px", fontSize: 12, color: "var(--color-negative)" }}
                          onClick={() => setAssignments((prev) => prev.filter((a) => a.id !== asg.id))}
                        >
                          <Trash2 size={13} />
                          <span>Akhiri</span>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2>Buat Penugasan Baru</h2>
                  <button className="icon-button" type="button" onClick={() => setModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <p className="subtitle" style={{ marginBottom: 18 }}>Tugaskan anggota aktif ke unit dan posisi jabatan.</p>

                <div style={{ display: "grid", gap: 14 }}>
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
                      <option value="BPH">BPH (Pusat)</option>
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
                      <option value="Staff Divisi">Staff Divisi (Rank 70)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <button className="button button-secondary" type="button" onClick={() => setModal(false)}>
                    Batal
                  </button>
                  <button className="button button-gold" type="button" onClick={handleCreate}>
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
