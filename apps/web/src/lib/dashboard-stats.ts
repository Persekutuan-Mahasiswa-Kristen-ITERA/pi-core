/**
 * The dashboard's stat cards, as pure functions.
 *
 * They are here because the cards used to be wrong in two different ways and both were invisible in
 * review: "Total Anggota" was the length of a `limit=6` fetch (so an organization of 120 read as "6"),
 * and "Struktur Unit" / "Peran & Izin" were typed-in constants ("25 Unit", "10 Peran", "23 Granular
 * Permissions") that no endpoint had ever confirmed. A number on a dashboard is a claim; these helpers
 * derive the claim from the payload, and `null` means "not known yet" so the caller can print "—" instead
 * of a zero that reads like an empty organization.
 */

/** `GET /api/v1/org-units` — the columns `listOrgUnits` selects. */
export interface OrgUnitLike {
  type: string;
  isActive?: boolean;
}

export interface UnitPart {
  type: string;
  label: string;
  count: number;
}

export interface UnitBreakdown {
  total: number;
  parts: UnitPart[];
}

/** `org_units.type` from `docs/ARCHITECTURE.md` §2 — the fixed vocabulary, in the order it is shown. */
const UNIT_ORDER = ["organization", "bph", "department", "bureau", "division"] as const;

const UNIT_LABEL: Record<string, string> = {
  organization: "Organisasi",
  bph: "BPH",
  department: "Departemen",
  bureau: "Biro",
  division: "Divisi",
};

export function unitLabel(type: string): string {
  return UNIT_LABEL[type] ?? type;
}

/**
 * Counts units by type.
 *
 * Inactive units are counted too: the card describes the organization as it is stored, and a unit that
 * was deactivated still occupies a row someone may need to see. Callers that want only live units must
 * filter before calling rather than rely on a silent default here.
 */
export function unitBreakdown(units: readonly OrgUnitLike[]): UnitBreakdown {
  const counts = new Map<string, number>();
  for (const unit of units) {
    counts.set(unit.type, (counts.get(unit.type) ?? 0) + 1);
  }

  const parts: UnitPart[] = [];
  for (const type of UNIT_ORDER) {
    const count = counts.get(type);
    if (count !== undefined) parts.push({ type, label: unitLabel(type), count });
    counts.delete(type);
  }
  // A type the vocabulary does not know is still shown, under its raw name: dropping it would make the
  // parts disagree with the total.
  for (const [type, count] of [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    parts.push({ type, label: unitLabel(type), count });
  }

  return { total: units.length, parts };
}

/** "1 BPH · 8 Departemen · 16 Divisi" — the sub-line under the unit total. */
export function unitBreakdownText(breakdown: UnitBreakdown): string {
  return breakdown.parts.map((part) => `${String(part.count)} ${part.label}`).join(" · ");
}

/** `GET /api/v1/roles` — only the fields the summary needs. */
export interface RoleLike {
  permissions: ReadonlyArray<{ key: string }>;
}

export interface RoleSummary {
  roles: number;
  /** Distinct permission keys across every role, which is what "izin berbeda" means. */
  permissions: number;
}

export function roleSummary(roles: readonly RoleLike[]): RoleSummary {
  const keys = new Set<string>();
  for (const role of roles) {
    for (const permission of role.permissions) keys.add(permission.key);
  }
  return { roles: roles.length, permissions: keys.size };
}

/** `null` = unknown (still loading, or the request failed). Never render it as 0. */
export function statText(value: number | null): string {
  return value === null ? "—" : String(value);
}
