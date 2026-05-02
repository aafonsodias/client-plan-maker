import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  generateDay,
  approveMicrocycle,
} from "@/server/phased/stage3-microcycle.functions";
import { BlueprintSchema, type Blueprint } from "@/server/phased/schemas";
import { Loader2, ArrowRight, ArrowLeft, Sparkles, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { BriefContextRail } from "@/components/BriefContextRail";
import { BriefSheetButton } from "@/components/BriefSheetButton";
import { DayCardEditable } from "@/components/DayCardEditable";
import { InfoHint } from "@/components/InfoHint";

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
            <div className="scrollbar-hide sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
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
  updated_at?: string;
};

function MicrocycleReview() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("plan");
  const generateDayFn = useServerFn(generateDay);
  const approveFn = useServerFn(approveMicrocycle);

  const [planTitle, setPlanTitle] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [day1Approved, setDay1Approved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingSet, setGeneratingSet] = useState<Set<number>>(new Set());
  const isGenerating = (i: number) => generatingSet.has(i);
  const addGenerating = (i: number) => setGeneratingSet((s) => { const n = new Set(s); n.add(i); return n; });
  const removeGenerating = (i: number) => setGeneratingSet((s) => { const n = new Set(s); n.delete(i); return n; });
  const [daysLoaded, setDaysLoaded] = useState(false);
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
      .select("id, day_number, status, day_label, focus, rationale, content, updated_at")
      .eq("plan_id", planId)
      .eq("week_number", 1)
      .order("day_number", { ascending: true });
    setDays(((data ?? []) as any[]).map((d) => ({ ...d })));
    setDaysLoaded(true);
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

  // Auto-fire Day 1 only once we know days are loaded (prevents double-gen race)
  useEffect(() => {
    if (!blueprint || !daysLoaded || day1KickedRef.current) return;
    const day1 = days.find((d) => d.day_number === 1);
    if (!day1) {
      day1KickedRef.current = true;
      kickDay1();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint, daysLoaded, days]);

  async function kickDay1() {
    if (isGenerating(1)) return;
    setGenerating(true);
    addGenerating(1);
    const res = await generateDayFn({ data: { planId, dayIndex: 1 } });
    setGenerating(false);
    removeGenerating(1);
    await loadDays();
    if (!res.ok) toast.error(res.error || "Day 1 generation failed");
  }

  async function regenDay(dayIndex: number) {
    if (isGenerating(dayIndex)) return;
    addGenerating(dayIndex);
    const res = await generateDayFn({ data: { planId, dayIndex } });
    removeGenerating(dayIndex);
    await loadDays();
    if (!res.ok) toast.error(res.error || `Day ${dayIndex} failed`);
  }

  function approveDay1AndContinue() {
    // Day 1 is the gate; once approved the trainer generates remaining days
    // one-at-a-time below. No auto-batching = no surprise costs / vanishing days.
    setDay1Approved(true);
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
  const doneCount = days.filter(
    (d) => d.day_number <= sessionsPerWeek && d.status === "done",
  ).length;
  const pendingCount = days.filter(
    (d) => d.day_number <= sessionsPerWeek && d.status === "pending",
  ).length;
  const allDone = sessionsPerWeek > 0 && doneCount === sessionsPerWeek;
  const inFlight = pendingCount > 0 || generatingSet.size > 0;
  const pct = sessionsPerWeek > 0 ? Math.round((doneCount / sessionsPerWeek) * 100) : 0;
  // Rough estimate: sequential per-day ~40s, divided by client-side concurrency=1 here
  // (server batches 5 internally for bulk; we only manually fire one at a time).
  const etaSec = Math.max(0, (sessionsPerWeek - doneCount) * 40);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/plans/$planId/blueprint"
            params={{ planId }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> {t("actions.back_blueprint")}
          </Link>
          <h1 className="truncate text-xl font-semibold text-foreground">{planTitle}</h1>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Stage 3 — Microcycle (Week 1) · {doneCount}/{sessionsPerWeek} done</span>
            <InfoHint tone="neutral" side="bottom" label="O que é um microciclo?">
              {t("microcycle.stage_hint")}
            </InfoHint>
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
          {allDone && !busy && (
            <span className="inline-flex items-center gap-1 self-center text-[11px] font-medium text-emerald-500 dark:text-emerald-400 sm:self-end">
              <CheckCircle2 className="h-3 w-3" /> {t("microcycle.ready_to_approve")}
            </span>
          )}
          <button
            onClick={approve}
            disabled={!allDone || busy}
            aria-label={
              busy
                ? t("actions.approve_microcycle_busy")
                : !allDone
                ? t("actions.approve_microcycle_disabled")
                : t("actions.approve_microcycle")
            }
            className={
              "group relative inline-flex w-full items-center justify-center gap-2 self-stretch rounded-lg px-4 py-2.5 text-sm font-semibold transition-all sm:w-auto sm:self-end " +
              (allDone && !busy
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_0_24px_-6px_oklch(0.72_0.16_160/0.55)] ring-1 ring-emerald-400/40 hover:-translate-y-0.5 hover:shadow-[0_0_32px_-6px_oklch(0.72_0.16_160/0.7)] active:translate-y-0"
                : "bg-muted text-muted-foreground ring-1 ring-border")
            }
          >
            {allDone && !busy && (
              <span className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-emerald-400/60 animate-pulse" aria-hidden />
            )}
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !allDone ? (
              <Lock className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span className="relative">
              {busy
                ? t("actions.approve_microcycle_busy")
                : !allDone
                ? t("actions.approve_microcycle_disabled")
                : t("actions.approve_microcycle")}
            </span>
          </button>
        </div>
      </div>

      {sessionsPerWeek > 0 && (inFlight || !allDone) && (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              {inFlight && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("microcycleProgress.generating")} · {doneCount} / {sessionsPerWeek}
            </span>
            {inFlight && etaSec > 0 && <span>{t("microcycleProgress.remaining", { seconds: etaSec })}</span>}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {!day1 && generating && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          <p className="mt-2">{t("microcycleProgress.day_quality_gate")}</p>
        </div>
      )}

      {day1 && (
        <DayCardEditable
          key={`day1-${day1.updated_at ?? day1.status}`}
          day={day1}
          planId={planId}
          isGate={!day1Approved}
          onRegen={() => regenDay(1)}
          onApproveDay1={approveDay1AndContinue}
        />
      )}

      {day1Approved &&
        Array.from({ length: sessionsPerWeek - 1 }, (_, i) => i + 2).map((idx) => {
          const row = days.find((d) => d.day_number === idx);
          if (!row) {
            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded-2xl border border-dashed border-border p-5"
              >
                <div className="text-sm">
                  <p className="font-medium text-foreground">Day {idx}</p>
                  <p className="text-xs text-muted-foreground">Not generated yet.</p>
                </div>
                <button
                  onClick={() => regenDay(idx)}
                  disabled={isGenerating(idx)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {isGenerating(idx) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Generate Day {idx}
                </button>
              </div>
            );
          }
          return (
            <DayCardEditable
              key={`day${idx}-${row.updated_at ?? row.status}`}
              dayIndex={idx}
              day={row}
              planId={planId}
              onRegen={() => regenDay(idx)}
            />
          );
        })}
    </div>
  );
}