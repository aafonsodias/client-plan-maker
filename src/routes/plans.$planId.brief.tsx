import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeBrief, approveBrief } from "@/server/phased/stage1-brief.functions";
import { BriefSchema, type Brief } from "@/server/phased/schemas";
import { Loader2, RefreshCw, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import BriefEditor from "@/components/BriefEditor";

export const Route = createFileRoute("/plans/$planId/brief")({
  component: () => (
    <AppShell>
      <BriefReview />
    </AppShell>
  ),
});

function BriefReview() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  const synthesizeFn = useServerFn(synthesizeBrief);
  const approveFn = useServerFn(approveBrief);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("workout_plans")
      .select("id, title, client_id, brief, generation_state")
      .eq("id", planId)
      .maybeSingle();
    if (error || !data) {
      toast.error("Plan not found.");
      setLoading(false);
      return;
    }
    setPlanTitle((data as any).title ?? "");
    setClientId((data as any).client_id ?? null);
    const parsed = BriefSchema.safeParse((data as any).brief);
    console.log(
      "[brief route] planId=",
      planId,
      "raw brief=",
      (data as any).brief,
      "parsed.success=",
      parsed.success,
      parsed.success ? null : parsed.error.issues
    );
    setBrief(parsed.success ? parsed.data : null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  async function regenerate() {
    setRegenerating(true);
    const res = await synthesizeFn({ data: { planId } });
    setRegenerating(false);
    if (!res.ok) {
      toast.error(res.error || "Regenerate failed");
      return;
    }
    toast.success("Brief regenerated");
    await load();
  }

  async function approve() {
    if (!brief) return;
    const parsed = BriefSchema.safeParse(brief);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Brief is invalid");
      return;
    }
    setApproving(true);
    const res = await approveFn({ data: { planId, brief: parsed.data } });
    setApproving(false);
    if (!res.ok) {
      toast.error(res.error || "Approve failed");
      return;
    }
    toast.success("Brief approved — moving to blueprint");
    setApproved(true);
    // Show the collapsed "approved" confirmation briefly so the trainer
    // sees the state change before we navigate to the blueprint stage.
    window.setTimeout(() => {
      navigate({ to: "/plans/$planId/blueprint", params: { planId } });
    }, 700);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" /> Loading brief…
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="font-mono text-sm text-destructive">
          DEBUG: Brief is null or failed schema parse (plan {planId})
        </p>
        <p className="mt-2 text-muted-foreground">No brief yet.</p>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Generate brief
        </button>
      </div>
    );
  }

  if (approved) {
    return (
      <div className="mx-auto max-w-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Stage 1 — Brief approved</p>
              <p className="text-xs text-muted-foreground">Loading blueprint…</p>
            </div>
          </div>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          {clientId && (
            <Link
              to="/clients/$clientId"
              params={{ clientId }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Client
            </Link>
          )}
          <h1 className="truncate text-xl font-semibold text-foreground">{planTitle}</h1>
          <p className="text-xs text-muted-foreground">Stage 1 — Brief review</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={regenerate}
            disabled={regenerating || approving}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </button>
          <button
            onClick={approve}
            disabled={approving || regenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Approve brief
          </button>
        </div>
      </div>

      <BriefEditor brief={brief} onChange={setBrief} />
    </div>
  );
}