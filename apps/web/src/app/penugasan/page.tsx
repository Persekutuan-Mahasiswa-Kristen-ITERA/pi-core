"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { Briefcase, Plus, X, RefreshCw, Users } from "lucide-react";
import { Sidebar, MobileNav } from "../../components/Sidebar";
import { TopHeader } from "../../components/TopHeader";
import { apiFetch } from "../../lib/api-client";
import { useSession } from "../../lib/session";

/** `AssignmentView` in `packages/db/src/assignments.ts`. */
interface AssignmentRow {
  id: string;
  memberId: string;
  memberName: string | null;
  orgUnitId: string;
  orgUnitName: string | null;
  positionId: string;
  positionName: string | null;
  positionRank: number | null;
  periodId: string;
  periodLabel: string | null;
  startsOn: string | null;
  endsOn: string | null;
}

interface PositionRow {
  id: string;
  key: string;
  name: string;
  unitType: string;
  rank: number;
}

interface OrgUnitRow {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  fullName: string;
  email: string;
}

interface PeriodOption {
  id: string;
  label: string;
  isActive: boolean;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PenugasanPage(): JSX.Element {
  const session = useSession();
  const authenticated = session.state.status === "authenticated";

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [assignmentTotal, setAssignmentTotal] = useState<number | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [units, setUnits] = useState<OrgUnitRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [modal, setModal] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [orgUnitId, setOrgUnitId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [startsOn, setStartsOn] = useState(today());

  const load = useCallback(async (): Promise<void> => {
    if (!authenticated) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [assignmentResponse, statsResponse, positionResponse, unitResponse, memberResponse, periodResponse] =
        await Promise.all([
          apiFetch("/api/v1/assignments?limit=200"),
          apiFetch("/api/v1/assignments/stats"),
          apiFetch("/api/v1/assignments/positions"),
          apiFetch("/api/v1/org-units"),
          apiFetch("/api/v1/members?limit=100"),
          apiFetch("/api/v1/periods"),
        ]);

      if (assignmentResponse.status === 401 || assignmentResponse.status === 403) {
        setError("Sesi ini tidak memiliki izin assignment:read.");
        setAssignments([]);
        return;
      }
      if (!assignmentResponse.ok) {
        setError(`Gagal memuat penugasan (HTTP ${String(assignmentResponse.status)}).`);
        return;
      }

      setAssignments(((await assignmentResponse.json()) as { items: AssignmentRow[] }).items);

      // The list is capped at 200 rows; the count endpoint is the only source of a real total.
      if (statsResponse.ok) {
        setAssignmentTotal(((await statsResponse.json()) as { total: number }).total);
      }

      // The pickers need the same data the server writes against; a failed side request degrades the
      // form (fewer options) but must not blank the table.
      if (positionResponse.ok) {
        setPositions(((await positionResponse.json()) as { items: PositionRow[] }).items);
      }
      if (unitResponse.ok) {
        setUnits(((await unitResponse.json()) as { items: OrgUnitRow[] }).items);
      }
      if (memberResponse.ok) {
        setMembers(((await memberResponse.json()) as { items: MemberOption[] }).items);
      }
      if (periodResponse.ok) {
        const body = (await periodResponse.json()) as { items: PeriodOption[] };
        setPeriods(body.items);
        const active = body.items.find((period) => period.isActive);
        if (active !== undefined) setPeriodId((current) => (current === "" ? active.id : current));
      }
    } catch {
      setError("Tidak dapat menghubungi API. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(): Promise<void> {
    if (memberId === "" || orgUnitId === "" || positionId === "" || periodId === "") {
      setError("Anggota, unit, jabatan, dan periode wajib dipilih.");
      return;
    }

    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const response = await apiFetch("/api/v1/assignments", {
        method: "POST",
        body: JSON.stringify({
          memberId,
          orgUnitId,
          positionId,
          periodId,
          startsOn: startsOn === "" ? null : startsOn,
        }),
      });

      if (response.status === 403) {
        setError("Peran Anda tidak memiliki izin assignment:manage.");
        return;
      }
      if (response.status === 409) {
        setError("Penugasan itu sudah ada, atau bertentangan dengan aturan jabatan/unit.");
        return;
      }
      if (!response.ok) {
        setError(`Gagal menyimpan penugasan (HTTP ${String(response.status)}).`);
        return;
      }

      setMemberId("");
      setModal(false);
      setNotice("Penugasan ditambahkan.");
      await load();
    } catch {
      setError("Tidak dapat menghubungi API. Penugasan belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }

  const sorted = useMemo(
    () =>
      [...assignments].sort(
        (a, b) =>
          (b.periodLabel ?? "").localeCompare(a.periodLabel ?? "") ||
          (a.positionRank ?? 999) - (b.positionRank ?? 999) ||
          (a.memberName ?? "").localeCompare(b.memberName ?? ""),
      ),
    [assignments],
  );

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <TopHeader pageTitle="Penugasan Jabatan" />
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Struktur Organisasi</p>
              <h1>Penugasan Jabatan per Periode</h1>
              <p className="subtitle">
                Setiap penugasan mengikat satu anggota ke satu jabatan di satu unit untuk satu periode. Peran
                yang berlaku diturunkan dari jabatan, bukan dipilih bebas.
              </p>
            </div>
            <button
              className="button button-gold"
              type="button"
              onClick={() => setModal(true)}
              disabled={!authenticated}
              title={authenticated ? undefined : "Masuk terlebih dahulu"}
            >
              <Plus size={16} />
              <span>Tambah Penugasan</span>
            </button>
          </div>

          {notice !== null ? (
            <div className="card" style={{ padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              {notice}
            </div>
          ) : null}

          {error !== null ? (
            <div
              className="card"
              style={{ padding: "10px 14px", marginBottom: 14, fontSize: 13, borderColor: "var(--color-negative)" }}
            >
              <strong style={{ color: "var(--color-negative)" }}>Terjadi kesalahan.</strong> {error}
              <button
                className="button button-secondary"
                type="button"
                style={{ marginLeft: 12, minHeight: 28, padding: "2px 10px", fontSize: 12 }}
                onClick={() => void load()}
              >
                <RefreshCw size={13} /> Coba lagi
              </button>
            </div>
          ) : null}

          <div className="card card-hover">
            <div className="card-heading">
              <div>
                <h2>Daftar Penugasan</h2>
                <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 0" }}>
                  {!authenticated
                    ? "Masuk untuk melihat penugasan."
                    : loading
                      ? "Memuat…"
                      : assignmentTotal === null
                        ? `${String(sorted.length)} penugasan dalam cakupan Anda.`
                        : `${String(assignmentTotal)} penugasan dalam cakupan Anda${sorted.length < assignmentTotal ? `, menampilkan ${String(sorted.length)} terbaru` : ""}.`}
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Anggota</th>
                    <th>Unit</th>
                    <th>Jabatan</th>
                    <th>Periode</th>
                    <th>Mulai</th>
                    <th>Selesai</th>
                  </tr>
                </thead>
                <tbody>
                  {!authenticated && !loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "48px 16px" }}>
                        <Users size={36} style={{ margin: "0 auto 12px", color: "var(--color-muted)", opacity: 0.5 }} />
                        <strong style={{ display: "block", color: "var(--color-heading)", fontSize: 15 }}>
                          Masuk untuk melihat penugasan
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
                  ) : sorted.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-muted)" }}
                      >
                        {loading ? "Memuat penugasan…" : "Belum ada penugasan pada cakupan Anda."}
                      </td>
                    </tr>
                  ) : (
                    sorted.map((assignment) => (
                      <tr key={assignment.id}>
                        <td>
                          <strong style={{ fontSize: 13.5, color: "var(--color-heading)" }}>
                            {assignment.memberName ?? assignment.memberId}
                          </strong>
                        </td>
                        <td style={{ color: "var(--color-heading-secondary)", fontSize: 13 }}>
                          {assignment.orgUnitName ?? "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span className="badge badge-gold" style={{ width: "fit-content" }}>
                              {assignment.positionName ?? assignment.positionId}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--color-muted)", paddingLeft: 4 }}>
                              rank {assignment.positionRank ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{assignment.periodLabel ?? "—"}</td>
                        <td style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
                          {assignment.startsOn ?? "—"}
                        </td>
                        <td style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
                          {assignment.endsOn ?? "Aktif"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {modal && (
            <div
              className="sheet-backdrop"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setModal(false);
              }}
            >
              <div className="card" style={{ width: 480, margin: "auto", padding: 28 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <h2>Tambah Penugasan</h2>
                  <button className="icon-button" type="button" onClick={() => setModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <p className="subtitle" style={{ marginBottom: 18 }}>
                  Pilih anggota, unit, jabatan dan periode. Peran diturunkan dari jabatan oleh server.
                </p>

                <div style={{ display: "grid", gap: 14 }}>
                  <div className="form-field">
                    <label>Anggota</label>
                    <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                      <option value="">— pilih anggota —</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName} ({member.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Unit Organisasi</label>
                    <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}>
                      <option value="">— pilih unit —</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Jabatan</label>
                    <select value={positionId} onChange={(e) => setPositionId(e.target.value)}>
                      <option value="">— pilih jabatan —</option>
                      {positions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.name} (rank {position.rank})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Periode</label>
                    <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                      <option value="">— pilih periode —</option>
                      {periods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.label}
                          {period.isActive ? " (aktif)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Tanggal Mulai</label>
                    <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    marginTop: 24,
                    paddingTop: 16,
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <button className="button button-secondary" type="button" onClick={() => setModal(false)}>
                    Batal
                  </button>
                  <button className="button button-gold" type="button" onClick={() => void handleCreate()} disabled={busy}>
                    <Briefcase size={15} />
                    <span>{busy ? "Menyimpan…" : "Simpan Penugasan"}</span>
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
