"use client";

import { useState, type JSX } from "react";
import { MemberSheet, type MemberForm } from "./member-sheet";
import { IntegrationsPanel } from "./integrations";
import { RealtimeStatusIndicator, useRealtime } from "./realtime";

type TabKey = "dashboard" | "anggota" | "peran" | "periode" | "penugasan" | "pengaturan" | "audit-log";

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

type PeriodItem = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

type AssignmentItem = {
  id: string;
  memberName: string;
  unitName: string;
  positionName: string;
  rank: number;
  periodName: string;
  status: "Aktif" | "Selesai";
};

type AuditItem = {
  id: string;
  actor: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "ROTATE_SECRET" | "ACTIVATE";
  entity: string;
  details: string;
  timestamp: string;
  ip: string;
};

const navItems: Array<{ key: TabKey; icon: string; label: string }> = [
  { key: "dashboard", icon: "⌂", label: "Dashboard" },
  { key: "anggota", icon: "♙", label: "Anggota" },
  { key: "peran", icon: "▣", label: "Peran & Akses" },
  { key: "periode", icon: "◷", label: "Periode" },
  { key: "penugasan", icon: "⇄", label: "Penugasan" },
  { key: "pengaturan", icon: "⚙", label: "Pengaturan" },
  { key: "audit-log", icon: "≡", label: "Audit Log" },
];

const INITIAL_MEMBERS: MemberItem[] = [
  {
    id: "mem_1",
    fullName: "Jonathan Sitorus",
    email: "jonathan.sitorus@itera.ac.id",
    nim: "121140022",
    faculty: "FTI",
    studyProgram: "Teknik Informatika",
    cohortYear: "2021",
    phone: "+6281234567890",
    unit: "BPH",
    role: "Ketua Umum",
    status: "Aktif",
  },
  {
    id: "mem_2",
    fullName: "Maria Simanjuntak",
    email: "maria.simanjuntak@student.itera.ac.id",
    nim: "122140088",
    faculty: "FTI",
    studyProgram: "Teknik Informatika",
    cohortYear: "2022",
    phone: "+6281234567891",
    unit: "Departemen Pelayanan",
    role: "Sekretaris",
    status: "Aktif",
  },
  {
    id: "mem_3",
    fullName: "Daniel Hutapea",
    email: "daniel.hutapea@student.itera.ac.id",
    nim: "122130045",
    faculty: "FTI",
    studyProgram: "Teknik Elektro",
    cohortYear: "2022",
    phone: "+6281234567892",
    unit: "Divisi Ibadah",
    role: "Kepala Divisi",
    status: "Aktif",
  },
  {
    id: "mem_4",
    fullName: "Grace Lumbantoruan",
    email: "grace.lumban@student.itera.ac.id",
    nim: "123140012",
    faculty: "FS",
    studyProgram: "Farmasi",
    cohortYear: "2023",
    phone: "+6281234567893",
    unit: "Divisi Media & Kreatif",
    role: "Staff",
    status: "Aktif",
  },
  {
    id: "mem_5",
    fullName: "Samuel Nababan",
    email: "samuel.nababan@student.itera.ac.id",
    nim: "121110034",
    faculty: "FTSP",
    studyProgram: "Teknik Sipil",
    cohortYear: "2021",
    phone: "+6281234567894",
    unit: "Biro Bendahara",
    role: "Bendahara Umum",
    status: "Aktif",
  },
];

const ROLES_CATALOG = [
  { key: "super_admin", name: "Super Admin", scope: "O (Semua)", isSystem: true, grants: 22, desc: "Hak penuh mutlak atas seluruh sistem, konfigurasi, integrasi OIDC, dan peran." },
  { key: "organization_admin", name: "Organization Admin", scope: "O (Organisasi)", isSystem: true, grants: 17, desc: "Pengelola operasional organisasi, anggota, periode, dan pengaturan." },
  { key: "bph", name: "BPH (Badan Pengurus Harian)", scope: "O (Organisasi)", isSystem: true, grants: 7, desc: "Ketua, Wakil, Sekretaris Umum, dan Bendahara Umum PMK ITERA." },
  { key: "kepala_departemen", name: "Kepala Departemen / Biro", scope: "U (Subtree Unit)", isSystem: true, grants: 7, desc: "Memimpin departemen/biro dan divisi di bawahnya sesuai hierarki." },
  { key: "sekretaris", name: "Sekretaris Departemen", scope: "U (Subtree Unit)", isSystem: true, grants: 9, desc: "Mengelola administrasi dan pembacaan data anggota dalam unitnya." },
  { key: "kepala_divisi", name: "Kepala Divisi", scope: "U (Divisi)", isSystem: true, grants: 6, desc: "Memimpin pelaksanaan program kerja pada divisi tertentu." },
  { key: "staff", name: "Staff Divisi", scope: "U (Divisi)", isSystem: true, grants: 5, desc: "Anggota pengurus aktif dalam divisi operasional." },
  { key: "bendahara", name: "Bendahara", scope: "U (Biro Kas)", isSystem: true, grants: 4, desc: "Marker role untuk pencatatan dan pelaporan keuangan." },
  { key: "panitia", name: "Panitia Acara", scope: "U (Event Scope)", isSystem: true, grants: 4, desc: "Hak penugasan sementara khusus kepanitiaan perayaan Natal/Paskah." },
  { key: "anggota", name: "Anggota Biasa", scope: "S (Data Mandiri)", isSystem: true, grants: 4, desc: "Anggota umum terdaftar PMK ITERA (akses mandiri direktori & profil)." },
];

const INITIAL_PERIODS: PeriodItem[] = [
  { id: "per_2026", name: "2026/2027", startDate: "2026-08-01", endDate: "2027-07-31", isActive: true },
  { id: "per_2025", name: "2025/2026", startDate: "2025-08-01", endDate: "2026-07-31", isActive: false },
  { id: "per_2024", name: "2024/2025", startDate: "2024-08-01", endDate: "2025-07-31", isActive: false },
];

const INITIAL_ASSIGNMENTS: AssignmentItem[] = [
  { id: "asg_1", memberName: "Jonathan Sitorus", unitName: "BPH", positionName: "Ketua Umum", rank: 10, periodName: "2026/2027", status: "Aktif" },
  { id: "asg_2", memberName: "Maria Simanjuntak", unitName: "Departemen Pelayanan", positionName: "Sekretaris Departemen", rank: 40, periodName: "2026/2027", status: "Aktif" },
  { id: "asg_3", memberName: "Daniel Hutapea", unitName: "Divisi Ibadah", positionName: "Kepala Divisi", rank: 60, periodName: "2026/2027", status: "Aktif" },
  { id: "asg_4", memberName: "Grace Lumbantoruan", unitName: "Divisi Media & Kreatif", positionName: "Staff", rank: 70, periodName: "2026/2027", status: "Aktif" },
  { id: "asg_5", memberName: "Samuel Nababan", unitName: "Biro Bendahara", positionName: "Bendahara Umum", rank: 30, periodName: "2026/2027", status: "Aktif" },
];

const INITIAL_AUDITS: AuditItem[] = [
  { id: "aud_1", actor: "febryan.admin@itera.ac.id", action: "ACTIVATE", entity: "period", details: "Periode 2026/2027 diaktifkan (periods_single_active_uq enforced)", timestamp: "Hari ini, 07:15", ip: "103.111.201.4" },
  { id: "aud_2", actor: "febryan.admin@itera.ac.id", action: "CREATE", entity: "member", details: "Menambahkan anggota baru Grace Lumbantoruan (Farmasi)", timestamp: "Kemarin, 14:22", ip: "103.111.201.4" },
  { id: "aud_3", actor: "febryan.admin@itera.ac.id", action: "CREATE", entity: "assignment", details: "Penugasan Kepala Divisi Ibadah: Daniel Hutapea", timestamp: "16 Okt 2026, 11:05", ip: "103.111.201.4" },
  { id: "aud_4", actor: "febryan.admin@itera.ac.id", action: "ROTATE_SECRET", entity: "integration", details: "Rotasi rahasia OAuth Client PI-NEXUS (AES-256 encrypted)", timestamp: "15 Okt 2026, 18:40", ip: "103.111.201.4" },
];

export default function HomePage(): JSX.Element {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://pi-core-api-staging.pmkitera.workers.dev";
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  // State data interaktif
  const [members, setMembers] = useState<MemberItem[]>(INITIAL_MEMBERS);
  const [periods, setPeriods] = useState<PeriodItem[]>(INITIAL_PERIODS);
  const [assignments, setAssignments] = useState<AssignmentItem[]>(INITIAL_ASSIGNMENTS);
  const [audits, setAudits] = useState<AuditItem[]>(INITIAL_AUDITS);
  const [whitelistedDomains, setWhitelistedDomains] = useState<string[]>(["itera.ac.id", "student.itera.ac.id"]);
  const [newDomain, setNewDomain] = useState("");

  // Search & Filters
  const [memberSearch, setMemberSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("Semua");
  const [auditFilter, setAuditFilter] = useState("Semua");

  // Dialogs
  const [newPeriodModal, setNewPeriodModal] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const [newAsgModal, setNewAsgModal] = useState(false);
  const [asgMember, setAsgMember] = useState("");
  const [asgUnit, setAsgUnit] = useState("Divisi Ibadah");
  const [asgPosition, setAsgPosition] = useState("Staff");

  // Org Settings State
  const [orgName, setOrgName] = useState("Persekutuan Mahasiswa Kristen ITERA");
  const [orgEmail, setOrgEmail] = useState("pmk@itera.ac.id");
  const [orgPhone, setOrgPhone] = useState("+62 821-7788-9900");
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // Real-time live activities
  const [liveActivities, setLiveActivities] = useState<Array<{ id: string; text: string; time: string }>>([]);

  const { status } = useRealtime({
    apiBaseUrl,
    onEvent: (event) => {
      let description = `Pembaruan data pada ${event.topic} (${event.action})`;
      if (event.topic === "members") {
        description = `Data anggota diperbarui (${event.action})`;
      } else if (event.topic === "periods") {
        description = `Periode organisasi diperbarui (${event.action})`;
      } else if (event.topic === "integrations") {
        description = `Integrasi OAuth diperbarui (${event.action})`;
      } else if (event.topic === "assignments") {
        description = `Penugasan organisasi diperbarui (${event.action})`;
      } else if (event.topic === "roles") {
        description = `Peran atau hak akses diperbarui (${event.action})`;
      } else if (event.topic === "settings") {
        description = `Pengaturan organisasi diperbarui (${event.action})`;
      }
      setLiveActivities((prev) => [
        {
          id: `${event.topic}-${event.id}-${Date.now()}`,
          text: description,
          time: "Baru saja",
        },
        ...prev.slice(0, 4),
      ]);
    },
  });

  // Action Handlers
  function handleAddMember(form: MemberForm) {
    const newMember: MemberItem = {
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
    setMembers((prev) => [newMember, ...prev]);
    setAudits((prev) => [
      {
        id: `aud_${Date.now()}`,
        actor: "admin@itera.ac.id",
        action: "CREATE",
        entity: "member",
        details: `Menambahkan anggota baru: ${form.fullName}`,
        timestamp: "Baru saja",
        ip: "127.0.0.1",
      },
      ...prev,
    ]);
  }

  function handleToggleMemberStatus(id: string) {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const nextStatus = m.status === "Aktif" ? "Nonaktif" : "Aktif";
          setAudits((auds) => [
            {
              id: `aud_${Date.now()}`,
              actor: "admin@itera.ac.id",
              action: "UPDATE",
              entity: "member",
              details: `Mengubah status ${m.fullName} menjadi ${nextStatus}`,
              timestamp: "Baru saja",
              ip: "127.0.0.1",
            },
            ...auds,
          ]);
          return { ...m, status: nextStatus };
        }
        return m;
      }),
    );
  }

  function handleActivatePeriod(periodId: string) {
    setPeriods((prev) =>
      prev.map((p) => ({
        ...p,
        isActive: p.id === periodId,
      })),
    );
    const targetPeriod = periods.find((p) => p.id === periodId);
    setAudits((prev) => [
      {
        id: `aud_${Date.now()}`,
        actor: "admin@itera.ac.id",
        action: "ACTIVATE",
        entity: "period",
        details: `Mengaktifkan periode ${targetPeriod?.name ?? periodId} (periods_single_active_uq)`,
        timestamp: "Baru saja",
        ip: "127.0.0.1",
      },
      ...prev,
    ]);
  }

  function handleCreatePeriod() {
    if (!newPeriodName.trim()) return;
    const newPer: PeriodItem = {
      id: `per_${Date.now()}`,
      name: newPeriodName,
      startDate: newPeriodStart || "2027-08-01",
      endDate: newPeriodEnd || "2028-07-31",
      isActive: false,
    };
    setPeriods((prev) => [...prev, newPer]);
    setNewPeriodName("");
    setNewPeriodStart("");
    setNewPeriodEnd("");
    setNewPeriodModal(false);
  }

  function handleCreateAssignment() {
    if (!asgMember) return;
    const newAsg: AssignmentItem = {
      id: `asg_${Date.now()}`,
      memberName: asgMember,
      unitName: asgUnit,
      positionName: asgPosition,
      rank: asgPosition === "Kepala Divisi" ? 60 : 70,
      periodName: "2026/2027",
      status: "Aktif",
    };
    setAssignments((prev) => [newAsg, ...prev]);
    setNewAsgModal(false);
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsSavedToast(true);
    setAudits((prev) => [
      {
        id: `aud_${Date.now()}`,
        actor: "admin@itera.ac.id",
        action: "UPDATE",
        entity: "settings",
        details: "Memperbarui profil organisasi PMK ITERA",
        timestamp: "Baru saja",
        ip: "127.0.0.1",
      },
      ...prev,
    ]);
    setTimeout(() => setSettingsSavedToast(false), 2500);
  }

  function handleAddDomain() {
    if (!newDomain.trim()) return;
    const clean = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (!whitelistedDomains.includes(clean)) {
      setWhitelistedDomains((prev) => [...prev, clean]);
      setNewDomain("");
    }
  }

  function handleRemoveDomain(domain: string) {
    if (whitelistedDomains.length <= 1) return;
    setWhitelistedDomains((prev) => prev.filter((d) => d !== domain));
  }

  // Filtered lists
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.nim.includes(memberSearch) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase());
    const matchesUnit = unitFilter === "Semua" || m.unit.includes(unitFilter);
    return matchesSearch && matchesUnit;
  });

  const filteredAudits = audits.filter((a) => {
    if (auditFilter === "Semua") return true;
    return a.action === auditFilter;
  });

  return (
    <div className="shell" id="dashboard">
      {/* Sidebar Navigation */}
      <aside className="sidebar" aria-label="Navigasi utama">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✚</span>
          <span className="brand-copy">
            PI-CORE <span className="brand-subtitle">PMK ITERA</span>
          </span>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <button
              className="nav-button"
              type="button"
              aria-current={activeTab === item.key ? "page" : undefined}
              key={item.key}
              onClick={() => setActiveTab(item.key)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ marginBottom: 4 }}>
            <span className="badge badge-green">● Edge Worker Live</span>
          </div>
          Versi 1.0.0 · Admin Portal
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main">
        {/* Top Header */}
        <header className="topbar">
          <div className="breadcrumb" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <strong>PI-CORE Admin</strong> <span aria-hidden="true">/</span>{" "}
              {navItems.find((n) => n.key === activeTab)?.label}
            </div>
            <RealtimeStatusIndicator status={status} />
          </div>
          <div className="user-menu">
            <span className="avatar" aria-hidden="true">FY</span>
            <div>
              <strong style={{ color: "var(--color-heading-secondary)" }}>Febryan Yoel</strong>
              <br />
              <span className="breadcrumb">Super Admin (BPH)</span>
            </div>
          </div>
        </header>

        {/* View Router */}
        <main className="content">
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">Portal Manajemen</p>
                  <h1>Shalom, Pengurus!</h1>
                  <p className="subtitle">Pantau dan kelola seluruh identitas organisasi PMK ITERA dari satu tempat.</p>
                </div>
                <MemberSheet onSave={handleAddMember} />
              </section>

              <section className="stats">
                <article className="card">
                  <span className="stat-label">TOTAL ANGGOTA</span>
                  <strong className="stat-value">{members.length}</strong>
                  <span className="stat-meta">↑ Terdaftar aktif</span>
                </article>
                <article className="card">
                  <span className="stat-label">PERIODE AKTIF</span>
                  <strong className="stat-value">{periods.find((p) => p.isActive)?.name ?? "2026/2027"}</strong>
                  <span className="stat-meta neutral">Status: Berjalan</span>
                </article>
                <article className="card">
                  <span className="stat-label">HAK AKSES / PERAN</span>
                  <strong className="stat-value">10</strong>
                  <span className="stat-meta neutral">23 Granular Permissions</span>
                </article>
              </section>

              <div className="grid">
                <article className="card">
                  <div className="card-heading">
                    <h2>Anggota Terdaftar Terbaru</h2>
                    <button className="text-link" type="button" onClick={() => setActiveTab("anggota")}>
                      Buka Semua ({members.length}) →
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Nama</th>
                          <th>Unit</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.slice(0, 4).map((m) => (
                          <tr key={m.id}>
                            <td>
                              <strong>{m.fullName}</strong>
                              <br />
                              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{m.nim}</span>
                            </td>
                            <td>{m.unit}</td>
                            <td>
                              <span className={`status ${m.status === "Aktif" ? "" : "badge-gray"}`}>{m.status}</span>
                            </td>
                            <td>
                              <button
                                className="button button-secondary"
                                type="button"
                                style={{ minHeight: 32, padding: "4px 10px", fontSize: 11 }}
                                onClick={() => handleToggleMemberStatus(m.id)}
                              >
                                {m.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="card">
                  <div className="card-heading">
                    <h2>Akses Cepat Pengurus</h2>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <button className="button button-secondary" type="button" onClick={() => setActiveTab("anggota")}>
                      👥 Direktori Anggota
                    </button>
                    <button className="button button-secondary" type="button" onClick={() => setActiveTab("penugasan")}>
                      📋 Buat Penugasan Jabatan
                    </button>
                    <button className="button button-secondary" type="button" onClick={() => setActiveTab("periode")}>
                      📅 Kelola Periode Kepengurusan
                    </button>
                    <button className="button button-secondary" type="button" onClick={() => setActiveTab("audit-log")}>
                      🛡️ Buka Log Audit Keamanan
                    </button>
                  </div>
                </article>
              </div>

              {/* Realtime Live Activity Feed */}
              <section className="card" style={{ marginTop: 24 }}>
                <div className="card-heading">
                  <h2>Aktivitas Sistem Terakhir (Real-Time Live)</h2>
                  <button className="text-link" type="button" onClick={() => setActiveTab("audit-log")}>
                    Lihat Audit Log Lengkap →
                  </button>
                </div>
                <ul className="activity-list">
                  {liveActivities.map((act) => (
                    <li className="activity" key={act.id}>
                      <span className="activity-dot" style={{ backgroundColor: "#10b981" }} aria-hidden="true" />
                      <div>
                        <p><strong>{act.text}</strong></p>
                        <time>{act.time}</time>
                      </div>
                    </li>
                  ))}
                  {audits.slice(0, 3).map((a) => (
                    <li className="activity" key={a.id}>
                      <span className="activity-dot" aria-hidden="true" />
                      <div>
                        <p><strong>{a.details}</strong> ({a.actor})</p>
                        <time>{a.timestamp}</time>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Integrations Section */}
              <section className="card" style={{ marginTop: 24 }} id="integrations">
                <IntegrationsPanel apiBaseUrl={apiBaseUrl} />
              </section>
            </div>
          )}

          {/* TAB 2: ANGGOTA */}
          {activeTab === "anggota" && (
            <div>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">Direktori Terpusat</p>
                  <h1>Manajemen Anggota</h1>
                  <p className="subtitle">Kelola seluruh data mahasiswa, status keanggotaan, dan informasi kontak.</p>
                </div>
                <MemberSheet onSave={handleAddMember} />
              </div>

              {/* Filter & Search Bar */}
              <div className="filter-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cari nama, NIM, atau email..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
                <select
                  className="select-input"
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                >
                  <option value="Semua">Semua Unit</option>
                  <option value="BPH">BPH</option>
                  <option value="Pelayanan">Departemen Pelayanan</option>
                  <option value="Media">Divisi Media</option>
                  <option value="Ibadah">Divisi Ibadah</option>
                  <option value="Bendahara">Biro Bendahara</option>
                </select>
                <span style={{ fontSize: 12, color: "var(--color-muted)", marginLeft: "auto" }}>
                  Menampilkan {filteredMembers.length} dari {members.length} anggota
                </span>
              </div>

              {/* Table */}
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
                      {filteredMembers.map((m) => (
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
                            <span className={`status ${m.status === "Aktif" ? "" : "badge-gray"}`}>
                              {m.status}
                            </span>
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
                                  setMembers((prev) =>
                                    prev.map((item) => (item.id === m.id ? { ...item, ...updated } : item)),
                                  );
                                }}
                              />
                              <button
                                className="button button-secondary"
                                type="button"
                                style={{ minHeight: 36, padding: "4px 10px", fontSize: 12 }}
                                onClick={() => handleToggleMemberStatus(m.id)}
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
            </div>
          )}

          {/* TAB 3: PERAN & AKSES */}
          {activeTab === "peran" && (
            <div>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">Role-Based Access Control</p>
                  <h1>Peran & Matriks Izin</h1>
                  <p className="subtitle">10 peran resmi organisasi dengan 23 granular permissions dan guard bertingkat.</p>
                </div>
                <span className="badge badge-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
                  ✓ 100% Immutable System Roles
                </span>
              </div>

              <div className="role-grid">
                {ROLES_CATALOG.map((role) => (
                  <article className="card" key={role.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <h3 style={{ fontSize: 16 }}>{role.name}</h3>
                      <span className="badge badge-blue">{role.grants} Izin</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--color-muted)", minHeight: 48, margin: "6px 0 12px" }}>
                      {role.desc}
                    </p>
                    <div style={{ borderTop: "1px solid rgba(161,89,18,0.1)", paddingTop: 10, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--color-muted)" }}>Scope: <strong>{role.scope}</strong></span>
                      <span className="badge badge-gray">{role.key}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PERIODE */}
          {activeTab === "periode" && (
            <div>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">Masa Bakti</p>
                  <h1>Periode Kepengurusan</h1>
                  <p className="subtitle">Atur periode kepengurusan aktif dan arsip masa bakti PMK ITERA.</p>
                </div>
                <button className="button" type="button" onClick={() => setNewPeriodModal(true)}>
                  + Tambah Periode
                </button>
              </div>

              {/* Active Period Highlight */}
              {periods.filter((p) => p.isActive).map((active) => (
                <div className="period-banner" key={active.id}>
                  <div>
                    <span className="badge badge-green" style={{ marginBottom: 6 }}>● PERIODE AKTIF SAAT INI</span>
                    <h2 style={{ fontSize: 24, margin: "4px 0" }}>Tahun Kepengurusan {active.name}</h2>
                    <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>
                      Rentang waktu: <strong>{active.startDate}</strong> s/d <strong>{active.endDate}</strong> (Seluruh hak akses kepengurusan berlaku pada periode ini).
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
                                onClick={() => handleActivatePeriod(p.id)}
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

              {/* Modal Tambah Periode */}
              {newPeriodModal && (
                <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setNewPeriodModal(false); }}>
                  <div className="card" style={{ width: 440, margin: "auto", padding: 28 }}>
                    <h2>Tambah Periode Baru</h2>
                    <p className="subtitle" style={{ marginBottom: 16 }}>Tambahkan tahun kepengurusan baru.</p>
                    <div style={{ display: "grid", gap: 12 }}>
                      <div className="form-field">
                        <label>Nama Periode (contoh: 2027/2028)</label>
                        <input
                          type="text"
                          value={newPeriodName}
                          onChange={(e) => setNewPeriodName(e.target.value)}
                          placeholder="2027/2028"
                        />
                      </div>
                      <div className="form-field">
                        <label>Tanggal Mulai</label>
                        <input
                          type="date"
                          value={newPeriodStart}
                          onChange={(e) => setNewPeriodStart(e.target.value)}
                        />
                      </div>
                      <div className="form-field">
                        <label>Tanggal Selesai</label>
                        <input
                          type="date"
                          value={newPeriodEnd}
                          onChange={(e) => setNewPeriodEnd(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                      <button className="button button-secondary" type="button" onClick={() => setNewPeriodModal(false)}>
                        Batal
                      </button>
                      <button className="button" type="button" onClick={handleCreatePeriod}>
                        Simpan Periode
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PENUGASAN */}
          {activeTab === "penugasan" && (
            <div>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">Struktur Jabatan</p>
                  <h1>Penugasan Pengurus</h1>
                  <p className="subtitle">Petakan anggota ke jabatan unit organisasi dengan batasan rank hierarki.</p>
                </div>
                <button className="button" type="button" onClick={() => setNewAsgModal(true)}>
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
                              onClick={() => {
                                setAssignments((prev) => prev.filter((a) => a.id !== asg.id));
                              }}
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

              {/* Modal Buat Penugasan */}
              {newAsgModal && (
                <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setNewAsgModal(false); }}>
                  <div className="card" style={{ width: 460, margin: "auto", padding: 28 }}>
                    <h2>Buat Penugasan Baru</h2>
                    <p className="subtitle" style={{ marginBottom: 16 }}>Tugaskan anggota ke jabatan unit organisasi.</p>
                    <div style={{ display: "grid", gap: 12 }}>
                      <div className="form-field">
                        <label>Pilih Anggota</label>
                        <select
                          className="select-input"
                          style={{ width: "100%" }}
                          value={asgMember}
                          onChange={(e) => setAsgMember(e.target.value)}
                        >
                          <option value="">-- Pilih Anggota --</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.fullName}>
                              {m.fullName} ({m.nim})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field">
                        <label>Unit Organisasi</label>
                        <select
                          className="select-input"
                          style={{ width: "100%" }}
                          value={asgUnit}
                          onChange={(e) => setAsgUnit(e.target.value)}
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
                          value={asgPosition}
                          onChange={(e) => setAsgPosition(e.target.value)}
                        >
                          <option value="Kepala Divisi">Kepala Divisi (Rank 60)</option>
                          <option value="Sekretaris Divisi">Sekretaris Divisi (Rank 65)</option>
                          <option value="Staff">Staff (Rank 70)</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                      <button className="button button-secondary" type="button" onClick={() => setNewAsgModal(false)}>
                        Batal
                      </button>
                      <button className="button" type="button" onClick={handleCreateAssignment}>
                        Tetapkan Penugasan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PENGATURAN */}
          {activeTab === "pengaturan" && (
            <div>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">Konfigurasi Sistem</p>
                  <h1>Pengaturan Organisasi</h1>
                  <p className="subtitle">Profil organisasi PMK ITERA, domain email yang diizinkan, dan brand asset.</p>
                </div>
              </div>

              <div className="grid">
                {/* Form Profil Organisasi */}
                <form className="card" onSubmit={handleSaveSettings}>
                  <div className="card-heading">
                    <h2>Profil PMK ITERA</h2>
                  </div>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div className="form-field">
                      <label>Nama Organisasi</label>
                      <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Email Resmi Organisasi</label>
                      <input
                        type="email"
                        value={orgEmail}
                        onChange={(e) => setOrgEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Nomor Telepon / WhatsApp Sekretariat</label>
                      <input
                        type="text"
                        value={orgPhone}
                        onChange={(e) => setOrgPhone(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label>Alamat Sekretariat</label>
                      <input
                        type="text"
                        defaultValue="Gedung E ITERA, Jl. Terusan Ryacudu, Way Hui, Jati Agung, Lampung Selatan"
                      />
                    </div>
                  </div>
                  {settingsSavedToast && (
                    <div className="success-message" role="status" style={{ marginTop: 16 }}>
                      ✓ Pengaturan profil organisasi berhasil disimpan!
                    </div>
                  )}
                  <div style={{ marginTop: 20 }}>
                    <button className="button" type="submit">
                      Simpan Perubahan
                    </button>
                  </div>
                </form>

                {/* Domain Whitelist */}
                <div style={{ display: "grid", gap: 20 }}>
                  <article className="card">
                    <div className="card-heading">
                      <h2>Domain Email Diizinkan</h2>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "0 0 12px" }}>
                      Hanya akun Google dengan domain ini yang diizinkan login ke PI-CORE (ADR-0005).
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                      {whitelistedDomains.map((d) => (
                        <span className="badge badge-gold" key={d} style={{ padding: "6px 12px", fontSize: 12 }}>
                          @{d}
                          <button
                            type="button"
                            style={{ background: "transparent", border: 0, cursor: "pointer", marginLeft: 6, fontWeight: 800 }}
                            onClick={() => handleRemoveDomain(d)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        className="search-input"
                        style={{ minWidth: 0, flex: 1 }}
                        placeholder="tambah domain (cth: itera.ac.id)"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                      />
                      <button className="button button-secondary" type="button" onClick={handleAddDomain}>
                        Tambah
                      </button>
                    </div>
                  </article>

                  <article className="card">
                    <div className="card-heading">
                      <h2>Logo & Brand Asset</h2>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          background: "var(--color-primary)",
                          color: "var(--color-gold)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 24,
                          fontWeight: 800,
                        }}
                      >
                        ✚
                      </div>
                      <div>
                        <strong>Logo Utama PMK ITERA</strong>
                        <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "2px 0 6px" }}>
                          Format SVG / PNG transparansi (512×512)
                        </p>
                        <span className="badge badge-green">Tersimpan di Cloudflare R2</span>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: AUDIT LOG */}
          {activeTab === "audit-log" && (
            <div>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">Keamanan & Kepatuhan</p>
                  <h1>Audit Log Append-Only</h1>
                  <p className="subtitle">Catatan audit permanen yang tidak dapat diubah maupun dihapus (Anti-Tamper DB Trigger).</p>
                </div>
                <span className="badge badge-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
                  🛡️ Immutable DB Trigger Active
                </span>
              </div>

              {/* Filter */}
              <div className="filter-bar">
                <span style={{ fontSize: 13, fontWeight: 700 }}>Filter Aksi:</span>
                {["Semua", "CREATE", "UPDATE", "DELETE", "ACTIVATE", "ROTATE_SECRET"].map((act) => (
                  <button
                    key={act}
                    type="button"
                    className={`button ${auditFilter === act ? "" : "button-secondary"}`}
                    style={{ minHeight: 34, padding: "4px 12px", fontSize: 11 }}
                    onClick={() => setAuditFilter(act)}
                  >
                    {act}
                  </button>
                ))}
              </div>

              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Aksi</th>
                        <th>Aktor</th>
                        <th>Entitas Target</th>
                        <th>Rincian Perubahan</th>
                        <th>IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAudits.map((a) => (
                        <tr key={a.id}>
                          <td><span style={{ fontSize: 12, color: "var(--color-muted)" }}>{a.timestamp}</span></td>
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
                              {a.action}
                            </span>
                          </td>
                          <td><strong>{a.actor}</strong></td>
                          <td><code>{a.entity}</code></td>
                          <td style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.details}
                          </td>
                          <td><span style={{ fontSize: 11, color: "var(--color-muted)" }}>{a.ip}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav" aria-label="Navigasi mobile">
        {navItems.slice(0, 4).map((item) => (
          <a
            href={`#${item.key}`}
            aria-current={activeTab === item.key ? "page" : undefined}
            key={item.key}
            onClick={(e) => {
              e.preventDefault();
              setActiveTab(item.key);
            }}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
