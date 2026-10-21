/**
 * The Directory screen, rendered headlessly — no device, no Metro, no network.
 *
 * This is the app's first run of any screen: it had never been executed anywhere before the web
 * preview build, so the states it claims to handle (rows, empty, refused, offline, session ended) had
 * never actually been produced. Each test drives one of them through a mocked `fetch` and asserts the
 * text a member would read, because a state that renders the wrong sentence is a bug the typechecker
 * cannot see.
 *
 * Queries come from the object `render` returns rather than the global `screen`: with two copies of
 * the library resolvable in a pnpm workspace the global is the stub, and a test that fails on its own
 * plumbing proves nothing about the screen.
 */
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { DirectoryScreen } from "./DirectoryScreen";

jest.mock("../auth/session", () => ({
  authHeaders: jest.fn(async () => ({ authorization: "Bearer test-token" })),
}));

jest.mock("../config", () => ({ API_URL: "https://api.test", MOBILE_REDIRECT_URI: "picore://auth" }));

// The realtime hook opens a socket/EventSource; the screen only uses its status, and a socket in a
// test runner is noise rather than signal.
jest.mock("../realtime/useRealtime", () => ({
  useMobileRealtime: () => ({ status: "connected" }),
}));

const fetchMock = jest.fn();

const members = [
  { id: "m1", email: "ani@student.itera.ac.id", fullName: "Ani Lestari", status: "active", nim: "121140001" },
  { id: "m2", email: "budi@student.itera.ac.id", fullName: "Budi Santoso", status: "inactive", nim: null },
];

const roles = [
  { id: "r1", key: "anggota", name: "Anggota", description: null, isSystem: true, permissions: [] },
];

const periods = [
  { id: "p1", label: "2026/2027", startDate: "2026-08-01", endDate: "2027-07-31", isActive: true },
];

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

/** Answers the three reads the screen makes in parallel, keyed by path. */
function respondWith(
  overrides: { members?: () => Response; roles?: () => Response; periods?: () => Response } = {},
): void {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("/api/v1/members")) {
      return overrides.members?.() ?? jsonResponse({ items: members, nextCursor: null, sensitiveIncluded: true });
    }
    if (url.includes("/api/v1/roles")) {
      return overrides.roles?.() ?? jsonResponse({ items: roles });
    }
    if (url.includes("/api/v1/periods")) {
      return overrides.periods?.() ?? jsonResponse({ items: periods });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

describe("DirectoryScreen", () => {
  it("renders the members the API returned, with status and NIM", async () => {
    respondWith();

    const view = await render(<DirectoryScreen />);

    expect(await view.findByText("Ani Lestari")).toBeTruthy();
    expect(view.getByText("Budi Santoso")).toBeTruthy();
    expect(view.getByText("121140001")).toBeTruthy();
    // A member with no NIM says so instead of rendering a blank line.
    expect(view.getByText("NIM belum diisi")).toBeTruthy();
    expect(view.getByText("2 anggota")).toBeTruthy();
    expect(view.getByText("Aktif")).toBeTruthy();
    expect(view.getByText("Nonaktif")).toBeTruthy();
  });

  it("says NIMs are restricted when the actor lacks member:read_sensitive", async () => {
    respondWith({
      members: () => jsonResponse({ items: members, nextCursor: null, sensitiveIncluded: false }),
    });

    const view = await render(<DirectoryScreen />);

    expect(await view.findByText("Ani Lestari")).toBeTruthy();
    expect(view.getByText("2 anggota · NIM dibatasi izin")).toBeTruthy();
    // Not a blank: the reason is stated, once per row.
    expect(view.getAllByText("NIM tidak berhak dilihat")).toHaveLength(2);
  });

  it("filters as the member types, and says so when nothing matches", async () => {
    respondWith();

    const view = await render(<DirectoryScreen />);

    const search = await view.findByPlaceholderText("Cari nama, email, atau NIM");
    fireEvent.changeText(search, "budi");

    await waitFor(() => {
      expect(view.getByText("1 anggota")).toBeTruthy();
    });
    expect(view.queryByText("Ani Lestari")).toBeNull();

    fireEvent.changeText(search, "tidak-ada");
    expect(await view.findByText("Tidak ada anggota yang cocok.")).toBeTruthy();
  });

  it("reports an ended session as such, not as an empty directory", async () => {
    respondWith({ members: () => jsonResponse({ error: { code: "unauthorized" } }, 401) });

    const view = await render(<DirectoryScreen />);

    expect(await view.findByText("Sesi berakhir")).toBeTruthy();
    expect(view.getByText("Masuk ulang untuk melanjutkan.")).toBeTruthy();
    expect(view.queryByText("Belum ada anggota terdaftar.")).toBeNull();
  });

  it("reports a refusal as a refusal", async () => {
    respondWith({ members: () => jsonResponse({ error: { code: "forbidden" } }, 403) });

    const view = await render(<DirectoryScreen />);

    expect(await view.findByText("Akses ditolak")).toBeTruthy();
    expect(view.getByText("Anda tidak memiliki izin untuk melihat halaman ini.")).toBeTruthy();
  });

  it("reports a transport failure as no connection, and offers a retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    const view = await render(<DirectoryScreen />);

    expect(await view.findByText("Tidak ada koneksi")).toBeTruthy();
    expect(view.getByText("Coba lagi")).toBeTruthy();
  });

  it("distinguishes an empty directory from a failed one", async () => {
    respondWith({
      members: () => jsonResponse({ items: [], nextCursor: null, sensitiveIncluded: true }),
    });

    const view = await render(<DirectoryScreen />);

    expect(await view.findByText("Belum ada anggota terdaftar.")).toBeTruthy();
    expect(view.getByText("0 anggota")).toBeTruthy();
  });
});
