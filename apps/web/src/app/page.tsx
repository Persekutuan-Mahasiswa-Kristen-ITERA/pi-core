/**
 * Placeholder home page (story 1.2). Kept static so navigation is served from
 * Cloudflare's static assets and does not invoke the Worker script (ADR-0010).
 * The real admin surfaces arrive in Epic 4 with the design tokens.
 */
export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
      <h1 style={{ marginBottom: 8 }}>PI-CORE</h1>
      <p>PMK ITERA Centralized Organization &amp; Role Engine — admin website + HTTP API.</p>
      <p style={{ color: "#64748b" }}>Foundation build (story 1.2).</p>
    </main>
  );
}
