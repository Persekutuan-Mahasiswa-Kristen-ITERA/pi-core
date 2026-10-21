"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import { Filter, Lock, Clock, Globe, RefreshCw, ShieldAlert, Boxes, CalendarDays, X } from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";
import { apiFetch } from "../../lib/api-client";
import { ALL, buildAuditQuery, type AuditFilters } from "../../lib/audit-filters";
import { useSession } from "../../lib/session";

/** `AuditEntryView` in `packages/db/src/audit-log.ts` — `before`/`after` are already redacted. */
interface AuditEntry {
  id: string;
  at: string;
  actorMemberId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
}

const PAGE_SIZE = 50;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "kosong";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

/**
 * Audit rows store the whole row before and after the mutation, so a diff is the honest summary.
 * Field names only — the values were redacted on the way out for anything sensitive.
 */
function describeChange(entry: AuditEntry): string {
  const { before, after } = entry;
  if (after === null && before !== null) return `Dihapus — ${Object.keys(before).length} field`;
  if (after === null) return "—";
  if (before === null) {
    const keys = Object.keys(after);
    return `Dibuat — ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? ` (+${String(keys.length - 4)})` : ""}`;
  }

  const changed = Object.keys(after).filter(
    (key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null),
  );
  if (changed.length === 0) return "Tanpa perubahan nilai";
  const shown = changed
    .slice(0, 2)
    .map((key) => `${key}: ${formatValue(before[key])} → ${formatValue(after[key])}`)
    .join("; ");
  return changed.length > 2 ? `${shown} (+${String(changed.length - 2)} field lain)` : shown;
}

function actionBadgeClass(action: string): string {
  if (action.includes("create") || action.includes("add")) return "badge badge-green";
  if (action.includes("delete") || action.includes("remove") || action.includes("deactivat")) {
    return "badge badge-gray";
  }
  if (action.includes("activate")) return "badge badge-gold";
  return "badge badge-blue";
}

export default function AuditLogPage(): JSX.Element {
  const session = useSession();
  const authenticated = session.state.status === "authenticated";

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(ALL);
  const [entityFilter, setEntityFilter] = useState(ALL);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(
    async (filters: AuditFilters, cursor: string | null): Promise<void> => {
      if (!authenticated) {
        setEntries([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = buildAuditQuery(filters, cursor, PAGE_SIZE);

        const response = await apiFetch(`/api/v1/audit?${params}`);
        if (response.status === 401) {
          setError("Sesi berakhir. Masuk kembali untuk melihat log audit.");
          setEntries([]);
          return;
        }
        if (response.status === 403) {
          // The log is org-wide: a unit-scoped actor holds audit:read but cannot be served, and the
          // server refuses rather than narrowing. Say that instead of showing an empty table.
          setError("Log audit bersifat organisasi-wide dan tidak bisa dipersempit per unit, jadi peran Anda belum berhak membacanya.");
          setEntries([]);
          return;
        }
        if (!response.ok) {
          setError(`Gagal memuat log audit (HTTP ${String(response.status)}).`);
          return;
        }

        const body = (await response.json()) as AuditPage;
        setEntries((previous) => (cursor === null ? body.items : [...previous, ...body.items]));
        setNextCursor(body.nextCursor);
      } catch {
        setError("Tidak dapat menghubungi API. Periksa koneksi lalu coba lagi.");
      } finally {
        setLoading(false);
      }
    },
    [authenticated],
  );

  useEffect(() => {
    void load({ action: filter, entityType: entityFilter, from: fromDate, to: toDate }, null);
  }, [load, filter, entityFilter, fromDate, toDate]);

  // The chips come from the log itself, so a filter can never offer a value that matches nothing.
  useEffect(() => {
    if (!authenticated) return;
    void (async () => {
      try {
        const [actionResponse, entityResponse] = await Promise.all([
          apiFetch("/api/v1/audit/actions"),
          apiFetch("/api/v1/audit/entity-types"),
        ]);
        if (actionResponse.ok) {
          const body = (await actionResponse.json()) as { items: string[] };
          setActions(body.items);
        }
        if (entityResponse.ok) {
          const body = (await entityResponse.json()) as { items: string[] };
          setEntityTypes(body.items);
        }
      } catch {
        // The chips are a convenience; the table still works without them.
      }
    })();
  }, [authenticated]);

  const chips = [ALL, ...actions];
  const entityChips = [ALL, ...entityTypes];
  const filtersActive = filter !== ALL || entityFilter !== ALL || fromDate !== "" || toDate !== "";

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Log Audit Keamanan" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Keamanan &amp; Kepatuhan</p>
              <h1>Log Audit Keamanan (Append-Only)</h1>
              <p className="subtitle">
                Catatan mutasi data permanen. Nilai sensitif sudah dihapus di server sebelum dikirim, jadi
                yang tampil tidak pernah memuat rahasia.
              </p>
            </div>
            <span className="badge badge-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
              <Lock size={13} />
              <span>Append-only</span>
            </span>
          </div>

          {error !== null ? (
            <div
              className="card"
              style={{ padding: "10px 14px", marginBottom: 16, fontSize: 13, borderColor: "var(--color-negative)" }}
            >
              <strong style={{ color: "var(--color-negative)" }}>Tidak dapat menampilkan log.</strong> {error}
              <button
                className="button button-secondary"
                type="button"
                style={{ marginLeft: 12, minHeight: 28, padding: "2px 10px", fontSize: 12 }}
                onClick={() => void load({ action: filter, entityType: entityFilter, from: fromDate, to: toDate }, null)}
              >
                <RefreshCw size={13} /> Coba lagi
              </button>
            </div>
          ) : null}

          <div className="filter-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Filter size={15} style={{ color: "var(--color-muted)" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-heading)" }}>Filter Aksi:</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {chips.map((action) => (
                <button
                  key={action}
                  type="button"
                  className={`button ${filter === action ? "button-gold" : "button-secondary"}`}
                  style={{ minHeight: 32, padding: "4px 12px", fontSize: 12 }}
                  onClick={() => setFilter(action)}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Boxes size={15} style={{ color: "var(--color-muted)" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-heading)" }}>Filter Entitas:</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {entityChips.map((entityType) => (
                <button
                  key={entityType}
                  type="button"
                  className={`button ${entityFilter === entityType ? "button-gold" : "button-secondary"}`}
                  style={{ minHeight: 32, padding: "4px 12px", fontSize: 12 }}
                  onClick={() => setEntityFilter(entityType)}
                >
                  {entityType}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarDays size={15} style={{ color: "var(--color-muted)" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-heading)" }}>Rentang Waktu (WIB):</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <input
                type="date"
                className="select-input"
                aria-label="Dari tanggal"
                value={fromDate}
                max={toDate === "" ? undefined : toDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
              <span style={{ fontSize: 12.5, color: "var(--color-muted)" }}>sampai</span>
              <input
                type="date"
                className="select-input"
                aria-label="Sampai tanggal"
                value={toDate}
                min={fromDate === "" ? undefined : fromDate}
                onChange={(event) => setToDate(event.target.value)}
              />
              {filtersActive ? (
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ minHeight: 32, padding: "4px 12px", fontSize: 12 }}
                  onClick={() => {
                    setFilter(ALL);
                    setEntityFilter(ALL);
                    setFromDate("");
                    setToDate("");
                  }}
                >
                  <X size={13} /> Reset filter
                </button>
              ) : null}
            </div>
          </div>

          <div className="card card-hover">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu Kejadian</th>
                    <th>Tipe Aksi</th>
                    <th>Aktor</th>
                    <th>Entitas</th>
                    <th>Rincian Perubahan</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {!authenticated && !loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "48px 16px" }}>
                        <ShieldAlert
                          size={36}
                          style={{ margin: "0 auto 12px", color: "var(--color-muted)", opacity: 0.5 }}
                        />
                        <strong style={{ display: "block", color: "var(--color-heading)", fontSize: 15 }}>
                          Masuk untuk melihat log audit
                        </strong>
                        <button
                          className="button button-primary"
                          type="button"
                          style={{ marginTop: 12 }}
                          onClick={() => void session.signIn()}
                        >
                          Masuk dengan Google
                        </button>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-muted)" }}
                      >
                        {loading ? "Memuat log…" : "Belum ada catatan audit untuk filter ini."}
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              color: "var(--color-muted)",
                              fontSize: 12.5,
                            }}
                          >
                            <Clock size={13} />
                            <span>{new Date(entry.at).toLocaleString("id-ID")}</span>
                          </div>
                        </td>
                        <td>
                          <span className={actionBadgeClass(entry.action)}>
                            <span className="badge-dot" />
                            {entry.action}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 13.5, color: "var(--color-heading)" }}>
                            {entry.actorName ?? entry.actorMemberId ?? "sistem"}
                          </strong>
                        </td>
                        <td>
                          <code
                            style={{
                              padding: "3px 8px",
                              borderRadius: 6,
                              backgroundColor: "rgba(0,0,0,0.05)",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                            title={entry.entityId}
                          >
                            {entry.entityType}
                          </code>
                        </td>
                        <td style={{ maxWidth: 360, color: "var(--color-body)", fontSize: 13 }}>
                          {describeChange(entry)}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              color: "var(--color-muted)",
                              fontSize: 12,
                            }}
                          >
                            <Globe size={13} />
                            <span>{entry.ip ?? "—"}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {nextCursor !== null ? (
              <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => void load({ action: filter, entityType: entityFilter, from: fromDate, to: toDate }, nextCursor)}
                >
                  {loading ? "Memuat…" : "Muat lebih banyak"}
                </button>
              </div>
            ) : null}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
