const navItems = [
  ["⌂", "Dashboard"],
  ["♙", "Anggota"],
  ["▣", "Peran"],
  ["◷", "Periode"],
  ["⇄", "Penugasan"],
  ["⚙", "Pengaturan"],
  ["≡", "Audit Log"],
] as const;

const members = [
  ["Jonathan Sitorus", "Kepala Departemen", "Aktif"],
  ["Maria Simanjuntak", "Sekretaris", "Aktif"],
  ["Daniel Hutapea", "Staff", "Aktif"],
  ["Grace Lumbantoruan", "Anggota", "Aktif"],
] as const;

function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Navigasi utama">
      <a className="brand" href="#dashboard" aria-label="PI-CORE Dashboard">
        <span className="brand-mark" aria-hidden="true">✚</span>
        <span className="brand-copy">PI-CORE <span className="brand-subtitle">PMK ITERA</span></span>
      </a>
      <nav className="nav">
        {navItems.map(([icon, label], index) => (
          <a className="nav-link" href={`#${label.toLowerCase().replaceAll(" ", "-")}`} aria-current={index === 0 ? "page" : undefined} key={label}>
            <span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">Versi staging · Admin Portal</div>
    </aside>
  );
}

function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Navigasi mobile">
      {["⌂|Beranda", "♙|Anggota", "▣|Laporan", "●|Profil"].map((item, index) => {
        const [icon, label] = item.split("|");
        return <a href={`#${label?.toLowerCase()}`} aria-current={index === 0 ? "page" : undefined} key={label}><span aria-hidden="true">{icon}</span><span>{label}</span></a>;
      })}
    </nav>
  );
}

function StatCard({ label, value, meta, neutral = false }: { label: string; value: string; meta: string; neutral?: boolean }) {
  return <article className="card"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className={`stat-meta${neutral ? " neutral" : ""}`}>{meta}</span></article>;
}

function LoadingState() {
  return <div className="state-panel" role="status"><div><strong>Memuat data…</strong><p>Data dashboard sedang disiapkan.</p></div></div>;
}

function EmptyState() {
  return <div className="state-panel"><div><strong>Belum ada aktivitas</strong><p>Aktivitas organisasi akan muncul di sini.</p></div></div>;
}

function ErrorState() {
  return <div className="state-panel"><div><strong>Data belum tersedia</strong><p>Silakan coba lagi beberapa saat kemudian.</p><button className="button button-secondary" type="button" style={{ marginTop: 14 }}>Coba lagi</button></div></div>;
}

export default function HomePage() {
  return (
    <div className="shell" id="dashboard">
      <Sidebar />
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb"><strong>Dashboard</strong> <span aria-hidden="true">/</span> Ringkasan organisasi</div>
          <div className="user-menu"><span className="avatar" aria-hidden="true">FA</span><span><strong style={{ color: "var(--color-heading-secondary)" }}>Admin</strong><br /><span className="breadcrumb">Super Admin</span></span></div>
        </header>
        <main className="content">
          <section className="page-heading" aria-labelledby="page-title">
            <div><p className="eyebrow">Admin Portal</p><h1 id="page-title">Shalom, Admin!</h1><p className="subtitle">Pantau dan kelola organisasi PMK ITERA dari satu tempat.</p></div>
            <a className="button" href="#anggota">+ Tambah Anggota</a>
          </section>
          <section className="stats" aria-label="Statistik organisasi">
            <StatCard label="TOTAL ANGGOTA" value="128" meta="↑ 5% dari periode lalu" />
            <StatCard label="PERIODE AKTIF" value="2026/2027" meta="01 Agu 2026 — 31 Jul 2027" neutral />
            <StatCard label="PERAN TERSEDIA" value="10" meta="Semua peran terkonfigurasi" neutral />
          </section>
          <section className="grid" aria-label="Ringkasan aktivitas">
            <article className="card">
              <div className="card-heading"><h2>Anggota terbaru</h2><a className="text-link" href="#anggota">Lihat semua →</a></div>
              <div className="table-wrap"><table><caption className="sr-only">Daftar anggota terbaru</caption><thead><tr><th scope="col">Nama</th><th scope="col">Peran</th><th scope="col">Status</th></tr></thead><tbody>{members.map(([name, role, status]) => <tr key={name}><td><strong>{name}</strong></td><td>{role}</td><td><span className="status">{status}</span></td></tr>)}</tbody></table></div>
            </article>
            <article className="card"><div className="card-heading"><h2>Akses cepat</h2></div><div style={{ display: "grid", gap: 10 }}><a className="button button-secondary" href="#anggota">Kelola Anggota</a><a className="button button-secondary" href="#penugasan">Buat Penugasan</a><a className="button button-secondary" href="#periode">Atur Periode</a></div></article>
          </section>
          <section className="card" style={{ marginTop: 24 }} aria-labelledby="activity-title"><div className="card-heading"><h2 id="activity-title">Aktivitas terakhir</h2><a className="text-link" href="#audit-log">Buka audit log →</a></div><ul className="activity-list"><li className="activity"><span className="activity-dot" aria-hidden="true" /><div><p><strong>Maria Simanjuntak</strong> ditambahkan sebagai anggota baru.</p><time>Hari ini, 09:42</time></div></li><li className="activity"><span className="activity-dot" aria-hidden="true" /><div><p><strong>Periode 2026/2027</strong> diaktifkan.</p><time>Kemarin, 16:20</time></div></li></ul></section>
          <details style={{ marginTop: 24 }}><summary style={{ cursor: "pointer", color: "var(--color-muted)" }}>Preview state components (QA)</summary><div className="grid" style={{ marginTop: 12 }}><LoadingState /><EmptyState /><ErrorState /></div></details>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
