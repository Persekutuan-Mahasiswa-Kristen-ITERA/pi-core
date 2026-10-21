/**
 * Presentation rules for the integrations screen, kept out of the page so they can be tested.
 *
 * Two things are deliberately *not* decided here:
 *
 * - whether a client counts as connected — the API computes `status` with its 30-day window
 *   (`getIntegrationConnectionStatus`) and that rule must not be re-derived in the browser, or the two
 *   will disagree the day one of them changes;
 * - anything about tokens. The list endpoint never returns a secret, and nothing here may invent one.
 *
 * What is decided here is the wording, which is exactly where a screen can lie: "Nonaktif" (an admin
 * disabled the client) and "Belum terhubung" (enabled, nobody ever authorized) are different problems
 * with different fixes, and a single "Tidak aktif" for both sends the reader to the wrong place.
 */

export type IntegrationStatus = "connected" | "not_connected" | "disabled";

/** `GET /api/v1/integrations` — `routes/integrations.ts`. */
export interface Integration {
  clientId: string;
  name: string | null;
  redirectUris: string[];
  scopes: string[] | null;
  enabled: boolean;
  status: IntegrationStatus;
  lastAuthorizedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Terhubung",
  not_connected: "Belum terhubung",
  disabled: "Nonaktif",
};

const STATUS_HINT: Record<IntegrationStatus, string> = {
  connected:
    "Ada anggota yang mengizinkan aplikasi ini dalam 30 hari terakhir.",
  not_connected:
    "Aplikasi terdaftar dan aktif, tetapi belum ada yang mengizinkan akses.",
  disabled:
    "Dinonaktifkan oleh admin: permintaan otorisasi ditolak sampai diaktifkan lagi.",
};

/** An unknown status string from a newer API is shown as-is rather than silently called connected. */
export function statusLabel(status: string): string {
  return STATUS_LABEL[status as IntegrationStatus] ?? status;
}

export function statusHint(status: string): string {
  return STATUS_HINT[status as IntegrationStatus] ?? "";
}

/** Connected first, then waiting-for-first-use, then switched off; alphabetical inside each group. */
export function sortIntegrations(items: readonly Integration[]): Integration[] {
  const rank: Record<string, number> = {
    connected: 0,
    not_connected: 1,
    disabled: 2,
  };
  return [...items].sort((left, right) => {
    const byStatus = (rank[left.status] ?? 3) - (rank[right.status] ?? 3);
    if (byStatus !== 0) return byStatus;
    return displayName(left).localeCompare(displayName(right), "id");
  });
}

/** A client with no name still has to be identifiable; the id is the only honest fallback. */
export function displayName(
  integration: Pick<Integration, "clientId" | "name">,
): string {
  const name = integration.name?.trim();
  return name !== undefined && name !== "" ? name : integration.clientId;
}

const WIB = "Asia/Jakarta";

function wibTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${parts.replace(":", ".")} WIB`;
}

function wibDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * "Kapan terakhir dipakai" in words a reader can act on.
 *
 * The day difference is computed on WIB calendar days, not on elapsed milliseconds: a request at 23.50
 * WIB and one at 00.10 WIB are 20 minutes apart but read as "kemarin" and "hari ini" to a human, and
 * showing "0 hari lalu" for the second would be nonsense.
 */
export function formatLastAuthorized(
  iso: string | null,
  now: Date = new Date(),
): string {
  if (iso === null) return "Belum pernah diizinkan";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Belum pernah diizinkan";

  const dayOf = (value: Date): number =>
    Math.floor(
      new Date(
        new Intl.DateTimeFormat("en-CA", { timeZone: WIB }).format(value),
      ).getTime() / 86_400_000,
    );

  const days = dayOf(now) - dayOf(date);
  if (days <= 0) return `Hari ini, ${wibTime(date)}`;
  if (days === 1) return `Kemarin, ${wibTime(date)}`;
  if (days < 30) return `${String(days)} hari lalu, ${wibDate(date)}`;
  return wibDate(date);
}
