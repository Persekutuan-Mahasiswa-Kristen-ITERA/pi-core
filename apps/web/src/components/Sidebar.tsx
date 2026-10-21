"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX } from "react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CalendarRange,
  Briefcase,
  Plug,
  Settings,
  Activity,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/anggota", icon: Users, label: "Anggota" },
  { href: "/peran", icon: ShieldCheck, label: "Peran & Akses" },
  { href: "/periode", icon: CalendarRange, label: "Periode" },
  { href: "/penugasan", icon: Briefcase, label: "Penugasan" },
  { href: "/integrations", icon: Plug, label: "Integrasi" },
  { href: "/pengaturan", icon: Settings, label: "Pengaturan" },
  { href: "/audit-log", icon: Activity, label: "Audit Log" },
];

export function Sidebar(): JSX.Element {
  const pathname = usePathname();

  return (
    <aside className="sidebar" aria-label="Navigasi utama">
      <Link className="brand" href="/" aria-label="PI-CORE Dashboard">
        <div className="brand-mark" aria-hidden="true">
          <Sparkles size={22} strokeWidth={2.5} />
        </div>
        <div className="brand-copy">
          <span>PI-CORE</span>
          <span className="brand-subtitle">PMK ITERA</span>
        </div>
      </Link>

      <nav className="nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={isActive ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span className="badge badge-green" style={{ fontSize: 11, padding: "2px 8px" }}>
            <span className="badge-dot" />
            Edge Live
          </span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>v1.0.0</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, lineHeight: 1.4 }}>
          Centralized Organization & Role Engine
        </div>
      </div>
    </aside>
  );
}

export function MobileNav(): JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav" aria-label="Navigasi mobile" style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      display: "flex",
      justifyContent: "space-around",
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(12px)",
      borderTop: "1px solid rgba(0,0,0,0.08)",
      padding: "8px 12px calc(8px + env(safe-area-inset-bottom))",
    }}>
      {navItems.slice(0, 5).map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              borderRadius: 8,
              color: isActive ? "var(--color-primary)" : "var(--color-muted)",
              fontSize: 11,
              fontWeight: isActive ? 700 : 500,
            }}
          >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
