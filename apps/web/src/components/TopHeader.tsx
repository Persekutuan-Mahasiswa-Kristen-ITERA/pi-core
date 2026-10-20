"use client";

import type { JSX } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, LogIn, LogOut } from "lucide-react";
import { RealtimeStatusIndicator, useRealtime } from "../app/realtime";
import { API_BASE_URL } from "../lib/oidc";
import { useSession } from "../lib/session";

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters === "" ? "?" : letters;
}

export function TopHeader({ pageTitle }: { pageTitle: string }): JSX.Element {
  const apiBaseUrl = API_BASE_URL;
  const { status } = useRealtime({ apiBaseUrl });
  const { state, signIn, signOut } = useSession();

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
          href={`${apiBaseUrl}/api/v1/health`}
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

        {state.status === "authenticated" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="avatar">{initials(state.access.member.name)}</div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 700, color: "var(--color-heading)", fontSize: 13 }}>
                  {state.access.member.name}
                </span>
                <span className="badge badge-gold" style={{ fontSize: 10, padding: "1px 6px" }}>
                  {state.access.roles[0] ?? "anggota"}
                </span>
              </div>
              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
                {state.access.member.email}
              </span>
            </div>
            <button
              type="button"
              className="button button-secondary"
              onClick={signOut}
              title="Akhiri sesi di peramban ini"
              style={{ minHeight: 34, padding: "4px 10px", fontSize: 12, gap: 4 }}
            >
              <LogOut size={12} />
              <span>Keluar</span>
            </button>
          </div>
        ) : state.status === "loading" ? (
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>Memeriksa sesi…</span>
        ) : (
          <button
            type="button"
            className="button button-primary"
            onClick={() => void signIn()}
            style={{ minHeight: 34, padding: "4px 12px", fontSize: 12, gap: 6 }}
          >
            <LogIn size={13} />
            <span>Masuk dengan Google</span>
          </button>
        )}
      </div>
    </header>
  );
}
