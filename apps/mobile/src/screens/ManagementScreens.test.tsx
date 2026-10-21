/**
 * The four management screens, rendered headlessly.
 *
 * They were hardcoded lists until recently — invented roles with invented grant counts, invented
 * periods, invented assignments naming people who are not in this organization. These tests pin that
 * each screen now reads its endpoint and renders what came back, including the parts that are easy to
 * get wrong: the period order, the "Aktif" badge appearing only on the active one, an assignment whose
 * names are missing falling back to ids rather than rendering "undefined", and the settings screen
 * showing "Belum diatur" instead of an empty string.
 */
import { render } from "@testing-library/react-native";

import { AssignmentsScreen, PeriodsScreen, RolesScreen, SettingsScreen } from "./ManagementScreens";

jest.mock("../auth/session", () => ({
  authHeaders: jest.fn(async () => ({ authorization: "Bearer test-token" })),
}));

jest.mock("../config", () => ({ API_URL: "https://api.test", MOBILE_REDIRECT_URI: "picore://auth" }));

const fetchMock = jest.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

function respondWith(body: unknown, status = 200): void {
  fetchMock.mockImplementation(async () => jsonResponse(body, status));
}

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

describe("RolesScreen", () => {
  it("lists each role with its key, its grant count and whether it is a system role", async () => {
    respondWith({
      items: [
        { id: "r1", key: "super_admin", name: "Super Admin", description: null, isSystem: true, permissions: [{ key: "a", scope: "O" }, { key: "b", scope: "O" }] },
        { id: "r2", key: "panitia_khusus", name: "Panitia Khusus", description: null, isSystem: false, permissions: [] },
      ],
    });

    const view = await render(<RolesScreen />);

    expect(await view.findByText("Super Admin")).toBeTruthy();
    expect(view.getByText("2 peran tersimpan di basis data.")).toBeTruthy();
    expect(view.getByText("super_admin")).toBeTruthy();
    expect(view.getByText("2 izin")).toBeTruthy();
    expect(view.getByText("Sistem")).toBeTruthy();
    // A custom role with no grants still renders; "0 izin" is information, not an empty row.
    expect(view.getByText("Panitia Khusus")).toBeTruthy();
    expect(view.getByText("0 izin")).toBeTruthy();
    expect(view.getByText("Kustom")).toBeTruthy();
  });
});

describe("PeriodsScreen", () => {
  it("orders periods newest first and marks only the active one", async () => {
    respondWith({
      items: [
        { id: "p1", label: "2024/2025", startDate: "2024-08-01", endDate: "2025-07-31", isActive: false },
        { id: "p2", label: "2026/2027", startDate: "2026-08-01", endDate: "2027-07-31", isActive: true },
        { id: "p3", label: "2025/2026", startDate: "2025-08-01", endDate: "2026-07-31", isActive: false },
      ],
    });

    const view = await render(<PeriodsScreen />);

    expect(await view.findByText("3 periode, 1 aktif.")).toBeTruthy();
    const labels = view.getAllByText(/^\d{4}\/\d{4}$/).map((node) => node.props.children as string);
    expect(labels).toEqual(["2026/2027", "2025/2026", "2024/2025"]);
    // Exactly one badge: the active period, not every row.
    expect(view.getAllByText("Aktif")).toHaveLength(1);
  });
});

describe("AssignmentsScreen", () => {
  it("renders who holds what, where, and in which period", async () => {
    respondWith({
      items: [
        {
          id: "a1",
          memberId: "m1",
          memberName: "Ani Lestari",
          orgUnitId: "u1",
          orgUnitName: "Divisi Ibadah",
          positionId: "pos1",
          positionName: "Staff",
          positionRank: 10,
          periodId: "p2",
          periodLabel: "2026/2027",
          endsOn: null,
        },
      ],
    });

    const view = await render(<AssignmentsScreen />);

    expect(await view.findByText("Ani Lestari")).toBeTruthy();
    expect(view.getByText("1 penugasan dalam cakupan Anda.")).toBeTruthy();
    expect(view.getByText("Divisi Ibadah · Staff (rank 10)")).toBeTruthy();
    expect(view.getByText("Periode 2026/2027 · Aktif")).toBeTruthy();
  });

  it("falls back to ids and an em dash when the joined names are absent", async () => {
    respondWith({
      items: [
        {
          id: "a2",
          memberId: "member-uuid",
          memberName: null,
          orgUnitId: "u1",
          orgUnitName: null,
          positionId: "pos1",
          positionName: null,
          positionRank: null,
          periodId: "p2",
          periodLabel: null,
          endsOn: "2026-12-31",
        },
      ],
    });

    const view = await render(<AssignmentsScreen />);

    // The id is ugly but true; "undefined" would be a bug that reads as missing data.
    expect(await view.findByText("member-uuid")).toBeTruthy();
    expect(view.getByText("— · — (rank —)")).toBeTruthy();
    expect(view.getByText("Periode — · Selesai 2026-12-31")).toBeTruthy();
  });
});

describe("SettingsScreen", () => {
  it("shows the organization identity and the allowed domains", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/v1/settings/domains")) {
        return jsonResponse({
          items: [
            { id: "d1", domain: "itera.ac.id", isActive: true, allowSubdomains: true },
            { id: "d2", domain: "student.itera.ac.id", isActive: false, allowSubdomains: true },
          ],
        });
      }
      if (url.includes("/api/v1/settings")) {
        return jsonResponse({ settings: { orgName: "PMK ITERA", logoKey: null } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const view = await render(<SettingsScreen />);

    expect(await view.findByText("PMK ITERA")).toBeTruthy();
    expect(view.getByText("Belum ada logo tersimpan.")).toBeTruthy();
    expect(view.getByText("@itera.ac.id")).toBeTruthy();
    // An inactive domain says so instead of looking identical to an active one.
    expect(view.getByText("@student.itera.ac.id (nonaktif)")).toBeTruthy();
  });

  it("says the name is not set rather than rendering a blank card", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/v1/settings/domains")) return jsonResponse({ items: [] });
      return jsonResponse({ settings: { orgName: null, logoKey: null } });
    });

    const view = await render(<SettingsScreen />);

    expect(await view.findByText("Belum diatur")).toBeTruthy();
    expect(view.getByText("Belum ada domain terdaftar.")).toBeTruthy();
  });

  it("reports a refusal instead of an empty settings page", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ error: { code: "forbidden" } }, 403));

    const view = await render(<SettingsScreen />);

    expect(await view.findByText("Akses ditolak")).toBeTruthy();
  });
});
