"use client";

import type { JSX } from "react";
import Link from "next/link";
import { ChevronRight, Shield, Bell, ExternalLink } from "lucide-react";
import { RealtimeStatusIndicator, useRealtime } from "../app/realtime";

export function TopHeader({ pageTitle }: { pageTitle: string }): JSX.Element {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://pi-core-api-staging.pmkitera.workers.dev";
  const { status } = useRealtime({ apiBaseUrl });

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <Link href="/" style={{ color: "var(--color-muted)", fontWeight: 500 }}>
          Admin Portal
        </Link>
        <ChevronRight size={14} style={{ color: "rgba(0,0,0,0.3)" }} />
        <span className="breadcrumb-active">{pageTitle}</span>
        <div style={{ marginLeft: 12 }}>
          <RealtimeStatusIndicator status={status} />
        </div>
      </div>

      <div className="user-menu">
        <a
          href="https://pi-core-api-staging.pmkitera.workers.dev/api/v1/health"
          target="_blank"
          rel="noopener noreferrer"
          className="button button-secondary"
          style={{ minHeight: 34, padding: "4px 10px", fontSize: 12, gap: 4 }}
          title="Lihat status API Staging"
        >
          <span className="badge-dot" style={{ backgroundColor: "#10b981", width: 6, height: 6 }} />
          <span>API Health</span>
          <ExternalLink size={12} />
        </a>

        <div style={{ height: 24, width: 1, backgroundColor: "rgba(0,0,0,0.08)", margin: "0 4px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="avatar">FY</div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 700, color: "var(--color-heading)", fontSize: 13 }}>Febryan Yoel</span>
              <span className="badge badge-gold" style={{ fontSize: 10, padding: "1px 6px" }}>BPH</span>
            </div>
            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Super Administrator</span>
          </div>
        </div>
      </div>
    </header>
  );
}
