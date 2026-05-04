import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/plans/$planId/microcycle")({
  component: RedirectToClient,
});

function RedirectToClient() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("workout_plans")
        .select("client_id")
        .eq("id", planId)
        .maybeSingle();
      const clientId = (data as any)?.client_id as string | undefined;
      if (clientId) {
        navigate({ to: "/clients/$clientId", params: { clientId }, replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    })();
  }, [planId, navigate]);
  return (
    <div className="mx-auto max-w-3xl p-8 text-center text-muted-foreground">
      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      <p className="mt-2 text-xs">A abrir o cliente…</p>
    </div>
  );
}
