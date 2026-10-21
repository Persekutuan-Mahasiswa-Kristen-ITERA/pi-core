/**
 * Profile with an expired session.
 *
 * Two things are asserted, and the second one corrected a wrong assumption of mine: the screen reports
 * "Sesi berakhir" rather than an empty profile — and it **keeps** the sign-out control. That is right:
 * an expired token is still stored on the device, and signing out is exactly what clears it (the
 * session module deletes the local entry even when the server call fails). Hiding the only way out of
 * a dead session would strand the member.
 *
 * In its own file because React 19 + RTL v14 keep one act() queue per file, and the profile tests that
 * press buttons and await a save leave it busy long enough to make later renders in the same file
 * unreliable.
 */
import { render } from "@testing-library/react-native";

import { ProfileScreen } from "../../App";

jest.mock("../auth/session", () => ({
  authHeaders: jest.fn(async () => ({ authorization: "Bearer test-token" })),
}));

jest.mock("../config", () => ({ API_URL: "https://api.test", MOBILE_REDIRECT_URI: "picore://auth" }));

jest.mock("../realtime/useRealtime", () => ({
  useMobileRealtime: () => ({ status: "connected" }),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

it("reports an expired session instead of an empty profile, and still offers a way out", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: { code: "unauthorized" } }),
  } as unknown as Response);

  const view = await render(<ProfileScreen onSignOut={() => undefined} />);

  expect(await view.findByText("Sesi berakhir")).toBeTruthy();
  expect(view.getByText("Masuk ulang untuk melanjutkan.")).toBeTruthy();
  // The failure must not look like a member whose fields are simply empty.
  expect(view.queryByText("Belum diisi")).toBeNull();
  expect(view.queryByText("IDENTITAS AKADEMIK & KONTAK")).toBeNull();
  // …but the stale token is still on the device, so the way to clear it stays.
  expect(view.getByText("Keluar dari Aplikasi")).toBeTruthy();
});
