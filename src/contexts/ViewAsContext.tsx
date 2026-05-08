import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * ViewAs (R70) — Global "ver como cliente" mode.
 *
 * Three-layer impersonation pattern (UI / route-visibility / RLS).
 * This is layer 1: a sessionStorage-backed flag the trainer toggles to
 * preview their app as a specific client. Routes and components consult
 * `useViewAs()` to hide trainer-only chrome and disable writes.
 *
 * Persisted in sessionStorage so it survives refresh but not logout.
 * RLS still acts as the trainer (this is visual, not auth-level).
 */

const STORAGE_KEY = "protocol.viewAs.v1";

export type ViewAsClient = {
  id: string;
  full_name: string;
  photo_url?: string | null;
};

type ViewAsState = {
  isPreview: boolean;
  client: ViewAsClient | null;
  enter: (client: ViewAsClient) => void;
  switchClient: (client: ViewAsClient) => void;
  exit: () => void;
};

const Ctx = createContext<ViewAsState | null>(null);

function readPersisted(): ViewAsClient | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && typeof parsed.full_name === "string") {
      return parsed as ViewAsClient;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ViewAsClient | null>(null);

  // Hydrate after mount to keep SSR markup stable.
  useEffect(() => {
    const restored = readPersisted();
    if (restored) setClient(restored);
  }, []);

  const persist = useCallback((next: ViewAsClient | null) => {
    if (typeof window === "undefined") return;
    try {
      if (next) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const enter = useCallback(
    (c: ViewAsClient) => {
      setClient(c);
      persist(c);
    },
    [persist],
  );

  const exit = useCallback(() => {
    setClient(null);
    persist(null);
  }, [persist]);

  const value = useMemo<ViewAsState>(
    () => ({
      isPreview: client !== null,
      client,
      enter,
      switchClient: enter,
      exit,
    }),
    [client, enter, exit],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewAs(): ViewAsState {
  const v = useContext(Ctx);
  if (!v) {
    // Safe default: no provider mounted = no preview.
    return {
      isPreview: false,
      client: null,
      enter: () => {},
      switchClient: () => {},
      exit: () => {},
    };
  }
  return v;
}