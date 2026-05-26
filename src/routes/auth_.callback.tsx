import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth_/callback")({
  component: AuthCallbackPage,
});

function getSafeNext(raw: string | null): string | null {
  if (!raw || typeof window === "undefined") return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (!url.pathname.startsWith("/intake/")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const safeNext = getSafeNext(params.get("next"));
      const oauthError = params.get("error_description") ?? params.get("error");
      const code = params.get("code");
      if (!cancelled) setReturnPath(safeNext);

      if (oauthError) {
        if (!cancelled) setError(oauthError);
        return;
      }

      if (!code) {
        if (!cancelled) setError("Missing OAuth callback code.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (error) {
        setError(error.message);
        return;
      }

      if (safeNext) {
        window.location.replace(safeNext);
        return;
      }

      navigate({ to: "/welcome", replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-foreground">Google sign-in failed</h1>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          <Button asChild className="mt-6">
            {returnPath ? <a href={returnPath}>Back to intake</a> : <Link to="/auth">Back to sign in</Link>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Completing Google sign-in...
      </div>
    </div>
  );
}
