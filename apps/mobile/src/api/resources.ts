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
