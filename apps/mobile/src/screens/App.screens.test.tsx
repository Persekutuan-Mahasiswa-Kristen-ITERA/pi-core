/**
 * The two screens that live in `App.tsx`: the structure report and the member's own profile.
 *
 * Both were only reachable by signing in on a phone, so neither had ever rendered. The report is worth
 * pinning because its numbers come from two endpoints that answer different questions — the unit tree
 * (`unitsByType`) and the assignment counts — and a screen that mixes them up shows a total that
 * describes the wrong thing. The profile is worth pinning because it is the only place a member edits
 * data, and a refusal from the server has to be shown rather than swallowed.
 */
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ProfileScreen, ReportsScreen } from "../../App";

jest.mock("../auth/session", () => ({
  authHeaders: jest.fn(async () => ({ authorization: "Bearer test-token" })),
}));

jest.mock("../config", () => ({ API_URL: "https://api.test", MOBILE_REDIRECT_URI: "picore://auth" }));

jest.mock("../realtime/useRealtime", () => ({
  useMobileRealtime: () => ({ status: "connected" }),
}));

const fetchMock = jest.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

describe("ReportsScreen", () => {
  /** The summary is assembled from four reads; the report only needs their counts. */
  function serveSummary(): void {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/v1/members")) {
        return jsonResponse({
          items: [{ id: "m1", email: "a@student.itera.ac.id", fullName: "Ani", status: "active" }],
          nextCursor: null,
          sensitiveIncluded: true,
        });
      }
      if (url.includes("/api/v1/roles")) return jsonResponse({ items: [] });
      if (url.includes("/api/v1/periods")) return jsonResponse({ items: [] });
      if (url.includes("/api/v1/org-units")) {
        const units = [
          ...Array.from({ length: 1 }, (_, i) => ({ id: `bph-${String(i)}`, type: "bph" })),
          ...Array.from({ length: 7 }, (_, i) => ({ id: `dept-${String(i)}`, type: "department" })),
          ...Array.from({ length: 1 }, (_, i) => ({ id: `bureau-${String(i)}`, type: "bureau" })),
          ...Array.from({ length: 16 }, (_, i) => ({ id: `div-${String(i)}`, type: "division" })),
        ];
        return jsonResponse({ items: units });
      }
      if (url.includes("/api/v1/assignments/stats")) {
        return jsonResponse({
          total: 30,
          byUnitType: [
            { unitType: "bph", count: 6 },
            { unitType: "division", count: 24 },
          ],
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  it("shows unit counts from the org tree and assignment totals from the counts endpoint", async () => {
    serveSummary();

    const view = await render(<ReportsScreen />);

    expect(await view.findByText("7 unit")).toBeTruthy();
    expect(view.getByText("16 unit")).toBeTruthy();
    // BPH and Biro both hold exactly one unit, so the count appears twice by design.
    expect(view.getAllByText("1 unit")).toHaveLength(2);
    // Assignments are counted separately, so "0 penugasan" for a type with none is a fact, not a gap.
    expect(view.getByText(/6 penugasan\s*— Ketua Umum, Wakil Ketua, Sekretaris Umum, Bendahara Umum\./)).toBeTruthy();
    expect(view.getByText(/24 penugasan\s*— divisi di bawah departemen atau biro\./)).toBeTruthy();
    expect(view.getByText(/0 penugasan\s*— unit setingkat departemen dengan fungsi pendukung\./)).toBeTruthy();
  });

  it("says it could not load rather than showing zeroes when the API fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    const view = await render(<ReportsScreen />);

    expect(
      await view.findByText("Tidak dapat dimuat — Ketua Umum, Wakil Ketua, Sekretaris Umum, Bendahara Umum."),
    ).toBeTruthy();
    expect(view.getAllByText("—")).toHaveLength(4);
    // The dangerous failure would be "0 unit" everywhere: it looks like an empty organization.
    expect(view.queryByText("0 unit")).toBeNull();
  });
});

describe("ProfileScreen", () => {
  const profile = {
    member: {
      id: "m1",
      email: "ani@student.itera.ac.id",
      fullName: "Ani Lestari",
      status: "active",
      nim: "121140001",
      phone: "081234567890",
      faculty: "Fakultas Teknik",
      studyProgram: "Teknik Informatika",
      cohortYear: 2023,
    },
    roles: ["anggota"],
  };

  it("renders the member's own identity, including the fields they may not have filled", async () => {
    fetchMock.mockResolvedValue(jsonResponse(profile));

    const view = await render(<ProfileScreen onSignOut={() => undefined} />);

    expect(await view.findByText("Ani Lestari")).toBeTruthy();
    expect(view.getByText("121140001")).toBeTruthy();
    expect(view.getByText("Teknik Informatika")).toBeTruthy();
    expect(view.getByText("2023")).toBeTruthy();
    expect(view.getByText("081234567890")).toBeTruthy();
    expect(view.getByText("Aktif")).toBeTruthy();
    // Initials, not the whole name, in the avatar.
    expect(view.getByText("AL")).toBeTruthy();
  });

  it("says a missing field is not filled instead of leaving it blank", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ member: { ...profile.member, nim: null, phone: null, faculty: null }, roles: [] }),
    );

    const view = await render(<ProfileScreen onSignOut={() => undefined} />);

    expect(await view.findByText("Ani Lestari")).toBeTruthy();
    // NIM, Fakultas and WhatsApp are all empty here.
    expect(view.getAllByText("Belum diisi")).toHaveLength(3);
  });

  it("tells the member when the server refuses a change, and does not claim it saved", async () => {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (init?.method === "PATCH") return jsonResponse({ error: { code: "forbidden" } }, 403);
      return jsonResponse(profile);
    });

    const view = await render(<ProfileScreen onSignOut={() => undefined} />);

    fireEvent.press(await view.findByText("Perbarui Kontak WhatsApp"));
    const input = await view.findByDisplayValue("081234567890");
    fireEvent.changeText(input, "089999999999");
    fireEvent.press(view.getByText("Simpan"));

    expect(await view.findByText("Server menolak perubahan ini.")).toBeTruthy();
    expect(view.queryByText("Nomor WhatsApp disimpan.")).toBeNull();
    // Let the press settle before the test ends, so the save's state updates are not still in flight
    // when RTL unmounts the tree (React 19 reports that as overlapping act() calls).
    await waitFor(() => {
      expect(view.queryByText("Menyimpan…")).toBeNull();
    });
  });
});
