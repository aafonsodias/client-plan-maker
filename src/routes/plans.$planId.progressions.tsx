import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  proposeProgressions,
  approveProgressions,
} from "@/server/phased/stage4-progressions.functions";
import { bulkFillRemainingWeeks } from "@/server/phased/stage5-bulkfill.functions";
import { ProgressionPlanSchema, type ProgressionPlan } from "@/server/phased/schemas";
import { Loader2, ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BriefContextRail } from "@/components/BriefContextRail";
import { BriefSheetButton } from "@/components/BriefSheetButton";

export const Route = createFileRoute("/plans/$planId/progressions")({
  component: ProgressionsRoute,
});

function ProgressionsRoute() {
  const { planId } = Route.useParams();
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <BriefContextRailMobile planId={planId} />
        <div className="lg:flex lg:gap-6">
          <main className="min-w-0 flex-1">
            <ProgressionsReview />
          </main>
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
              <BriefContextRail planId={planId} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function ProgressionsReview() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  const proposeFn = useServerFn(proposeProgressions);
  const approveFn = useServerFn(approveProgressions);
  const bulkFn = useServerFn(bulkFillRemainingWeeks);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<ProgressionPlan | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [weeks, setWeeks] = useState(4);
  const kickedRef = useRef(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("workout_plans")
      .select("title, progression_plan, duration_weeks")
      .eq("id", planId)
      .maybeSingle();
    if (!data) {
      toast.error("Plan not found");
      setLoading(false);
      return;
    }
    setPlanTitle((data as any).title ?? "");
    setWeeks((data as any).duration_weeks ?? 4);
    const parsed = ProgressionPlanSchema.safeParse((data as any).progression_plan);
    setPlan(parsed.success ? parsed.data : null);
    setLoading(false);
    if (!parsed.success && !kickedRef.current) {
      kickedRef.current = true;
      regenerate();
    }
  }

  async function regenerate() {
    setBusy(true);
    const res = await proposeFn({ data: { planId } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Progressions failed");
      return;
    }
    setPlan(res.progressionPlan as ProgressionPlan);
  }

  async function approveAndBuild() {
    if (!plan) return;
    const parsed = ProgressionPlanSchema.safeParse(plan);
    if (!parsed.success) {
      toast.error("Progression plan invalid");
      return;
    }
    setBusy(true);
    const ap = await approveFn({ data: { planId, progressionPlan: parsed.data } });
    if (!ap.ok) {
      setBusy(false);
      toast.error(ap.error || "Approve failed");
      return;
    }
    const bf = await bulkFn({ data: { planId } });
    setBusy(false);
    if (!bf.ok) {
      toast.error(bf.error || "Bulk fill failed");
      return;
    }
    toast.success(`Built ${bf.inserted} sessions across weeks 2–${weeks}`);
    navigate({ to: "/plans/$planId", params: { planId } });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-8 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" /> Loading…
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-5xl p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        <p className="mt-2">Proposing progression deltas…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/plans/$planId/microcycle"
            params={{ planId }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Microcycle
          </Link>
          <h1 className="truncate text-xl font-semibold text-foreground">{planTitle}</h1>
          <p className="text-xs text-muted-foreground">
            Stage 4 — Progression deltas (weeks 2–{weeks})
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={regenerate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </button>
          <button
            onClick={approveAndBuild}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Approve & build remaining weeks
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground">Exercise</th>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground">Dim.</th>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground">W2</th>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground">W3</th>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground">W4</th>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground">Why</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{r.exercise_id}</td>
                <td className="p-2 text-xs">{r.dimension}</td>
                <td className="p-2">
                  <input
                    value={r.week_2_delta}
                    onChange={(e) => {
                      const next = [...plan.rows];
                      next[i] = { ...r, week_2_delta: e.target.value };
                      setPlan({ ...plan, rows: next });
                    }}
                    className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
                    placeholder="+2.5kg"
                  />
                </td>
                <td className="p-2">
                  <input
                    value={r.week_3_delta}
                    onChange={(e) => {
                      const next = [...plan.rows];
                      next[i] = { ...r, week_3_delta: e.target.value };
                      setPlan({ ...plan, rows: next });
                    }}
                    className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                </td>
                <td className="p-2">
                  <input
                    value={r.week_4_delta}
                    onChange={(e) => {
                      const next = [...plan.rows];
                      next[i] = { ...r, week_4_delta: e.target.value };
                      setPlan({ ...plan, rows: next });
                    }}
                    className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                </td>
                <td className="p-2 text-xs text-muted-foreground">{r.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Weeks 2–{weeks} are built deterministically from these deltas — no further AI calls.
      </p>
    </div>
  );
}