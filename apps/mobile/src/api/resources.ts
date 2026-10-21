/**
 * Typed reads of the API for the mobile screens.
 *
 * Every call carries the stored bearer token (`authHeaders`). The API re-checks admission on each
 * request, so a deactivated member gets 401/403 here even though the token has not expired — the
 * caller must render that instead of an empty list.
 */
import { authHeaders } from "../auth/session";
import { API_URL } from "../config";

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`http_${String(status)}`);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    headers: { accept: "application/json", ...headers },
  });
  if (!response.ok) throw new ApiError(response.status);
  return (await response.json()) as T;
}

/** Mirrors `listMembers` in `packages/db/src/members.ts`. */
export interface MemberSummary {
  id: string;
  email: string;
  fullName: string;
  status: "active" | "inactive";
  nim?: string | null;
}

export interface MembersPage {
  items: MemberSummary[];
  nextCursor: string | null;
  /** False when the actor lacks `member:read_sensitive` — `nim` is then absent, not empty. */
  sensitiveIncluded: boolean;
}

/** Mirrors `listRoles` in `packages/db/src/roles.ts`. */
export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{ key: string; scope: string }>;
}

/** Mirrors `listPeriods` in `packages/db/src/periods.ts`. */
export interface PeriodSummary {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export function fetchMembers(limit = 100): Promise<MembersPage> {
  return getJson<MembersPage>(`/api/v1/members?limit=${String(limit)}`);
}

/** The caller's own record — `/api/v1/me` works with the opaque mobile token, unlike `/access`. */
export interface OwnProfile {
  member: {
    id: string;
    email: string;
    fullName: string;
    status: "active" | "inactive";
    nim?: string | null;
    phone?: string | null;
    faculty?: string | null;
    studyProgram?: string | null;
    cohortYear?: number | null;
  };
  roles: string[];
}

export function fetchMe(): Promise<OwnProfile> {
  return getJson<OwnProfile>("/api/v1/me");
}

/**
 * A member may change only their own phone and photo (FR-11); the API enforces that per field, so a
 * refusal here is the real rule answering, not a client-side check.
 */
export async function updateOwnPhone(memberId: string, phone: string): Promise<void> {
  const headers = await authHeaders();
  const response = await fetch(`${API_URL}/api/v1/members/${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ phone: phone === "" ? null : phone }),
  });
  if (!response.ok) throw new ApiError(response.status);
}

export function fetchRoles(): Promise<{ items: RoleSummary[] }> {
  return getJson<{ items: RoleSummary[] }>("/api/v1/roles");
}

export function fetchPeriods(): Promise<{ items: PeriodSummary[]; activePeriodId: string | null }> {
  return getJson<{ items: PeriodSummary[]; activePeriodId: string | null }>("/api/v1/periods");
}

/** Mirrors `OrgUnitRow` in `packages/db/src/org-units.ts` (the columns `listOrgUnits` selects). */
export interface OrgUnitSummary {
  id: string;
  name: string;
  type: "organization" | "bph" | "department" | "bureau" | "division";
}

export function fetchOrgUnits(): Promise<{ items: OrgUnitSummary[] }> {
  return getJson<{ items: OrgUnitSummary[] }>("/api/v1/org-units");
}

/** Mirrors `AssignmentView` in `packages/db/src/assignments.ts`. */
export interface AssignmentSummary {
  id: string;
  memberId: string;
  memberName: string | null;
  orgUnitName: string | null;
  positionName: string | null;
  positionRank: number | null;
  periodLabel: string | null;
  startsOn: string | null;
  endsOn: string | null;
}

export function fetchAssignments(limit = 200): Promise<{ items: AssignmentSummary[] }> {
  return getJson<{ items: AssignmentSummary[] }>(`/api/v1/assignments?limit=${String(limit)}`);
}

/** Organization profile — `orgName` is the only stored field the prototype also showed. */
export interface OrgSettings {
  orgName: string;
  logoKey: string | null;
}

export interface AllowedDomain {
  id: string;
  domain: string;
  allowSubdomains: boolean;
  isActive: boolean;
}

export function fetchOrgSettings(): Promise<{ settings: OrgSettings | null }> {
  return getJson<{ settings: OrgSettings | null }>("/api/v1/settings/org");
}

export function fetchAllowedDomains(): Promise<{ items: AllowedDomain[] }> {
  return getJson<{ items: AllowedDomain[] }>("/api/v1/settings/domains");
}

/**
 * The dashboard's figures, counted from what the API returned rather than written into the layout.
 *
 * `memberCount` is a floor: the list is capped and cursor-paged, so a full page means "at least this
 * many" and the caller renders it with a `+`.
 */
export interface DashboardSummary {
  memberCount: number;
  activeMemberCount: number;
  memberCountIsFloor: boolean;
  roleCount: number;
  permissionCount: number;
  activePeriodLabel: string | null;
  unitsByType: Record<string, number>;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const [memberPage, rolePage, periodPage, unitPage] = await Promise.all([
    fetchMembers(),
    fetchRoles(),
    fetchPeriods(),
    fetchOrgUnits(),
  ]);

  const unitsByType: Record<string, number> = {};
  for (const unit of unitPage.items) {
    unitsByType[unit.type] = (unitsByType[unit.type] ?? 0) + 1;
  }

  return {
    memberCount: memberPage.items.length,
    activeMemberCount: memberPage.items.filter((member) => member.status === "active").length,
    memberCountIsFloor: memberPage.nextCursor !== null,
    roleCount: rolePage.items.length,
    permissionCount: rolePage.items.reduce((total, role) => total + role.permissions.length, 0),
    activePeriodLabel: periodPage.items.find((period) => period.isActive)?.label ?? null,
    unitsByType,
  };
}

/**
 * Assignments grouped by the **type** of the unit they sit in, for the structure report.
 *
 * `GET /api/v1/assignments/stats` counts in SQL over the same scope predicate as the list, so these are
 * real totals — the list endpoint caps at 200 rows, and counting a page would report "at least N".
 */
export interface AssignmentStats {
  total: number;
  byUnitType: Record<string, number>;
}

export async function fetchAssignmentStats(): Promise<AssignmentStats> {
  const body = await getJson<{ total: number; byUnitType: Array<{ unitType: string; count: number }> }>(
    "/api/v1/assignments/stats",
  );

  const byUnitType: Record<string, number> = {};
  for (const entry of body.byUnitType) {
    byUnitType[entry.unitType] = entry.count;
  }

  return { total: body.total, byUnitType };
}
