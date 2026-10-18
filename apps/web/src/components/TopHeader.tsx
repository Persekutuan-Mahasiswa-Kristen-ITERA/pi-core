"use client";

import type { JSX } from "react";
import { RealtimeStatusIndicator, useRealtime } from "../app/realtime";

export function TopHeader({ pageTitle }: { pageTitle: string }): JSX.Element {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://pi-core-api-staging.pmkitera.workers.dev";
  const { status } = useRealtime({ apiBaseUrl });

  return (
    <header className="topbar">
      <div className="breadcrumb" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <strong>PI-CORE Admin</strong> <span aria-hidden="true">/</span> {pageTitle}
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
  );
}
