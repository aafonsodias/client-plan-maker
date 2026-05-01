import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPhasedPlan, synthesizeBrief } from "@/server/phased/stage1-brief.functions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/plans/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    clientId: typeof s.clientId === "string" ? s.clientId : "",
  }),
  component: () => (
    <AppShell>
      <NewPhasedPlan />
    </AppShell>
  ),
});

function NewPhasedPlan() {
  const { clientId } = useSearch({ from: "/plans/new" });
  const navigate = useNavigate();
  const createFn = useServerFn(createPhasedPlan);
  const synthesizeFn = useServerFn(synthesizeBrief);
  const [status, setStatus] = useState<"creating" | "synthesizing" | "error">("creating");
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!clientId) {
      setStatus("error");
      setError("Missing clientId.");
      return;
    }
    (async () => {
      const created = await createFn({ data: { clientId } });
      if (!created.ok) {
        setStatus("error");
        setError(created.error);
        return;
      }
      setStatus("synthesizing");
      const briefRes = await synthesizeFn({ data: { planId: created.planId } });
      if (!briefRes.ok) {
        setStatus("error");
        setError(briefRes.error || "Brief synthesis failed.");
        toast.error("Brief synthesis failed. Open the plan to retry.");
      }
      navigate({ to: "/plans/$planId/brief", params: { planId: created.planId } });
    })();
  }, [clientId, createFn, synthesizeFn, navigate]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {status === "error" ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">Couldn't start plan</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">
              {status === "creating" ? "Setting up your plan…" : "Synthesizing the brief…"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The per-section analyses you've already gathered are being merged.
            </p>
          </>
        )}
      </div>
    </div>
  );
}