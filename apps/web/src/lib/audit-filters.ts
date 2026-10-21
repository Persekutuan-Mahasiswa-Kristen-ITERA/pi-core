/**
 * The audit screen's filter state, as data rather than as JSX.
 *
 * It lives here so it can be tested without rendering: the date conversion is the part that can be
 * silently wrong (a WIB day that starts at 07:00 local still looks like a date range), and a page
 * component is a bad place to discover that.
 */

/** What the reader has narrowed the log to. `ALL`/empty string mean "not filtered". */
export const ALL = "Semua";

export interface AuditFilters {
  action: string;
  entityType: string;
  from: string;
  to: string;
}

/**
 * A WIB calendar day as the UTC instant it begins or ends.
 *
 * The picker gives `YYYY-MM-DD` in the reader's day, and the API validates `z.iso.datetime()`, which
 * expects `Z`. Converting through `+07:00` keeps "today" meaning today in Jakarta; a naive
 * `T00:00:00Z` would start the range at 07:00 local and quietly drop the first seven hours.
 */
export function wibDayBoundary(day: string, edge: "start" | "end"): string | null {
  if (day === "") return null;
  const time = edge === "start" ? "T00:00:00.000" : "T23:59:59.999";
  const parsed = new Date(`${day}${time}+07:00`);
  // `toISOString()` throws on an invalid date, so the guard is the difference between "no filter" and
  // a crash while the reader is mid-typing.
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * The query string for `GET /api/v1/audit`.
 *
 * Unset filters are omitted rather than sent as "Semua": the endpoint's schema is `.strict()` with
 * optional fields, and `action=Semua` would ask for an action that does not exist.
 */
export function buildAuditQuery(filters: AuditFilters, cursor: string | null, limit: number): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filters.action !== ALL) params.set("action", filters.action);
  if (filters.entityType !== ALL) params.set("entityType", filters.entityType);

  const from = wibDayBoundary(filters.from, "start");
  if (from !== null) params.set("from", from);
  const to = wibDayBoundary(filters.to, "end");
  if (to !== null) params.set("to", to);

  if (cursor !== null) params.set("cursor", cursor);
  return params.toString();
}
