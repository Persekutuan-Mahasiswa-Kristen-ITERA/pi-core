import { app } from "./app";
import type { Env } from "./env";
import { scheduled } from "./scheduled";

/**
 * The API Worker's entry point. `fetch` serves `/api/v1/*`; `scheduled` is the free keep-alive
 * Cron Trigger that stops Supabase's Free plan from pausing staging (ADR-0014).
 */
export { RealtimeHub } from "./realtime/hub";

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
