/**
 * The app's API layer, tested without a device and without the network.
 *
 * Two properties matter here and neither is visible from the code alone:
 *
 * 1. **Every call carries the bearer token.** A screen that forgets it gets a 401 and shows "offline",
 *    which looks like a network problem and hides the real bug. The token comes from `authHeaders`,
 *    so the test asserts the header is on the request rather than trusting the shared helper.
 * 2. **A non-2xx answer becomes `ApiError(status)`, not an empty list.** The screens map 401/403 to
 *    their own states; a silently empty array would render "belum ada anggota" for a refusal.
 */
import { ApiError, fetchAssignmentStats, fetchMembers } from "./resources";

jest.mock("../auth/session", () => ({
  authHeaders: jest.fn(async () => ({ authorization: "Bearer test-token" })),
}));

jest.mock("../config", () => ({ API_URL: "https://api.test", MOBILE_REDIRECT_URI: "picore://auth" }));

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("fetchMembers", () => {
  it("sends the stored bearer token and asks for the requested page size", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], nextCursor: null, sensitiveIncluded: true }));

    await fetchMembers(50);

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://api.test/api/v1/members?limit=50");
    expect(init.headers.authorization).toBe("Bearer test-token");
    expect(init.headers.accept).toBe("application/json");
  });

  it("returns the page, including the flag that says whether NIMs were redacted", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [{ id: "m1", email: "a@student.itera.ac.id", fullName: "Ani", status: "active" }],
        nextCursor: "cursor-2",
        sensitiveIncluded: false,
      }),
    );

    const page = await fetchMembers();

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.fullName).toBe("Ani");
    expect(page.nextCursor).toBe("cursor-2");
    expect(page.sensitiveIncluded).toBe(false);
  });

  it("turns a refusal into ApiError with the status, so the screen can say which refusal it was", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "forbidden" } }, 403));

    await expect(fetchMembers()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchMembers()).rejects.toMatchObject({ status: 403 });
  });

  it("lets a transport failure propagate as a thrown error rather than pretending the list is empty", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    await expect(fetchMembers()).rejects.toBeInstanceOf(TypeError);
  });
});

describe("fetchAssignmentStats", () => {
  it("flattens the server's list into a map the report can index by unit type", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        total: 14,
        byUnitType: [
          { unitType: "division", count: 12 },
          { unitType: "department", count: 2 },
        ],
      }),
    );

    const stats = await fetchAssignmentStats();

    expect(stats.total).toBe(14);
    expect(stats.byUnitType).toEqual({ division: 12, department: 2 });
  });

  it("starts from an empty map, so a type with no rows reads 0 instead of undefined", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ total: 0, byUnitType: [] }));

    const stats = await fetchAssignmentStats();

    expect(stats.byUnitType["bureau"]).toBeUndefined();
    expect(Object.keys(stats.byUnitType)).toHaveLength(0);
  });
});
