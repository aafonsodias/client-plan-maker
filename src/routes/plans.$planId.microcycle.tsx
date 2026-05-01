import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  generateDay,
  generateMicrocycleDays,
  approveMicrocycle,
} from "@/server/phased/stage3-microcycle.functions";
import { BlueprintSchema, type Blueprint } from "@/server/phased/schemas";
import { Loader2, RefreshCw, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BriefContextRail } from "@/components/BriefContextRail";
import { BriefSheetButton } from "@/components/BriefSheetButton";

export const Route = createFileRoute("/plans/$planId/microcycle")({
  component: MicrocycleRoute,
});

function MicrocycleRoute() {
  const { planId } = Route.useParams();
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-3 flex justify-end xl:hidden">
          <BriefSheetButton planId={planId} />
        </div>
        <div className="xl:flex xl:gap-6">
          <main className="min-w-0 flex-1">
            <MicrocycleReview />
          </main>
          <aside className="hidden xl:block w-80 flex-shrink-0">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
              <BriefContextRail planId={planId} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

type DayRow = {
  id: string;
  day_number: number;
  status: "pending" | "done" | "error";
  day_label: string;
  focus: string;
  rationale: string;
  content: any;
};

function MicrocycleReview() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  const generateDayFn = useServerFn(generateDay);
  const generateBatchFn = useServerFn(generateMicrocycleDays);
  const approveFn = useServerFn(approveMicrocycle);

  const [planTitle, setPlanTitle] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [day1Approved, setDay1Approved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const day1KickedRef = useRef(false);

  async function loadPlan() {
    const { data } = await supabase
      .from("workout_plans")
      .select("title, blueprint")
      .eq("id", planId)
      .maybeSingle();
    if (!data) return;
    setPlanTitle((data as any).title ?? "");
    const bp = BlueprintSchema.safeParse((data as any).blueprint);
    if (bp.success) setBlueprint(bp.data);
  }

  async function loadDays() {
    const { data } = await supabase
      .from("workout_plan_days")
      .select("id, day_number, status, day_label, focus, rationale, content")
      .eq("plan_id", planId)
      .eq("week_number", 1)
      .order("day_number", { ascending: true });
    setDays(((data ?? []) as any[]).map((d) => ({ ...d })));
  }

  // Initial load + realtime subscription
  useEffect(() => {
    loadPlan();
    loadDays();
    const channel = supabase
      .channel(`plan-days-${planId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_plan_days", filter: `plan_id=eq.${planId}` },
        () => loadDays()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  // Auto-fire Day 1 if missing once blueprint loaded
  useEffect(() => {
    if (!blueprint || day1KickedRef.current) return;
    const day1 = days.find((d) => d.day_number === 1);
    if (!day1) {
      day1KickedRef.current = true;
      kickDay1();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint, days]);

  async function kickDay1() {
    setGenerating(true);
    const res = await generateDayFn({ data: { planId, dayIndex: 1 } });
    setGenerating(false);
    if (!res.ok) toast.error(res.error || "Day 1 generation failed");
  }

  async function regenDay(dayIndex: number) {
    const res = await generateDayFn({ data: { planId, dayIndex } });
    if (!res.ok) toast.error(res.error || `Day ${dayIndex} failed`);
  }

  async function approveDay1AndContinue() {
    if (!blueprint) return;
    setDay1Approved(true);
    const sessionsPerWeek = blueprint.sessions_per_week;
    const remaining = Array.from({ length: sessionsPerWeek - 1 }, (_, i) => i + 2);
    if (remaining.length === 0) return;
    setGenerating(true);
    const res = await generateBatchFn({ data: { planId, dayIndices: remaining } });
    setGenerating(false);
    if (!res.ok) toast.error(res.error || "Batch generation failed");
    else if (res.errors > 0) toast.warning(`${res.generated} days ok, ${res.errors} errors`);
    else toast.success(`${res.generated} days generated`);
  }

  async function approve() {
    setBusy(true);
    const res = await approveFn({ data: { planId } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Approve failed");
      return;
    }
    toast.success("Microcycle approved — proposing progressions");
    navigate({ to: "/plans/$planId/progressions", params: { planId } });
  }

  const day1 = days.find((d) => d.day_number === 1);
  const sessionsPerWeek = blueprint?.sessions_per_week ?? 0;
  const allDone =
    sessionsPerWeek > 0 &&
    days.filter((d) => d.day_number <= sessionsPerWeek && d.status === "done").length === sessionsPerWeek;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/plans/$planId/blueprint"
            params={{ planId }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Blueprint
          </Link>
          <h1 className="truncate text-xl font-semibold text-foreground">{planTitle}</h1>
          <p className="text-xs text-muted-foreground">
            Stage 3 — Microcycle (Week 1) · {days.filter((d) => d.status === "done").length}/
            {sessionsPerWeek} done
          </p>
        </div>
        <button
          onClick={approve}
          disabled={!allDone || busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Approve microcycle
        </button>
      </div>

      {!day1 && generating && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          <p className="mt-2">Generating Day 1 — this is the quality gate.</p>
        </div>
      )}

      {day1 && (
        <DayCard
          day={day1}
          isGate={!day1Approved}
          onRegen={() => regenDay(1)}
          onApproveDay1={approveDay1AndContinue}
        />
      )}

      {day1Approved &&
        Array.from({ length: sessionsPerWeek - 1 }, (_, i) => i + 2).map((idx) => {
          const row = days.find((d) => d.day_number === idx);
          return (
            <DayCard
              key={idx}
              dayIndex={idx}
              day={row}
              onRegen={() => regenDay(idx)}
            />
          );
        })}
    </div>
  );
}

function DayCard({
  day,
  dayIndex,
  isGate,
  onRegen,
  onApproveDay1,
}: {
  day?: DayRow;
  dayIndex?: number;
  isGate?: boolean;
  onRegen: () => void;
  onApproveDay1?: () => void;
}) {
  const idx = day?.day_number ?? dayIndex ?? 0;

  if (!day) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        Day {idx} — queued
      </div>
    );
  }

  if (day.status === "pending") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        Day {idx} — generating…
      </div>
    );
  }

  if (day.status === "error") {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Day {idx} failed
          </div>
          <button
            onClick={onRegen}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const exercises = (day.content?.exercises ?? []) as any[];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Day {idx} · {day.day_label}
          </h2>
          <p className="text-xs text-muted-foreground">{day.focus}</p>
        </div>
        <button
          onClick={onRegen}
          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
        >
          <RefreshCw className="h-3 w-3" /> Regenerate
        </button>
      </div>
      {day.rationale && (
        <p className="mb-3 rounded bg-muted/50 p-2 text-xs text-muted-foreground">{day.rationale}</p>
      )}
      <ul className="space-y-1.5">
        {exercises.map((ex, i) => (
          <li key={i} className="rounded border border-border/60 px-3 py-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{ex.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {ex.sets}×{ex.reps} @ RPE {ex.rpe} · rest {ex.rest}
              </span>
            </div>
            {ex.cue && <div className="mt-1 text-xs text-muted-foreground">{ex.cue}</div>}
          </li>
        ))}
      </ul>
      {isGate && onApproveDay1 && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-foreground">
            Day 1 looks good? Approve to generate the rest of the week.
          </p>
          <button
            onClick={onApproveDay1}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <CheckCircle2 className="h-4 w-4" /> Approve Day 1
          </button>
        </div>
      )}
    </section>
  );
}