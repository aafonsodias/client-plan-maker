import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Install a one-time fetch interceptor that attaches the current Supabase
  // bearer token to TanStack Start server-function calls (`/_serverFn/*`).
  // Without this, server functions guarded by `requireSupabaseAuth` 401 and
  // surface as "Error: [object Response]" / blank screens on the client.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;
    if (w.__forgeFetchPatched) return;
    w.__forgeFetchPatched = true;
    const orig = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
        if (url && url.includes("/_serverFn/")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
            if (!headers.has("authorization")) headers.set("Authorization", `Bearer ${token}`);
            return orig(input, { ...(init || {}), headers });
          }
        }
      } catch {}
      return orig(input as any, init);
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);