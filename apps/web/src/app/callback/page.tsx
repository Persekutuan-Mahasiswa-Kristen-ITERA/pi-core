"use client";

/**
 * The redirect target registered for this client (`<origin>/callback`).
 *
 * Exchanges the authorization code for a token pair and returns to the dashboard. The PKCE verifier
 * and the expected `state` were parked in `sessionStorage` by `beginSignIn`, so a code delivered to a
 * different tab or a tampered `state` is refused.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type JSX } from "react";

import { useSession } from "../../lib/session";

function CallbackExchange(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const { completeSignIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const providerError = params.get("error");
    const code = params.get("code");
    const state = params.get("state");

    if (providerError !== null) {
      setError(providerError);
      return;
    }
    if (code === null) {
      setError("Kode otorisasi tidak ada pada URL callback.");
      return;
    }

    void (async () => {
      try {
        await completeSignIn(code, state);
        router.replace("/");
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Pertukaran kode gagal tanpa keterangan.",
        );
      }
    })();
  }, [completeSignIn, params, router]);

  return (
    <div className="shell" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div className="card" style={{ maxWidth: 460, padding: 28, textAlign: "center" }}>
        <h1 style={{ marginTop: 0, fontSize: 20 }}>
          {error === null ? "Menyelesaikan masuk…" : "Masuk tidak selesai"}
        </h1>
        {error === null ? (
          <p style={{ color: "var(--color-muted)", fontSize: 13.5 }}>
            Menukar kode otorisasi dengan token akses PI-CORE.
          </p>
        ) : (
          <>
            <p style={{ color: "var(--color-muted)", fontSize: 13.5 }}>{error}</p>
            <Link className="button button-primary" href="/">
              Kembali ke dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage(): JSX.Element {
  // `useSearchParams` opts the route into client-side rendering, so Next requires a Suspense
  // boundary above it even though this page has no server-rendered content.
  return (
    <Suspense fallback={null}>
      <CallbackExchange />
    </Suspense>
  );
}
