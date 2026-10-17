export type IntegrationConnectionStatus = "connected" | "not_connected" | "disabled";

export const CONNECTED_WINDOW_DAYS = 30;
export const CONNECTED_WINDOW_MS = CONNECTED_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Connected means enabled and at least one access token was issued in the rolling window.
 * Token issuance is the provider's durable evidence that authorization completed successfully.
 */
export function getIntegrationConnectionStatus(
  disabled: boolean,
  lastAuthorizedAt: Date | null,
  now: Date,
): IntegrationConnectionStatus {
  if (disabled) return "disabled";
  if (lastAuthorizedAt !== null && now.getTime() - lastAuthorizedAt.getTime() <= CONNECTED_WINDOW_MS) {
    return "connected";
  }
  return "not_connected";
}
