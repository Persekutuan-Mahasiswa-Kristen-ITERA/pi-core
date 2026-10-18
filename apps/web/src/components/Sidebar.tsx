"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX } from "react";

const navItems = [
  { href: "/", icon: "⌂", label: "Dashboard" },
  { href: "/anggota", icon: "♙", label: "Anggota" },
  { href: "/peran", icon: "▣", label: "Peran & Akses" },
  { href: "/periode", icon: "◷", label: "Periode" },
  { href: "/penugasan", icon: "⇄", label: "Penugasan" },
  { href: "/pengaturan", icon: "⚙", label: "Pengaturan" },
  { href: "/audit-log", icon: "≡", label: "Audit Log" },
];

export function Sidebar(): JSX.Element {
  const pathname = usePathname();

  return (
    <aside className="sidebar" aria-label="Navigasi utama">
      <Link className="brand" href="/" aria-label="PI-CORE Dashboard">
        <span className="brand-mark" aria-hidden="true">✚</span>
        <span className="brand-copy">
          PI-CORE <span className="brand-subtitle">PMK ITERA</span>
        </span>
      </Link>
      <nav className="nav">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={isActive ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div style={{ marginBottom: 4 }}>
          <span className="badge badge-green">● Edge Worker Live</span>
        </div>
        Versi 1.0.0 · Admin Portal
      </div>
    </aside>
  );
}

export function MobileNav(): JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav" aria-label="Navigasi mobile">
      {navItems.slice(0, 4).map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
