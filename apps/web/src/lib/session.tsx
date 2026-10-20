"use client";

/**
 * Session state for the admin web.
 *
 * There is no cookie involved: the page holds an OAuth access token and refreshes it when needed
 * (see `lib/oidc.ts` for why). The provider answers one question for every screen — *who is signed
 * in, and what may they do* — from `/api/v1/access`, which is the **only** authoritative source:
 * roles and permissions in that response are re-resolved from the database on every call, so a token
 * cannot carry privileges it no longer has.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";

import { apiFetch, renewSession, setSessionTokens } from "./api-client";
import { beginSignIn, clearTokens, completeSignIn } from "./oidc";

export interface AccessSnapshot {
  member: { id: string; email: string; name: string };
  activePeriod: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
  } | null;
  roles: string[];
  permissions: string[];
}

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; access: AccessSnapshot };

interface SessionContextValue {
  state: SessionState;
  signIn: () => Promise<void>;
  signOut: () => void;
  reload: () => Promise<void>;
  completeSignIn: (code: string, state: string | null) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchAccess(): Promise<AccessSnapshot | null> {
  const response = await apiFetch("/api/v1/access");
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(`access request failed (${String(response.status)})`);
  }
  return (await response.json()) as AccessSnapshot;
}

export function SessionProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const reload = useCallback(async (): Promise<void> => {
    const access = await fetchAccess();
    setState(
      access === null
        ? { status: "anonymous" }
        : { status: "authenticated", access },
    );
  }, []);

  // A reload recovers the session from the refresh token in `sessionStorage`; the access token
  // itself is never persisted.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const renewed = await renewSession();
        if (!renewed) {
          if (!cancelled) setState({ status: "anonymous" });
          return;
        }
        const access = await fetchAccess();
        if (cancelled) return;
        setState(
          access === null
            ? { status: "anonymous" }
            : { status: "authenticated", access },
        );
      } catch {
        if (!cancelled) setState({ status: "anonymous" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (): Promise<void> => {
    window.location.assign(await beginSignIn());
  }, []);

  const signOut = useCallback((): void => {
    setSessionTokens(null);
    clearTokens();
    setState({ status: "anonymous" });
  }, []);

  const complete = useCallback(
    async (code: string, state_: string | null): Promise<void> => {
      const tokens = await completeSignIn(code, state_);
      setSessionTokens(tokens);
      await reload();
    },
    [reload],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      signIn,
      signOut,
      reload,
      completeSignIn: complete,
    }),
    [state, signIn, signOut, reload, complete],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return context;
}
