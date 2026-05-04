import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  generateDay,
  approveMicrocycle,
  generateMicrocycleDays,
} from "@/server/phased/stage3-microcycle.functions";
import { BlueprintSchema, type Blueprint } from "@/server/phased/schemas";
import { Loader2, ArrowLeft, Sparkles, CheckCircle2, Lock, RefreshCw, AlertTriangle } from "lucide-react";
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
  const [busy, setBusy] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [regenSet, setRegenSet] = useState<Set<number>>(new Set());
  const [daysLoaded, setDaysLoaded] = useState(false);
  const weekKickedRef = useRef(false);
  // Honest ETA: track first-pending timestamp + cumulative completion times.
  const startTsRef = useRef<number | null>(null);
  const [completionTimes, setCompletionTimes] = useState<number[]>([]);
  const prevDoneCountRef = useRef(0);
  // Active day shown in the focused detail (defaults to first done day).
  const [activeDay, setActiveDay] = useState<number>(1);

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
    if (!blueprint || !daysLoaded || weekKickedRef.current) return;
    const sessions = blueprint.sessions_per_week ?? 0;
    const haveAny = days.some((d) => d.day_number >= 1 && d.day_number <= sessions);
    if (!haveAny && sessions > 0) {
      weekKickedRef.current = true;
      kickWeek();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint, daysLoaded, days]);

  async function kickWeek() {
    const sessions = blueprint?.sessions_per_week ?? 0;
    if (sessions <= 0) return;
    setBulkRunning(true);
    startTsRef.current = Date.now();
    setCompletionTimes([]);
    prevDoneCountRef.current = 0;
    try {
      const res = await generateAllDaysFn({ data: { planId } });
      if (!res.ok) toast.error(res.error || "Microcycle generation failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Microcycle generation crashed");
    } finally {
      setBulkRunning(false);
      await loadDays();
    }
  }

  async function retryFailed() {
    const sessions = blueprint?.sessions_per_week ?? 0;
    if (sessions <= 0) return;
    const missing: number[] = [];
    for (let i = 1; i <= sessions; i++) {
      const row = days.find((d) => d.day_number === i);
      if (!row || row.status === "error") missing.push(i);
    }
    if (missing.length === 0) return;
    setBulkRunning(true);
    try {
      const res = await generateAllDaysFn({ data: { planId, dayIndices: missing } });
      if (!res.ok) toast.error(res.error || "Retry failed");
      else toast.success(`Retried ${missing.length} day(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry crashed");
    } finally {
      setBulkRunning(false);
      await loadDays();
    }
  }

  async function regenDay(dayIndex: number) {
    if (regenSet.has(dayIndex)) return;
    setRegenSet((s) => { const n = new Set(s); n.add(dayIndex); return n; });
    try {
      const res = await generateDayFn({ data: { planId, dayIndex } });
      if (!res.ok) toast.error(res.error || `Day ${dayIndex} failed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Day ${dayIndex} crashed`);
    } finally {
      setRegenSet((s) => { const n = new Set(s); n.delete(dayIndex); return n; });
      await loadDays();
    }
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

  const sessionsPerWeek = blueprint?.sessions_per_week ?? 0;
  const isFinalized = planStatus === "finalized";
  const dayList = useMemo(
    () => Array.from({ length: sessionsPerWeek }, (_, i) => i + 1),
    [sessionsPerWeek],
  );
  const dayState = (idx: number): "queued" | "generating" | "done" | "error" => {
    const row = days.find((d) => d.day_number === idx);
    if (!row) return bulkRunning ? "generating" : "queued";
    if (row.status === "done") return "done";
    if (row.status === "error") return "error";
    return "generating";
  };
  const doneCount = dayList.filter((i) => dayState(i) === "done").length;
  const errorCount = dayList.filter((i) => dayState(i) === "error").length;
  const haveAllRows =
    sessionsPerWeek > 0 &&
    days.filter((d) => d.day_number <= sessionsPerWeek).length >= sessionsPerWeek;
  const allDone = haveAllRows && doneCount === sessionsPerWeek && errorCount === 0;
  const inFlight = bulkRunning || dayList.some((i) => dayState(i) === "generating");
  const pct = sessionsPerWeek > 0 ? Math.round((doneCount / sessionsPerWeek) * 100) : 0;

  // Honest ETA based on observed completion times. Falls back to 18s/day.
  useEffect(() => {
    if (doneCount > prevDoneCountRef.current && startTsRef.current) {
      const elapsed = (Date.now() - startTsRef.current) / 1000;
      const justFinished = doneCount - prevDoneCountRef.current;
      const perDay = elapsed / Math.max(1, doneCount);
      setCompletionTimes((arr) => [...arr, ...Array(justFinished).fill(perDay)]);
      for (let k = 0; k < justFinished; k++) {
        const i = prevDoneCountRef.current + k + 1;
        toast.success(`Day ${i} ready`, { duration: 1500 });
      }
      prevDoneCountRef.current = doneCount;
    }
    if (!inFlight) prevDoneCountRef.current = doneCount;
  }, [doneCount, inFlight]);
  const avgPerDay =
    completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 18;
  const etaSec = Math.max(0, Math.round((sessionsPerWeek - doneCount) * avgPerDay));

  // Auto-focus the first done day if active doesn't exist yet.
  useEffect(() => {
    if (activeDay > sessionsPerWeek) setActiveDay(1);
    const row = days.find((d) => d.day_number === activeDay);
    if (!row) {
      const firstDone = dayList.find((i) => dayState(i) === "done");
      if (firstDone) setActiveDay(firstDone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, sessionsPerWeek]);

  const activeRow = days.find((d) => d.day_number === activeDay);

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
          {errorCount > 0 && !inFlight && (
            <button
              onClick={() => void retryFailed()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-500 hover:bg-amber-500/20"
            >
              <RefreshCw className="h-3 w-3" /> Retry {errorCount} failed day{errorCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Week-at-a-glance: tabs across desktop, swipe-snap on mobile. */}
      {sessionsPerWeek > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
          {dayList.map((idx) => {
            const st = dayState(idx);
            const row = days.find((d) => d.day_number === idx);
            const focus = row?.focus ?? "";
            const isActive = idx === activeDay;
            const tone =
              st === "done"
                ? isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                  : "border-emerald-500/30 bg-emerald-500/5 text-emerald-500/90 hover:bg-emerald-500/10"
                : st === "generating"
                ? "border-amber-500/40 bg-amber-500/5 text-amber-500"
                : st === "error"
                ? "border-red-500/40 bg-red-500/5 text-red-500"
                : "border-dashed border-border bg-card text-muted-foreground";
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveDay(idx)}
                className={`min-w-[140px] snap-start rounded-xl border p-3 text-left transition ${tone}`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span>Day {idx}</span>
                  {st === "done" && <CheckCircle2 className="h-3 w-3" />}
                  {st === "generating" && <Loader2 className="h-3 w-3 animate-spin" />}
                  {st === "error" && <AlertTriangle className="h-3 w-3" />}
                </div>
                <div className="mt-1 truncate text-xs font-medium">{focus || (st === "generating" ? "A gerar…" : st === "error" ? "Falhou" : "Em fila")}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Active day detail */}
      {activeRow && activeRow.status === "done" && (
        <DayCardEditable
          key={`day${activeDay}-${activeRow.updated_at ?? activeRow.status}`}
          dayIndex={activeDay}
          day={activeRow}
          planId={planId}
          onRegen={() => regenDay(activeDay)}
          isGate={false}
        />
      )}
      {activeRow && activeRow.status === "error" && (
        <div className="flex items-center justify-between rounded-2xl border border-red-500/40 bg-red-500/5 p-5">
          <div className="text-sm">
            <p className="font-medium text-red-500">Day {activeDay} failed</p>
            <p className="text-xs text-muted-foreground">Try regenerating just this day.</p>
          </div>
          <button
            onClick={() => regenDay(activeDay)}
            disabled={regenSet.has(activeDay)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {regenSet.has(activeDay) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate Day {activeDay}
          </button>
        </div>
      )}
      {!activeRow && sessionsPerWeek > 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {bulkRunning ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> A gerar Day {activeDay}…</span>
          ) : (
            <span>Em fila</span>
          )}
        </div>
      )}
    </div>
  );
}