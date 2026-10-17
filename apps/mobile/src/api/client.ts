import { API_URL } from "../config";

export class ApiOfflineError extends Error {
  constructor() {
    super("offline");
    this.name = "ApiOfflineError";
  }
}

export class ApiHealthError extends Error {
  constructor(status: number) {
    super(`health_${status}`);
    this.name = "ApiHealthError";
  }
}

export async function checkApiHealth(signal?: AbortSignal): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/v1/health`, signal === undefined ? undefined : { signal });
    if (!response.ok) throw new ApiHealthError(response.status);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "ApiHealthError")) throw error;
    throw new ApiOfflineError();
  }
}
