/**
 * The Integrations screen: connection status for the OIDC clients (story 6.4).
 *
 * The interesting property is that the three statuses stay distinguishable — "Terhubung", "Belum
 * terhubung" and "Nonaktif" mean different things to whoever is checking whether PI-NEXUS can sign in,
 * and a screen that renders them all as one badge answers nothing. The failure paths are here too: a
 * 401 is an expired session (sign in again) and a 403 is a refusal (you may not see this), and they
 * used to render the same sentence.
 */
import { render } from "@testing-library/react-native";

import { IntegrationsScreen } from "./IntegrationsScreen";

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

describe("IntegrationsScreen", () => {
  it("renders each client with its own status, scopes and last authorization", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [
          {
            clientId: "pi-nexus",
            name: "PI-NEXUS",
            redirectUris: ["https://nexus.example/callback"],
            scopes: ["openid", "profile"],
            enabled: true,
            status: "connected",
            lastAuthorizedAt: "2026-10-20T10:00:00.000Z",
          },
          {
            clientId: "pi-form",
            name: null,
            redirectUris: [],
            scopes: null,
            enabled: true,
            status: "not_connected",
            lastAuthorizedAt: null,
          },
          {
            clientId: "pi-old",
            name: "Aplikasi Lama",
            redirectUris: [],
            scopes: ["openid"],
            enabled: false,
            status: "disabled",
            lastAuthorizedAt: "2026-01-02T03:04:05.000Z",
          },
        ],
      }),
    );

    const view = await render(<IntegrationsScreen />);

    expect(await view.findByText("PI-NEXUS")).toBeTruthy();
    expect(view.getByText("Terhubung")).toBeTruthy();
    expect(view.getByText("Belum terhubung")).toBeTruthy();
    expect(view.getByText("Nonaktif")).toBeTruthy();

    // A client with no display name is labelled, not left blank.
    expect(view.getByText("Aplikasi tanpa nama")).toBeTruthy();
    // No scopes and no authorization read as "—" / "Belum pernah", never as an empty line.
    expect(view.getByText("—")).toBeTruthy();
    expect(view.getByText("Belum pernah")).toBeTruthy();
    expect(view.getByText("openid, profile")).toBeTruthy();
  });

  it("says there are no integrations rather than showing an empty page", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    const view = await render(<IntegrationsScreen />);

    expect(await view.findByText("Belum ada integrasi")).toBeTruthy();
    expect(view.getByText("Integrasi yang terdaftar akan muncul di sini.")).toBeTruthy();
  });

  it("tells an expired session apart from a refusal", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "unauthorized" } }, 401));

    const view = await render(<IntegrationsScreen />);

    expect(await view.findByText("Sesi berakhir")).toBeTruthy();
    expect(view.getByText("Masuk ulang untuk melanjutkan.")).toBeTruthy();
  });

  it("reports a refusal as a refusal", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "forbidden" } }, 403));

    const view = await render(<IntegrationsScreen />);

    expect(await view.findByText("Akses ditolak")).toBeTruthy();
  });

  it("reports a server error as unavailable data, not as an empty list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "internal" } }, 500));

    const view = await render(<IntegrationsScreen />);

    expect(await view.findByText("Data belum tersedia")).toBeTruthy();
    expect(view.queryByText("Belum ada integrasi")).toBeNull();
  });
});
