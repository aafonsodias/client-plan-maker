import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  generateDay,
  approveMicrocycle,
  generateMicrocycleDays,
} from "@/server/phased/stage3-microcycle.functions";
import { BlueprintSchema, type Blueprint } from "@/server/phased/schemas";
import { Loader2, ArrowLeft, Sparkles, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { DayCardEditable } from "@/components/DayCardEditable";
import { InfoHint } from "@/components/InfoHint";

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

/**
 * MicrocyclePanel — Stage 3 inline panel rendered inside the client page's
 * StageCard expandedBody. Keeps all generation/approve logic on a single page
 * (no navigation away). The host owns "what happens after approve" via
 * `onApproved`.
 */
export function MicrocyclePanel({
  planId,
  onApproved,
  showHeader = true,
}: {
  planId: string;
  onApproved?: () => void;
  showHeader?: boolean;
}) {
  const { t } = useTranslation("plan");
  const generateDayFn = useServerFn(generateDay);
  const generateAllDaysFn = useServerFn(generateMicrocycleDays);
  const approveFn = useServerFn(approveMicrocycle);

  const [planTitle, setPlanTitle] = useState("");
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [day1Approved, setDay1Approved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingSet, setGeneratingSet] = useState<Set<number>>(new Set());
  const isGenerating = (i: number) => generatingSet.has(i);
  const addGenerating = (i: number) =>
    setGeneratingSet((s) => { const n = new Set(s); n.add(i); return n; });
  const removeGenerating = (i: number) =>
    setGeneratingSet((s) => { const n = new Set(s); n.delete(i); return n; });
  const [daysLoaded, setDaysLoaded] = useState(false);
  const day1KickedRef = useRef(false);
  const [approvedDays, setApprovedDays] = useState<Set<number>>(new Set());

  async function loadPlan() {
    const { data } = await supabase
      .from("workout_plans")
      .select("title, blueprint, status")
      .eq("id", planId)
      .maybeSingle();
    if (!data) return;
    setPlanTitle((data as any).title ?? "");
    setPlanStatus((data as any).status ?? null);
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

  useEffect(() => {
    loadPlan();
    loadDays();
    const channel = supabase
      .channel(`plan-days-${planId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_plan_days", filter: `plan_id=eq.${planId}` },
        () => loadDays(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  useEffect(() => {
    if (!blueprint || !daysLoaded || day1KickedRef.current) return;
    const sessions = blueprint.sessions_per_week ?? 0;
    const haveAny = days.some((d) => d.day_number >= 1 && d.day_number <= sessions);
    if (!haveAny && sessions > 0) {
      day1KickedRef.current = true;
      kickWeek();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint, daysLoaded, days]);

  async function kickWeek() {
    const sessions = blueprint?.sessions_per_week ?? 0;
    if (sessions <= 0) return;
    setGenerating(true);
    for (let i = 1; i <= sessions; i++) addGenerating(i);
    const res = await generateAllDaysFn({ data: { planId } });
    setGenerating(false);
    for (let i = 1; i <= sessions; i++) removeGenerating(i);
    await loadDays();
    if (!res.ok) toast.error(res.error || "Microcycle generation failed");
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
    setDay1Approved(true);
    setApprovedDays((s) => { const n = new Set(s); n.add(1); return n; });
  }
  function approveDay(idx: number) {
    setApprovedDays((s) => { const n = new Set(s); n.add(idx); return n; });
  }

  async function approve() {
    setBusy(true);
    const res = await approveFn({ data: { planId } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Approve failed");
      return;
    }
    toast.success("Microcycle approved");
    onApproved?.();
  }

  const day1 = days.find((d) => d.day_number === 1);
  const sessionsPerWeek = blueprint?.sessions_per_week ?? 0;
  const isFinalized = planStatus === "finalized";
  const doneCount = days.filter((d) => d.day_number <= sessionsPerWeek && d.status === "done").length;
  const pendingCount = days.filter((d) => d.day_number <= sessionsPerWeek && d.status === "pending").length;
  const haveAllRows =
    sessionsPerWeek > 0 &&
    days.filter((d) => d.day_number <= sessionsPerWeek).length >= sessionsPerWeek;
  const allDone = haveAllRows && doneCount === sessionsPerWeek;
  const inFlight = pendingCount > 0 || generatingSet.size > 0;
  const pct = sessionsPerWeek > 0 ? Math.round((doneCount / sessionsPerWeek) * 100) : 0;
  // Faster model (Gemini Flash) → ~15s/day instead of 40s.
  const etaSec = Math.max(0, (sessionsPerWeek - doneCount) * 15);

  useEffect(() => {
    if (!sessionsPerWeek || isFinalized) return;
    for (const idx of approvedDays) {
      const next = idx + 1;
      if (next > sessionsPerWeek) continue;
      const cur = days.find((d) => d.day_number === idx);
      if (cur?.status !== "done") continue;
      const nextRow = days.find((d) => d.day_number === next);
      if (nextRow && (nextRow.status === "done" || nextRow.status === "pending")) continue;
      if (isGenerating(next)) continue;
      regenDay(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedDays, days, sessionsPerWeek, isFinalized]);

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {planTitle && <h2 className="truncate text-base font-semibold text-foreground">{planTitle}</h2>}
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>Stage 3 — Microcycle (Week 1) · {doneCount}/{sessionsPerWeek} done</span>
              <InfoHint tone="neutral" side="bottom" label="O que é um microciclo?">
                {t("microcycle.stage_hint")}
              </InfoHint>
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
            {!isFinalized && allDone && !busy && (
              <span className="inline-flex items-center gap-1 self-center text-[11px] font-medium text-emerald-500 dark:text-emerald-400 sm:self-end">
                <CheckCircle2 className="h-3 w-3" /> {t("microcycle.ready_to_approve")}
              </span>
            )}
            {!isFinalized && (
              <button
                onClick={approve}
                disabled={!allDone || busy}
                className={
                  "group relative inline-flex w-full items-center justify-center gap-2 self-stretch rounded-lg px-4 py-2.5 text-sm font-semibold transition-all sm:w-auto sm:self-end " +
                  (allDone && !busy
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_0_24px_-6px_oklch(0.72_0.16_160/0.55)] ring-1 ring-emerald-400/40 hover:-translate-y-0.5"
                    : "bg-muted text-muted-foreground ring-1 ring-border")
                }
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : !allDone ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                <span className="relative">
                  {busy
                    ? t("actions.approve_microcycle_busy")
                    : !allDone
                    ? t("actions.approve_microcycle_disabled")
                    : t("actions.approve_microcycle")}
                </span>
              </button>
            )}
            {isFinalized && (
              <Link
                to="/plans/$planId"
                params={{ planId }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Back to plan
              </Link>
            )}
          </div>
        </div>
      )}

      {!isFinalized && sessionsPerWeek > 0 && (inFlight || !allDone) && (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              {inFlight && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("microcycleProgress.generating")} · {doneCount} / {sessionsPerWeek}
            </span>
            {inFlight && etaSec > 0 && <span>{t("microcycleProgress.remaining", { seconds: etaSec })}</span>}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {!day1 && (generating || generatingSet.size > 0) && (
        <div className="space-y-3">
          {Array.from({ length: Math.max(1, sessionsPerWeek) }, (_, i) => i + 1).map((idx) => (
            <div key={`skel-${idx}`} className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
              <div className="flex items-center gap-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                <div>
                  <p className="font-medium text-foreground">Day {idx}</p>
                  <p className="text-xs text-muted-foreground">A gerar sessão…</p>
                </div>
              </div>
              <span className="text-[11px] uppercase tracking-widest text-amber-500">Pending</span>
            </div>
          ))}
        </div>
      )}

      {day1 && (
        <DayCardEditable
          key={`day1-${day1.updated_at ?? day1.status}`}
          day={day1}
          planId={planId}
          isGate={!isFinalized && !day1Approved}
          onRegen={() => regenDay(1)}
          onApproveDay1={isFinalized ? undefined : approveDay1AndContinue}
        />
      )}

      {(isFinalized || day1Approved) &&
        Array.from({ length: sessionsPerWeek - 1 }, (_, i) => i + 2).map((idx) => {
          const row = days.find((d) => d.day_number === idx);
          if (!row) {
            return (
              <div key={idx} className="flex items-center justify-between rounded-2xl border border-dashed border-border p-5">
                <div className="text-sm">
                  <p className="font-medium text-foreground">Day {idx}</p>
                  <p className="text-xs text-muted-foreground">Not generated yet.</p>
                </div>
                <button
                  onClick={() => regenDay(idx)}
                  disabled={isGenerating(idx)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {isGenerating(idx) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
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
              isGate={!isFinalized && idx < sessionsPerWeek && !approvedDays.has(idx)}
              onApproveDay1={
                isFinalized || idx >= sessionsPerWeek || approvedDays.has(idx)
                  ? undefined
                  : () => approveDay(idx)
              }
            />
          );
        })}
    </div>
  );
}