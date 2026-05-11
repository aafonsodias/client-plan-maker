// Extracted from src/routes/plans.$planId.tsx — embeddable plan editor surface.
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoTextarea } from "@/components/AutoTextarea";
import { toast } from "sonner";
import {
  Download, Plus, Save, Trash2, CheckCircle2,
  Settings as SettingsIcon, Lock, LockOpen, NotebookPen, Pencil,
  Share2, Copy, RefreshCw, History, Eye, AlertTriangle, Sparkles,
  ChevronDown, ChevronUp, Heart, Check, MinusCircle, XCircle, MessageCircle, PlayCircle, BarChart3, Loader2,
  TrendingUp, Minus, RotateCcw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlanData, Week, Day, Exercise } from "@/lib/pdf";
import { isLegacyPlan } from "@/lib/pdf-types";
import { planStatusInfo } from "@/lib/plan-status";
import { useTranslation } from "react-i18next";
import { markOnboardingStep } from "@/components/OnboardingChecklist";
import { useServerFn } from "@tanstack/react-start";
import { generatePlanWeek, regeneratePlanSummary, persistRegeneratedPlan, getPlanConstraints } from "@/server/plan.functions";
import { useQuery } from "@tanstack/react-query";
import { parseRpeOverrideFromFeedback } from "@/lib/feedback-parser";
import { reanchorPlanRpe } from "@/server/phased/stage3-microcycle.functions";
import { proposeProgressions } from "@/server/phased/stage4-progressions.functions";
import { bulkFillRemainingWeeks } from "@/server/phased/stage5-bulkfill.functions";
import { ensureShareToken, revokeShareToken } from "@/server/sessions.functions";
import { seedDemoSessions } from "@/server/demo-sessions.functions";
import { SessionDayView } from "@/components/SessionDayView";
import { MesocycleTableView } from "@/components/MesocycleTableView";
import { VolumeSection } from "@/components/volume/VolumeSection";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BlockAdaptationCard } from "@/components/BlockAdaptationCard";
import { summarizeAdaptation } from "@/lib/block-adaptation";
import { computeCapacityGain } from "@/lib/capacity-gain";
import { CapacityGainCard } from "@/components/CapacityGainCard";
import { LogbookTimeline } from "@/components/plan/LogbookTimeline";
import { NextBlockCard } from "@/components/NextBlockCard";
import { NextWeekCard } from "@/components/plan/NextWeekCard";
import IntensityCockpit from "@/components/plan/IntensityCockpit";
import type { ProgrammingVariables } from "@/server/phased/schemas";
import { NextMealCue } from "@/components/NextMealCue";
import { summarizeRotation } from "@/lib/rotation-audit";
import type { BlockSummary } from "@/lib/block-feedback";
import { ValidationReport } from "@/components/ValidationReport";
import { HumanReviewBanner } from "@/components/HumanReviewBanner";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ClientAvatar } from "@/components/ClientAvatar";
import { markPlanFinished } from "@/server/blocks-manual.functions";
import { ImportLogDialog } from "@/components/ImportLogDialog";
import { ExerciseTrendChart } from "@/components/ExerciseTrendChart";
import { fetchPlanLineageIds } from "@/lib/plan-lineage";
import { isPlanFullyLogged, summaryLooksLeaked } from "@/lib/plan-status";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
// Trainer-side ops use the browser supabase client directly (RLS-protected).
// Share-token mutations go through server fns so token + expiry stay in sync.


type Mode = "view" | "edit" | "log" | "results" | "progress";
type SessionRow = {
  id: string; plan_id?: string; week_number: number; day_label: string; session_date: string;
  logged_by: string; entries: any[]; session_notes: string | null;
  status?: "done" | "partial" | "missed" | null;
};
type Props = {
  planId: string;
  embedded?: boolean;
  /** When provided, the deck above owns the mode — we hide our own tab strip + Configurar button. */
  mode?: Mode;
  onModeChange?: (m: Mode) => void;
  /** Filter the table/cards to a single week (null = show all). */
  selectedWeek?: number | null;
  /** Hide the duplicated plan-chrome (title row, summary, mode tabs) when a parent deck owns it. */
  hideOwnChrome?: boolean;
};
export default function PlanEditorSurface({
  planId,
  embedded: _embedded,
  mode: modeProp,
  onModeChange,
  selectedWeek = null,
  hideOwnChrome = false,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t: tCommon, i18n } = useTranslation("common");
  const [plan, setPlan] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [data, setData] = useState<PlanData>({ weeks: [] });
  const [saving, setSaving] = useState(false);
  const [modeState, setModeState] = useState<Mode>("view");
  const mode = modeProp ?? modeState;
  const setMode = (m: Mode) => {
    if (onModeChange) onModeChange(m);
    else setModeState(m);
  };
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const seedFn = useServerFn(seedDemoSessions);
  const [seeding, setSeeding] = useState(false);
  const markFinishedFn = useServerFn(markPlanFinished);
  const regenSummaryFn = useServerFn(regeneratePlanSummary);
  const [regenSummaryBusy, setRegenSummaryBusy] = useState(false);
  const reanchorRpeFn = useServerFn(reanchorPlanRpe);
  const [reanchorBusy, setReanchorBusy] = useState(false);

  // Week filter applied by the parent deck. When selectedWeek is set we hand
  // the children a narrowed PlanData so the table only shows that week.
  const filteredData = useMemo<PlanData>(() => {
    if (selectedWeek == null) return data;
    return { ...data, weeks: data.weeks.filter((w) => w.week_number === selectedWeek) };
  }, [data, selectedWeek]);
  // Block transition (manual + IA) is wrapped inside <BlockTransitionDialog />.
  // True when this plan was built by the phased generator and is now complete.
  // In that case `plan_data.weeks` is empty by design — the source of truth is
  // `workout_plan_days`. We synthesize a PlanData for ViewMode + PDF export.
  const [isPhasedComplete, setIsPhasedComplete] = useState(false);
  // C3 — assessment_injuries fed into the "Configurar mesociclo" panel so
  // the trainer can see what's being honoured at regen time.
  const [injuries, setInjuries] = useState<Array<{ id: string; body_zone: string; severity: number; injury_label: string | null; note: string | null }>>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: p } = await supabase.from("workout_plans").select("*").eq("id", planId).single();
      setPlan(p);
      // Phased plan routing:
      //   - in-progress stages (brief / blueprint / microcycle / progressions)
      //     → redirect to that stage's editor
      //   - "complete" → stay here and render the finished plan from
      //     workout_plan_days (the new source of truth)
      const gs: any = (p as any)?.generation_state;
      const stage: string | undefined = gs?.stage;
      if (stage && stage !== "complete") {
        const stageRoute: Record<string, "/plans/$planId/brief" | "/plans/$planId/blueprint" | "/plans/$planId/microcycle" | "/plans/$planId/progressions" | "/plans/$planId/sessions"> = {
          brief: "/plans/$planId/brief",
          blueprint: "/plans/$planId/blueprint",
          microcycle: "/plans/$planId/microcycle",
          progressions: "/plans/$planId/progressions",
          done: "/plans/$planId/sessions",
        };
        const to = stageRoute[stage];
        if (to) {
          console.info("[PlanEditor] redirect", { planId, stage, to });
          navigate({ to, params: { planId }, replace: true });
          return;
        }
      }
      const phasedComplete = stage === "complete" || (p as any)?.generation_status === "complete";
      if (phasedComplete) {
        setIsPhasedComplete(true);
        const { data: dayRows } = await supabase
          .from("workout_plan_days")
          .select("week_number, day_number, day_label, focus, rationale, content")
          .eq("plan_id", planId)
          .order("week_number", { ascending: true })
          .order("day_number", { ascending: true });
        const weeksMap = new Map<number, Week>();
        for (const row of (dayRows ?? []) as any[]) {
          const wn = row.week_number as number;
          if (!weeksMap.has(wn)) {
            weeksMap.set(wn, { week_number: wn, focus: "", days: [] } as Week);
          }
          const wk = weeksMap.get(wn)!;
          const content = row.content ?? {};
          const exercises = Array.isArray(content.exercises) ? content.exercises : [];
          wk.days.push({
            day_label: row.day_label ?? `Day ${row.day_number}`,
            focus: row.focus ?? "",
            rationale: row.rationale ?? undefined,
            exercises,
            warmup: Array.isArray(content.warmup) ? content.warmup : undefined,
            activation: Array.isArray(content.activation) ? content.activation : undefined,
            dynamic_stretches: Array.isArray(content.dynamic_stretches) ? content.dynamic_stretches : undefined,
            cooldown: Array.isArray(content.cooldown) ? content.cooldown : undefined,
            finisher: Array.isArray(content.finisher) ? content.finisher : undefined,
            finisher_enabled: typeof content.finisher_enabled === "boolean" ? content.finisher_enabled : undefined,
            cardio: Array.isArray(content.cardio) ? content.cardio : undefined,
          } as Day);
        }
        const weeks = Array.from(weeksMap.values()).sort((a, b) => a.week_number - b.week_number);
        setData({ weeks });
      } else {
        setData((p?.plan_data as unknown as PlanData) ?? { weeks: [] });
      }
      if (p?.client_id) {
        const { data: c } = await supabase.from("clients").select("*").eq("id", p.client_id).single();
        setClient(c);
        const { data: inj } = await supabase
          .from("assessment_injuries")
          .select("id, body_zone, severity, injury_label, note")
          .eq("client_id", p.client_id)
          .order("severity", { ascending: false });
        setInjuries((inj as any[]) ?? []);
      }
      const { data: pr } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfile(pr);
      if (pr?.logo_url) {
        const { data: signed } = await supabase.storage.from("logos").createSignedUrl(pr.logo_url, 3600);
        setLogoUrl(signed?.signedUrl ?? null);
      }
      try {
        const lineageIds = await fetchPlanLineageIds(planId);
        const { data: list } = await supabase
          .from("workout_sessions")
          .select("*")
          .in("plan_id", lineageIds)
          .order("session_date", { ascending: false });
        setSessions((list as unknown as SessionRow[]) ?? []);
      } catch { /* ignore */ }
    })();
  }, [user, planId]);

  const reloadSessions = async () => {
    try {
      const lineageIds = await fetchPlanLineageIds(planId);
      const { data: list } = await supabase
        .from("workout_sessions")
        .select("*")
        .in("plan_id", lineageIds)
        .order("session_date", { ascending: false });
      setSessions((list as unknown as SessionRow[]) ?? []);
    } catch { /* ignore */ }
  };

  // R66: refetch the prescribed-day rows (used after programNextWeek inserts
  // a new microcycle so the table/cards immediately show Week N+1).
  const reloadPlanDays = async () => {
    if (!isPhasedComplete) return;
    const { data: dayRows } = await supabase
      .from("workout_plan_days")
      .select("week_number, day_number, day_label, focus, rationale, content")
      .eq("plan_id", planId)
      .order("week_number", { ascending: true })
      .order("day_number", { ascending: true });
    const weeksMap = new Map<number, Week>();
    for (const row of (dayRows ?? []) as any[]) {
      const wn = row.week_number as number;
      if (!weeksMap.has(wn)) {
        weeksMap.set(wn, { week_number: wn, focus: "", days: [] } as Week);
      }
      const wk = weeksMap.get(wn)!;
      const content = row.content ?? {};
      const exercises = Array.isArray(content.exercises) ? content.exercises : [];
      wk.days.push({
        day_label: row.day_label ?? `Day ${row.day_number}`,
        focus: row.focus ?? "",
        rationale: row.rationale ?? undefined,
        exercises,
        warmup: Array.isArray(content.warmup) ? content.warmup : undefined,
        activation: Array.isArray(content.activation) ? content.activation : undefined,
        dynamic_stretches: Array.isArray(content.dynamic_stretches) ? content.dynamic_stretches : undefined,
        cooldown: Array.isArray(content.cooldown) ? content.cooldown : undefined,
        finisher: Array.isArray(content.finisher) ? content.finisher : undefined,
        finisher_enabled: typeof content.finisher_enabled === "boolean" ? content.finisher_enabled : undefined,
        cardio: Array.isArray(content.cardio) ? content.cardio : undefined,
      } as Day);
    }
    const weeks = Array.from(weeksMap.values()).sort((a, b) => a.week_number - b.week_number);
    setData({ weeks });
  };

  // Auto-land on Resultados once a plan has enough logged sessions to feel
  // "filled". Per-plan flag in sessionStorage so back-nav still respects user
  // intent if they manually click View/Edit/Log later.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessions.length < 3) return;
    const flag = `planAutoResults:${planId}`;
    if (window.sessionStorage.getItem(flag)) return;
    window.sessionStorage.setItem(flag, "1");
    setMode("results");
  }, [sessions.length, planId]);

  const save = async (extra: Partial<{ status: string }> = {}) => {
    setSaving(true);
    const { error } = await supabase
      .from("workout_plans")
      .update({ title: plan.title, summary: plan.summary, plan_data: data, ...extra })
      .eq("id", planId);
    setSaving(false);
    if (error) return toast.error(error.message);
    if (extra.status) {
      setPlan({ ...plan, ...extra });
      toast.success(extra.status === "finalized" ? "Plan finalized" : "Plan unlocked — back to draft");
    } else {
      toast.success("Plan saved", {
        description: client ? `View ${client.full_name}'s profile` : undefined,
        action: client
          ? { label: "Open client", onClick: () => { window.location.href = `/clients/${client.id}`; } }
          : undefined,
      });
    }
  };

  const exportPdf = async () => {
    if (!client || !plan) return;
    let logoDataUrl: string | null = null;
    if (profile?.logo_url) {
      try {
        const { data: signed } = await supabase.storage.from("logos").createSignedUrl(profile.logo_url, 600);
        if (signed?.signedUrl) {
          const res = await fetch(signed.signedUrl);
          const blob = await res.blob();
          logoDataUrl = await new Promise<string | null>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => resolve(null);
            r.readAsDataURL(blob);
          });
        }
      } catch { /* ignore */ }
    }
    // Block evolution: if this is Block N>1 and we have a prior plan in the lineage,
    // compute capacity-gain and pass it to the PDF so the cover shows progress vs
    // the previous block (parity with the on-screen <CapacityGainCard />).
    const blockN = (plan as any)?.block_number ?? 1;
    const priorPlanId = (plan as any)?.prior_plan_id ?? null;
    let blockEvolution: any[] | null = null;
    if (blockN > 1 && priorPlanId) {
      const current = sessions.filter((s) => (s as any).plan_id === planId);
      const prior = sessions.filter((s) => (s as any).plan_id === priorPlanId);
      if (current.length > 0 || prior.length > 0) {
        const summary = computeCapacityGain(prior as any, current as any);
        blockEvolution = (summary.rows ?? []).map((r) => ({
          label: r.patternLabel,
          priorAvgLoadKg: r.priorAvgLoadKg,
          currentAvgLoadKg: r.currentAvgLoadKg,
          deltaPct: r.deltaPct,
          verdict: r.verdict,
        }));
      }
    }
    const { generatePlanPdf } = await import("@/lib/pdf");
    // Round 63 — pull assessment so the PDF cover can render the missions ladder.
    let assessmentRow: any = null;
    if ((plan as any).assessment_id) {
      const { data: a } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", (plan as any).assessment_id)
        .maybeSingle();
      assessmentRow = a;
    }
    await generatePlanPdf(
      {
        title: plan.title,
        summary: plan.summary,
        client_name: client.full_name,
        duration_weeks: plan.duration_weeks,
        block_number: blockN,
        block_transition_summary: (plan as any)?.block_transition_summary ?? null,
        block_evolution: blockEvolution,
        assessment: assessmentRow,
        client: client as any,
        training_days_per_week: assessmentRow?.training_days_per_week ?? null,
        assessment_completion_pct: (plan as any).assessment_completion_pct ?? null,
        locale: i18n?.language ?? "pt",
      },
      data,
      {
        business_name: profile?.business_name,
        full_name: profile?.full_name,
        tagline: profile?.tagline,
        contact_email: profile?.contact_email,
        contact_phone: profile?.contact_phone,
        logo_data_url: logoDataUrl,
      }
    );
    if (user) { void markOnboardingStep(user.id, "export_pdf"); }
  };

  if (!plan) return <p className="text-muted-foreground">{tCommon("actions.loading")}</p>;

  return (
    <div className={hideOwnChrome ? "flex flex-col gap-4" : "space-y-4"}>
      {/* Round 63 — "Needs human review" lives on its own surface, above
          the collapsed plan chrome. Discreet amber, not error red. */}
      <HumanReviewBanner generationMeta={plan.generation_meta} />
      {/* Plan chrome — collapsed by default so the workout table is the first
          thing on the page. Trainer expands when they need title, actions,
          summary, block transition, etc. */}
      <details
        id="plan-details-actions"
        className={
          "group rounded-2xl border border-border bg-card/40 open:bg-card" +
          (hideOwnChrome ? " order-last" : "")
        }
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <span className="inline-flex items-center gap-2 normal-case tracking-normal">
            <SettingsIcon className="h-3.5 w-3.5" />
            <span className="font-semibold uppercase tracking-widest">Detalhes & acções do plano</span>
          </span>
          <span className="text-muted-foreground/60 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-4 border-t border-border px-3 pb-4 pt-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="relative z-0 min-w-0 flex-1">
          {client && (
            <Link
              to="/clients/$clientId"
              params={{ clientId: client.id }}
              className="inline-flex max-w-full items-center gap-2 truncate text-xs text-muted-foreground hover:text-foreground"
            >
              <ClientAvatar
                name={client.full_name}
                photoUrl={client.photo_url ?? null}
                size={20}
              />
              <span className="truncate">{client.full_name} →</span>
            </Link>
          )}
          <div data-tour="plan-header" className="mt-1 flex flex-wrap items-center gap-2">
            <Input
              className="h-9 max-w-md border-0 bg-transparent px-0 !text-xl font-bold tracking-tight focus-visible:ring-0"
              value={plan.title}
              onChange={(e) => setPlan({ ...plan, title: e.target.value })}
            />
            {(() => {
              const block = (plan as any).block_number ?? 1;
              if (block <= 1) return null;
              const fb = ((plan as any).generation_meta?.block_feedback ?? null) as BlockSummary | null;
              const chip = (
                <span
                  data-tour="plan-block-chip"
                  title={fb ? undefined : ((plan as any).block_transition_summary ?? undefined)}
                  className="inline-flex cursor-help items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-amber-300"
                >
                  Bloco {block} · evoluiu de Bloco {block - 1}
                </span>
              );
              if (!fb) return chip;
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="cursor-pointer">{chip}</button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[420px] p-3">
                    <BlockAdaptationCard feedback={fb} variant="full" />
                    {(plan as any).block_transition_summary && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {(plan as any).block_transition_summary}
                      </p>
                    )}
                  </PopoverContent>
                </Popover>
              );
            })()}
            {(() => {
              const view = summarizeRotation((plan as any).generation_meta?.rotation_audit);
              if (!view) return null;
              const pool = ((plan as any).generation_meta?.prior_exercise_pool ?? []) as string[];
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${view.toneClass}`}
                    >
                      {tCommon("blocks.rotation.chip", { pct: Math.round(view.finalPct ?? 0) })}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[320px] space-y-2 p-3 text-xs">
                    <p className="font-semibold">{tCommon("blocks.rotation.popover_title")}</p>
                    <p className="text-muted-foreground">
                      {view.retried
                        ? tCommon("blocks.rotation.after_retry", {
                            first: Math.round(view.firstPct ?? 0),
                            final: Math.round(view.finalPct ?? 0),
                          })
                        : tCommon("blocks.rotation.no_retry", {
                            final: Math.round(view.finalPct ?? 0),
                          })}
                      {view.daysRegenerated.length > 0 && (
                        <> {tCommon("blocks.rotation.days_regenerated", { days: view.daysRegenerated.join(", ") })}</>
                      )}
                    </p>
                    {pool.length > 0 && (
                      <div>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {tCommon("blocks.rotation.pool_label")}
                        </p>
                        <ul className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                          {pool.slice(0, 6).map((n) => (
                            <li key={n} className="truncate text-foreground/80">{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              );
            })()}
            {(plan as any).generation_meta?.suggest_main_lift_swap && (() => {
              const audit = (plan as any).generation_meta?.main_lift_audit;
              const honored = !!audit?.honored;
              const swapped: string[] = audit?.swappedNames ?? [];
              const prior: string[] = audit?.priorMain ?? [];
              const tone = honored
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-muted bg-muted/20 text-muted-foreground";
              const label = honored
                ? `${tCommon("blocks.main_lift.refreshed")}${audit?.swappedCount ? ` · ${audit.swappedCount}` : ""}`
                : tCommon("blocks.main_lift.kept");
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${tone}`}
                    >
                      {label}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[320px] space-y-2 p-3 text-xs">
                    <p className="font-semibold">
                      {honored ? tCommon("blocks.main_lift.refreshed") : tCommon("blocks.main_lift.kept")}
                    </p>
                    <p className="text-muted-foreground">
                      {honored
                        ? tCommon("blocks.main_lift.refreshed_desc")
                        : tCommon("blocks.main_lift.kept_desc")}
                    </p>
                    {swapped.length > 0 && (
                      <div>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {tCommon("blocks.main_lift.new_label")}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {swapped.slice(0, 6).map((n) => (
                            <li key={n} className="truncate text-foreground/80">{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {prior.length > 0 && (
                      <div>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          {tCommon("blocks.main_lift.prior_label")}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {prior.slice(0, 6).map((n) => (
                            <li key={n} className="truncate text-foreground/60">{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              );
            })()}
            {(() => {
              const s = planStatusInfo(plan, tCommon as any);
              if (s.key === "draft") return null;
              return (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${s.className}`}
                >
                  {s.key === "finalized" && <CheckCircle2 className="h-3 w-3" />}
                  {s.label}
                </span>
              );
            })()}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <ShareDialog
            planId={planId}
            initialToken={plan.share_token}
            onChange={(t) => setPlan({ ...plan, share_token: t })}
            clientFirstName={(client?.full_name ?? "there").split(" ")[0]}
            clientPhone={client?.phone ?? null}
            planTitle={plan.title}
          />
          <Button
            size="sm"
            onClick={exportPdf}
            className="h-8 bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm hover:from-amber-500 hover:to-amber-700 hover:shadow-md transition-all"
            title={tCommon("plan.export_pdf_title")}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
          </Button>
          <ImportLogDialog planId={planId} plan={data} />
          <SaveAsTemplateDialog planId={planId} defaultName={plan.title} />
          {isPhasedComplete && (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={reanchorBusy}
              title={tCommon("plan.reanchor_rpe_title")}
              onClick={async () => {
                setReanchorBusy(true);
                try {
                  const r: any = await reanchorRpeFn({ data: { planId } });
                  if (r?.ok) {
                    if (r.exercisesBumped > 0) {
                      toast.success(
                        `Re-ancorado: ${r.exercisesBumped} exercício(s) em ${r.daysTouched} dia(s) — piso ${r.tier}/${r.appetite} aplicado.`,
                      );
                      // Force fresh load so the table re-reads the bumped RPEs.
                      window.location.reload();
                    } else {
                      toast.info(tCommon("plan.reanchor_rpe_noop"));
                    }
                  } else {
                    toast.error(r?.error ?? "Falhou re-ancorar RPE.");
                  }
                } finally {
                  setReanchorBusy(false);
                }
              }}
            >
              {reanchorBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
              )}
              Re-ancorar RPE
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-destructive"
            onClick={async () => {
              if (!confirm("Delete this plan? This cannot be undone.")) return;
              const { error } = await supabase.from("workout_plans").delete().eq("id", planId);
              if (error) return toast.error(error.message);
              toast.success("Plan deleted");
              navigate({ to: "/plans" });
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Summary — collapsible */}
      <div className="rounded-lg border border-border bg-card/50">
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setSummaryOpen((o) => !o)}
            className="flex flex-1 items-center justify-between gap-2 text-left"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Summary {plan.summary?.trim() ? "" : "(empty)"}
            </span>
            {summaryOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
          {summaryLooksLeaked(plan?.summary) && plan?.brief && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px]"
              disabled={regenSummaryBusy}
              title={tCommon("plan.rewrite_summary_title")}
              onClick={async () => {
                setRegenSummaryBusy(true);
                try {
                  const r: any = await regenSummaryFn({ data: { planId, force: true } });
                  if (r?.ok && r?.summary) {
                    setPlan({ ...plan, summary: r.summary });
                    toast.success("Resumo regenerado a partir do brief.");
                  } else {
                    toast.error(r?.error ?? "Falhou regenerar resumo.");
                  }
                } finally {
                  setRegenSummaryBusy(false);
                }
              }}
            >
              {regenSummaryBusy ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-3 w-3" />
              )}
              Re-gerar
            </Button>
          )}
        </div>
        {summaryOpen && (
          <div className="border-t border-border px-3 pb-3 pt-2 animate-fade-in">
            {client && (
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {client.age != null && <span><b className="text-foreground">{client.age}</b> anos</span>}
                {client.sex && <span className="capitalize">{client.sex}</span>}
                {client.height_cm && <span><b className="text-foreground">{client.height_cm}</b> cm</span>}
                {client.weight_kg && <span><b className="text-foreground">{client.weight_kg}</b> kg</span>}
                {plan.brief?.training_age_band && (
                  <span>Experiência: <b className="text-foreground">{plan.brief.training_age_band}</b></span>
                )}
                {plan.brief?.primary_goal && (
                  <span>Objectivo: <b className="text-foreground">{plan.brief.primary_goal}</b></span>
                )}
                {Array.isArray(plan.brief?.red_flags) && plan.brief.red_flags.length > 0 && (
                  <span className="text-amber-300">⚠ {plan.brief.red_flags.slice(0, 3).join(" · ")}</span>
                )}
              </div>
            )}
            {mode === "edit" ? (
              <AutoTextarea
                minRows={2}
                value={plan.summary ?? ""}
                onChange={(e) => setPlan({ ...plan, summary: e.target.value })}
                placeholder="High-level summary of this program…"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {plan.summary?.trim() ? plan.summary : <span className="text-muted-foreground italic">No summary yet.</span>}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Demo recovery: if this is a demo client with a finalized plan and zero
          logged sessions, offer one-click logbook seeding instead of forcing a
          full demo recreation. */}
      {plan?.generation_status === "complete"
        && /\(demo\)$/i.test(client?.full_name ?? "")
        && sessions.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <div className="flex-1">
            <p className="font-semibold text-foreground">Logbook vazio.</p>
            <p className="mt-0.5 text-muted-foreground">
              Este é um cliente demo mas o logbook não foi populado. Carrega para gerar 2 semanas de sessões realistas.
            </p>
          </div>
          <Button
            size="sm"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                const r: any = await seedFn({ data: { planId, weeksToSeed: 2 } });
                if (r?.ok) {
                  toast.success(`${r.inserted ?? 0} sessões adicionadas.`);
                  await reloadSessions();
                  setMode("results");
                } else {
                  toast.error(r?.error ?? "Falhou ao popular logbook.");
                }
              } finally { setSeeding(false); }
            }}
          >
            {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Preencher logbook agora
          </Button>
        </div>
      )}

      {/* Concluir bloco e iniciar o próximo. O caminho manual está sempre
          disponível para qualquer plano finalizado; a opção IA só aparece
          em planos de demonstração (mantém a IA como atalho honesto). */}
      {plan?.generation_status === "complete"
        && plan?.status !== "archived" && (
        <>
          <NextBlockCard
            planId={planId}
            blockNumber={(plan as any).block_number ?? 1}
            sessions={sessions as any}
            fullyLogged={isPlanFullyLogged(plan, sessions.length)}
            allowAi={/\(demo\)$/i.test(client?.full_name ?? "") && sessions.length > 0}
            completionState={(plan as any).completion_state}
            onMarkFinished={async () => {
              const r: any = await markFinishedFn({ data: { planId, archive: false } });
              if (r?.ok) {
                toast.success(tCommon("plan.marked_complete"));
                setPlan({ ...plan, completion_state: "finished_logging" });
              } else {
                toast.error(r?.error ?? tCommon("plan.mark_complete_failed"));
              }
            }}
          />
          {/* R66: deterministic next-week generator, gated by adherence ≥ 80%. */}
          <NextWeekCard
            planId={planId}
            onCreated={async () => { await reloadPlanDays(); await reloadSessions(); }}
          />
        </>
      )}

      {/* AI Validation Report — always visible to the trainer */}
      <ValidationReport generationMeta={plan.generation_meta} />

      {/* Legacy plan: prompt regeneration */}
      {data.weeks.length > 0 && isLegacyPlan(data) && client && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">This plan uses the old Protocol structure.</p>
            <p className="mt-0.5 text-muted-foreground">
              Regenerate from {client?.full_name ?? "client"}'s assessment to get the full session arc — warmup, activation,
              dynamic prep, main work, cooldown and an optional finisher — plus muscle tags, RPE and tempo on every exercise.
            </p>
          </div>
          <Link
            to="/clients/$clientId"
            params={{ clientId: client.id }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-200 hover:bg-amber-500/20"
          >
            <Sparkles className="h-3 w-3" /> Regenerate
          </Link>
        </div>
      )}
        </div>
      </details>

      {/* Mode tabs — editorial underline row, tonal hover, no card-soup.
          Hidden when a parent deck owns `mode`. */}
      {!hideOwnChrome && (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/60">
        <div role="tablist" className="-mb-px flex w-full max-w-full items-center gap-0.5 overflow-x-auto text-[11px] font-semibold uppercase tracking-widest sm:w-auto sm:gap-1">
          {(
            [
              { key: "view", label: "View", Icon: Eye },
              { key: "edit", label: "Edit", Icon: Pencil, title: isPhasedComplete ? "Edit values inline — no re-approval needed" : undefined },
              { key: "log", label: "Log", Icon: NotebookPen },
              { key: "results", label: "Resultados", Icon: BarChart3, badge: sessions.length > 0 ? sessions.length : undefined },
              { key: "progress", label: "Progresso", Icon: TrendingUp, title: tCommon("plan.trend_chart_title") },
            ] as Array<{ key: Mode; label: string; Icon: typeof Eye; title?: string; badge?: number }>
          ).map(({ key, label, Icon, title, badge }) => {
            const active = mode === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setMode(key as Mode)}
                title={title}
                className={`relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 transition ${
                  active
                    ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-px after:bg-amber-400"
                    : "text-muted-foreground/80 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
                {badge !== undefined && (
                  <span className="ml-0.5 rounded-full bg-emerald-500/15 px-1.5 py-px text-[9px] font-semibold normal-case tracking-normal text-emerald-300">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {mode !== "edit" && plan?.status !== "finalized" && client && (
          <button
            type="button"
            onClick={() => setMode("edit")}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            title="Configurar e regenerar este mesociclo"
          >
            <Sparkles className="h-3.5 w-3.5" /> Configurar mesociclo
          </button>
        )}
      </div>
      )}

      {mode === "view" ? (
        <>
          <div className="animate-fade-in">
            <CapacityGainBlock plan={plan} sessions={sessions} planId={planId} />
          </div>
          <ViewMode
            plan={filteredData}
            planId={planId}
            sessions={sessions}
            reload={reloadSessions}
            wave={(plan as any)?.generation_meta?.wave_periodization?.weeks ?? null}
          />
          {/* Around-the-workout nutrition windows — moved here from the client overview (R55). */}
          <details className="group rounded-2xl border border-border bg-card/40 open:bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
                Around the workout
                <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground/70">— refeições e janelas</span>
              </span>
              <span className="text-muted-foreground/60 transition group-open:rotate-180">▾</span>
            </summary>
            <div className="px-3 pb-3 pt-1">
              <NextMealCue />
            </div>
          </details>
          {sessions.filter((s) => (s as any).plan_id === planId).length > 0 && (
            <LogbookTimeline
              sessions={sessions.filter((s) => (s as any).plan_id === planId) as any}
              currentPlanVersion={(plan as any)?.plan_data_version ?? 1}
            />
          )}
        </>
      ) : mode === "edit" ? (
        <>
          {isPhasedComplete && (
            <VolumeSection
              plan={data}
              adaptation={summarizeAdaptation(((plan as any).generation_meta?.block_feedback ?? null) as BlockSummary | null)}
              sessions={sessions.filter((s) => (s as any).plan_id === planId) as any}
            />
          )}
          {/* C3 — "Configurar mesociclo" condensa Cockpit + lesões honradas +
              CTA Regenerar num único painel dentro do edit. Substitui o botão
              flutuante anterior. R67: Cockpit grava em programming_variables;
              novas microciclos via NextWeekCard apanham logo. */}
          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-4 space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
                  Configurar mesociclo
                </h2>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ajusta o motor de progressão, vê as lesões honradas e regenera — tudo no mesmo sítio.
              </p>
            </header>

            <IntensityCockpit
              value={(plan?.programming_variables ?? {}) as ProgrammingVariables}
              primaryGoal={(plan as any)?.training_brief?.primary_goal}
              onChange={async (next) => {
                setPlan({ ...plan, programming_variables: next });
                const { error } = await supabase
                  .from("workout_plans")
                  .update({ programming_variables: next as any })
                  .eq("id", planId);
                if (error) toast.error(error.message);
              }}
            />

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground">
                Lesões honradas pelo motor
              </h3>
              {injuries.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nenhuma lesão registada na avaliação. O motor não aplica filtros por zona.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {injuries.map((inj) => {
                    const tone =
                      inj.severity >= 4
                        ? "border-red-500/40 bg-red-500/10 text-red-300"
                        : inj.severity >= 3
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : "border-border bg-muted/40 text-muted-foreground";
                    return (
                      <li
                        key={inj.id}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${tone}`}
                        title={inj.note ?? undefined}
                      >
                        <span className="font-medium">{inj.body_zone.replace(/_/g, " ")}</span>
                        <span className="opacity-70">· sev {inj.severity}</span>
                        {inj.injury_label && <span className="opacity-70">· {inj.injury_label}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Filtros aplicados automaticamente a cada regen — auditados em <code>generation_log.injury_filters_applied</code>.
              </p>
            </div>

            {plan?.status !== "finalized" && client && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 p-3">
                <div className="text-[11px] text-muted-foreground">
                  Pronto a regenerar com estes valores? A versão actual é arquivada — sem perda de logs.
                </div>
                <RegenerateWithFeedbackDialog
                  planId={planId}
                  clientId={client.id}
                  assessmentId={plan.assessment_id}
                  durationWeeks={plan.duration_weeks ?? 4}
                  isPhasedComplete={isPhasedComplete}
                  previousPlan={{ title: plan.title, summary: plan.summary, weeks: data.weeks }}
                  onRegenerated={async (newPlan) => {
                    setData({ weeks: newPlan.weeks ?? [] });
                    setPlan({ ...plan, title: newPlan.title ?? plan.title, summary: newPlan.summary ?? plan.summary });
                    if (isPhasedComplete) {
                      await reloadPlanDays();
                    }
                  }}
                />
              </div>
            )}
          </section>
          <MesocycleTableView
            plan={filteredData}
            planId={planId}
            editable={true}
            onUpdated={reloadSessions}
            wave={(plan as any)?.generation_meta?.wave_periodization?.weeks ?? null}
          />
        </>
      ) : mode === "results" ? (
        <>
          <CapacityGainBlock plan={plan} sessions={sessions} planId={planId} />
          <ResultsPanel plan={filteredData} sessions={sessions as any} />
          <LogbookTimeline
            sessions={sessions.filter((s) => (s as any).plan_id === planId) as any}
            currentPlanVersion={(plan as any)?.plan_data_version ?? 1}
          />
        </>
      ) : mode === "progress" ? (
        <ExerciseTrendChart
          sessions={sessions as any}
          blockNumber={(plan as any).block_number ?? 1}
        />
      ) : (
        <LogMode plan={filteredData} planId={planId} sessions={sessions} reload={reloadSessions} onExportPdf={exportPdf} />
      )}
    </div>
  );
}


function ViewMode({
  plan,
  planId,
  sessions,
  reload,
  wave,
}: {
  plan: PlanData;
  planId: string;
  sessions: SessionRow[];
  reload: () => Promise<void>;
  wave?: Array<{ week: number; rpe_low?: number | null; rpe_high?: number | null; tag?: string | null }> | null;
}) {
  const [layout, setLayout] = useState<"cards" | "table">(() => {
    if (typeof window === "undefined") return "table";
    const saved = window.localStorage.getItem("planLayout");
    return saved === "cards" ? "cards" : "table";
  });
  const setLayoutPersisted = (next: "cards" | "table") => {
    setLayout(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("planLayout", next);
    }
  };
  if (!plan.weeks.length) {
    return <p className="text-sm text-muted-foreground">No weeks yet. Switch to Edit to build the plan.</p>;
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
          <button
            onClick={() => setLayoutPersisted("table")}
            className={`rounded-md px-3 py-1 transition ${layout === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Table
          </button>
          <button
            onClick={() => setLayoutPersisted("cards")}
            className={`rounded-md px-3 py-1 transition ${layout === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Cards
          </button>
        </div>
      </div>
      {layout === "table" ? (
        <MesocycleTableView
          plan={plan}
          planId={planId}
          editable={true}
          onUpdated={() => void reload()}
          wave={wave ?? null}
        />
      ) : (
        <div className="space-y-12">
      {plan.weeks.map((w, wi) => (
        <div key={wi} className="space-y-10">
          {/* Week marker — minimal, lets the day headers carry the weight */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
              Week {w.week_number}
            </span>
            {w.focus && (
              <>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{w.focus}</span>
              </>
            )}
          </div>
          {w.rationale && (
            <p className="-mt-6 max-w-2xl border-l-2 border-accent/40 pl-3 text-[11px] italic leading-relaxed text-muted-foreground">
              {w.rationale}
            </p>
          )}
          {w.days.map((d, di) => (
            <SessionDayView
              key={di}
              week={w}
              day={d}
              index={di}
              rightSlot={
                <DayQuickMark
                  planId={planId}
                  weekNumber={w.week_number}
                  dayLabel={d.day_label}
                  sessions={sessions}
                  reload={reload}
                />
              }
            />
          ))}
        </div>
      ))}
        </div>
      )}
    </div>
  );
}

/**
 * Quick plan-vs-actual marker for a day. One click writes a workout_sessions
 * row with status=done|partial|missed and empty entries — the trainer can
 * always open Log mode later to add detail. Re-clicking the same status
 * removes the latest mark for that day.
 */
function DayQuickMark({
  planId,
  weekNumber,
  dayLabel,
  sessions,
  reload,
}: {
  planId: string;
  weekNumber: number;
  dayLabel: string;
  sessions: SessionRow[];
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  // Latest session for this exact day cell
  const latest = sessions
    .filter((s) => s.week_number === weekNumber && s.day_label === dayLabel)
    .sort((a, b) => b.session_date.localeCompare(a.session_date))[0];

  const current = (latest?.status ?? null) as "done" | "partial" | "missed" | null;

  const mark = async (status: "done" | "partial" | "missed") => {
    setBusy(true);
    try {
      // Toggle off if clicking the same status that's already set
      if (current === status && latest) {
        const { error } = await supabase.from("workout_sessions").delete().eq("id", latest.id);
        if (error) throw error;
        toast.success("Mark cleared");
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const { data: u } = await supabase.auth.getUser();
        const trainerId = u.user?.id;
        if (!trainerId) throw new Error("Not authenticated");
        const { error } = await supabase.from("workout_sessions").insert({
          plan_id: planId,
          trainer_id: trainerId,
          week_number: weekNumber,
          day_label: dayLabel,
          session_date: today,
          status,
          entries: [],
          logged_by: "trainer",
        });
        if (error) throw error;
        toast.success(
          status === "done" ? "Marked done" : status === "partial" ? "Marked partial" : "Marked missed",
        );
        void markOnboardingStep(trainerId, "log_session");
      }
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to mark");
    } finally {
      setBusy(false);
    }
  };

  const btn = (
    val: "done" | "partial" | "missed",
    Icon: typeof Check,
    label: string,
    activeClass: string,
  ) => {
    const active = current === val;
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => mark(val)}
        title={active ? `${label} — click to clear` : label}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors disabled:opacity-50 ${
          active
            ? activeClass
            : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  };

  return (
    <div className="inline-flex items-center gap-1">
      {btn("done", Check, "Done", "border-emerald-500/40 bg-emerald-500/15 text-emerald-600")}
      {btn("partial", MinusCircle, "Partial", "border-amber-500/40 bg-amber-500/15 text-amber-600")}
      {btn("missed", XCircle, "Missed", "border-rose-500/40 bg-rose-500/15 text-rose-600")}
    </div>
  );
}

/* ─────────── Share dialog ─────────── */

function ShareDialog({
  planId,
  initialToken,
  onChange,
  clientFirstName,
  clientPhone,
  planTitle,
}: {
  planId: string;
  initialToken: string | null;
  onChange: (t: string | null) => void;
  clientFirstName: string;
  clientPhone: string | null;
  planTitle: string;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);
  const ensureFn = useServerFn(ensureShareToken);
  const revokeFn = useServerFn(revokeShareToken);

  const url = token ? `${window.location.origin}/log/${token}` : null;
  const waMsg = url
    ? encodeURIComponent(
        `Hi ${clientFirstName}, here's your training plan "${planTitle}". Tap to log each session: ${url}`
      )
    : "";
  const waPhone = (clientPhone ?? "").replace(/[^\d]/g, "");
  const waUrl = url
    ? waPhone
      ? `https://wa.me/${waPhone}?text=${waMsg}`
      : `https://wa.me/?text=${waMsg}`
    : "#";

  const enable = async (rotate = false) => {
    setBusy(true);
    try {
      const res = await ensureFn({ data: { plan_id: planId, rotate } });
      setToken(res.share_token);
      onChange(res.share_token);
      toast.success(rotate ? "Link rotated" : "Share link ready");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true);
    try {
      await revokeFn({ data: { plan_id: planId } });
      setToken(null); onChange(null);
      toast.success("Link revoked");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client log link</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Anyone with this link can log their actual sets/reps/weights for this plan. They cannot view or edit the plan itself.
        </p>
        {url ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button onClick={copy} variant="outline"><Copy className="h-4 w-4" /></Button>
            </div>
            <Button asChild variant="outline" className="w-full">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                {waPhone ? `Send to ${clientFirstName} on WhatsApp` : "Send via WhatsApp"}
              </a>
            </Button>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => enable(true)} disabled={busy}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rotate
              </Button>
              <Button variant="destructive" size="sm" onClick={revoke} disabled={busy}>Revoke link</Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button onClick={() => enable(false)} disabled={busy}>
              <Share2 className="mr-2 h-4 w-4" /> Generate link
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Log mode ─────────── */

type SetLog = { reps: string; weight: string };
type LogEntry = {
  exercise_name: string;
  planned: { sets: string; reps: string; rest: string; notes: string; rpe?: string; tempo?: string; technique_cues?: string };
  sets: SetLog[];
  notes: string;
};

function parsePlannedSets(s: string): number {
  const n = parseInt((s || "").match(/\d+/)?.[0] ?? "", 10);
  if (Number.isFinite(n) && n > 0 && n < 20) return n;
  return 3;
}

function LogMode({ plan, planId, sessions, reload, onExportPdf }: { plan: PlanData; planId: string; sessions: SessionRow[]; reload: () => void; onExportPdf: () => Promise<void> }) {
  const navigate = useNavigate();
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const firstWeek = plan.weeks[0]?.week_number ?? 1;
  const firstDay = plan.weeks[0]?.days[0]?.day_label ?? "Day 1";
  const [weekNum, setWeekNum] = useState<number>(firstWeek);
  const [dayLabel, setDayLabel] = useState<string>(firstDay);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [rewards, setRewards] = useState<Record<string, number>>({});
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const week = plan.weeks.find((w) => w.week_number === weekNum) ?? plan.weeks[0];
  const day = week?.days.find((d) => d.day_label === dayLabel) ?? week?.days[0];

  // Find any existing trainer session for this (week, day, date) — so reopening
  // the picker hydrates the form instead of zeroing the fields. Falls back to
  // the most recent session for the same (week, day) regardless of date.
  const existingSession = useMemo(() => {
    const exact = safeSessions.find(
      (s) => s.week_number === weekNum && s.day_label === dayLabel && s.session_date === date && s.logged_by === "trainer",
    );
    if (exact) return exact;
    return safeSessions
      .filter((s) => s.week_number === weekNum && s.day_label === dayLabel && s.logged_by === "trainer")
      .sort((a, b) => (b.session_date > a.session_date ? 1 : -1))[0];
  }, [safeSessions, weekNum, dayLabel, date]);

  // Last logged session for this (week, day) — used for ghost values + "duplicate"
  // when we are NOT editing an existing one. Excludes today's exact match so the
  // ghost reflects the previous time this slot was trained, not the current draft.
  const lastSession = useMemo(() => {
    return safeSessions
      .filter(
        (s) =>
          s.week_number === weekNum &&
          s.day_label === dayLabel &&
          s.logged_by === "trainer" &&
          s.id !== editingSessionId,
      )
      .sort((a, b) => (b.session_date > a.session_date ? 1 : -1))[0];
  }, [safeSessions, weekNum, dayLabel, editingSessionId]);

  const lastByName = useMemo(() => {
    const m = new Map<string, { reps: string; weight: string }[]>();
    for (const ent of (lastSession?.entries ?? []) as any[]) {
      if (ent && typeof ent === "object" && ent.exercise_name && Array.isArray(ent.sets)) {
        m.set(
          ent.exercise_name,
          ent.sets.map((s: any) => ({ reps: String(s?.reps ?? ""), weight: String(s?.weight ?? "") })),
        );
      }
    }
    return m;
  }, [lastSession]);

  const duplicateLast = () => {
    if (!lastSession) return;
    setEntries((prev) =>
      prev.map((e) => {
        const prior = lastByName.get(e.exercise_name);
        if (!prior || prior.length === 0) return e;
        return { ...e, sets: prior.map((s) => ({ reps: s.reps, weight: s.weight })) };
      }),
    );
    toast.success("Pre-filled from last session — adjust and save.");
  };

  // Stepper helpers (FitNotes-style). Reps integer ±1, weight float ±2.5 kg.
  const bumpReps = (i: number, si: number, delta: number) => {
    const cur = parseInt(entries[i]?.sets[si]?.reps ?? "", 10);
    const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) + delta);
    updateSet(i, si, "reps", String(next));
  };
  const bumpWeight = (i: number, si: number, delta: number) => {
    const cur = parseFloat(entries[i]?.sets[si]?.weight ?? "");
    const base = Number.isFinite(cur) ? cur : 0;
    const next = Math.max(0, Math.round((base + delta) * 10) / 10);
    updateSet(i, si, "weight", String(next));
  };

  useEffect(() => {
    if (!day) { setEntries([]); return; }
    // If a session already exists for this slot, hydrate it so the trainer
    // edits instead of duplicating. Match planned exercises by name; new ones
    // (added since logging) appear empty at the bottom.
    if (existingSession) {
      setEditingSessionId(existingSession.id);
      if (existingSession.session_date && existingSession.session_date !== date) {
        setDate(existingSession.session_date);
      }
      const loggedByName = new Map<string, any>();
      for (const ent of (existingSession.entries ?? [])) {
        if (ent && typeof ent === "object" && ent.exercise_name) loggedByName.set(ent.exercise_name, ent);
      }
      setEntries(
        day.exercises.map((e) => {
          const n = parsePlannedSets(e.sets ?? "");
          const planned = {
            sets: e.sets ?? "", reps: e.reps ?? "", rest: e.rest ?? "", notes: e.notes ?? "",
            rpe: e.rpe ?? "", tempo: e.tempo ?? "", technique_cues: e.technique_cues ?? "",
          };
          const prior = loggedByName.get(e.name);
          if (prior) {
            const priorSets: SetLog[] = Array.isArray(prior.sets)
              ? prior.sets.map((s: any) => ({ reps: String(s?.reps ?? ""), weight: String(s?.weight ?? "") }))
              : Array.from({ length: n }, () => ({ reps: "", weight: "" }));
            return { exercise_name: e.name, planned, sets: priorSets, notes: prior.notes ?? "" };
          }
          return { exercise_name: e.name, planned, sets: Array.from({ length: n }, () => ({ reps: "", weight: "" })), notes: "" };
        }),
      );
      setNotes(existingSession.session_notes ?? "");
      return;
    }
    setEditingSessionId(null);
    setEntries(
      day.exercises.map((e) => {
        const n = parsePlannedSets(e.sets ?? "");
        return {
          exercise_name: e.name,
          planned: {
            sets: e.sets ?? "", reps: e.reps ?? "", rest: e.rest ?? "", notes: e.notes ?? "",
            rpe: e.rpe ?? "", tempo: e.tempo ?? "", technique_cues: e.technique_cues ?? "",
          },
          sets: Array.from({ length: n }, () => ({ reps: "", weight: "" })),
          notes: "",
        };
      }),
    );
    setNotes("");
  }, [weekNum, dayLabel, plan, existingSession?.id]);

  const updateSet = (i: number, si: number, k: keyof SetLog, v: string) => {
    const copy = [...entries];
    const sets = [...copy[i].sets];
    const prev = sets[si];
    const wasComplete = !!(prev.reps && prev.weight);
    sets[si] = { ...sets[si], [k]: v };
    const nowComplete = !!(sets[si].reps && sets[si].weight);
    copy[i] = { ...copy[i], sets };
    setEntries(copy);
    if (!wasComplete && nowComplete) {
      const key = `${i}-${si}`;
      setRewards((r) => ({ ...r, [key]: Date.now() }));
      setTimeout(() => setRewards((r) => { const { [key]: _, ...rest } = r; return rest; }), 700);
    }
  };
  const addSet = (i: number) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], sets: [...copy[i].sets, { reps: "", weight: "" }] };
    setEntries(copy);
  };
  const removeSet = (i: number, si: number) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], sets: copy[i].sets.filter((_, idx) => idx !== si) };
    setEntries(copy);
  };
  const updateExNotes = (i: number, v: string) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], notes: v };
    setEntries(copy);
  };

  const submit = async () => {
    if (!day) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      let newId: string | undefined;
      let updated = false;
      if (editingSessionId) {
        const { data: upd, error } = await supabase.from("workout_sessions").update({
          week_number: weekNum,
          day_label: dayLabel,
          session_date: date,
          session_notes: notes,
          entries: entries as any,
        }).eq("id", editingSessionId).eq("trainer_id", user.id).select("id").single();
        if (error) throw error;
        newId = upd?.id;
        updated = true;
      } else {
        const { data: inserted, error } = await supabase.from("workout_sessions").insert({
          plan_id: planId,
          trainer_id: user.id,
          week_number: weekNum,
          day_label: dayLabel,
          session_date: date,
          session_notes: notes,
          entries: entries as any,
          logged_by: "trainer",
        }).select("id").single();
        if (error) throw error;
        newId = inserted?.id;
        if (newId) setEditingSessionId(newId);
      }
      void markOnboardingStep(user.id, "log_session");
      toast.success(updated ? "Session updated" : "Session logged · view history", {
        description: "Click to see all sessions for this plan",
        action: {
          label: "Open",
          onClick: () => {
            navigate({
              to: "/plans/$planId/sessions",
              params: { planId },
              search: { highlight: newId ?? undefined },
            });
          },
        },
      });
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  if (!plan.weeks.length) {
    return <p className="text-sm text-muted-foreground">Add weeks and exercises in Edit mode first.</p>;
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mb-4 sm:-mb-6 lg:-mb-8 bg-background px-4 sm:px-6 lg:px-8 pt-3 pb-6 text-foreground">
      {/* Compact single-row picker */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs">
        <span className="rounded-md border border-border bg-secondary px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">Log</span>
        <select
          value={weekNum}
          onChange={(e) => setWeekNum(Number(e.target.value))}
          className="h-7 rounded bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          {plan.weeks.map((w) => <option key={w.week_number} value={w.week_number}>Week {w.week_number}</option>)}
        </select>
        <select
          value={dayLabel}
          onChange={(e) => setDayLabel(e.target.value)}
          className="h-7 rounded bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          {(week?.days ?? []).map((d) => <option key={d.day_label} value={d.day_label}>{d.day_label}{d.focus ? ` · ${d.focus}` : ""}</option>)}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-7 rounded bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <Link
          to="/plans/$planId/sessions"
          params={{ planId }}
          search={{ highlight: undefined }}
          className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <History className="h-3 w-3" /> History ({safeSessions.length})
        </Link>
      </div>
      {lastSession && !editingSessionId && (
        <div className="-mt-1 mb-2 flex items-center justify-between gap-2 rounded-md border border-dashed border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <span>
            Última sessão deste dia: <span className="font-mono text-foreground/80">{lastSession.session_date}</span>
          </span>
          <button
            type="button"
            onClick={duplicateLast}
            className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground hover:bg-secondary/70"
          >
            <RotateCcw className="h-3 w-3" /> Duplicar
          </button>
        </div>
      )}
      <div className="-mt-1 mb-3 flex items-center gap-2 px-1 text-[10px] uppercase tracking-widest">
        {editingSessionId ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Editando sessão de {date}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            Nova sessão
          </span>
        )}
      </div>

      {/* Exercise cards */}
      <div className="space-y-2">
        {entries.length === 0 && <p className="text-sm text-foreground0">No exercises in this day.</p>}
        {entries.map((e, i) => (
          <div key={i} className="rounded-md bg-card p-2.5">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h3 className="text-base font-bold tracking-tight text-foreground inline-flex items-center gap-1.5">
                {e.exercise_name || <span className="text-foreground0">(unnamed)</span>}
                {e.exercise_name && (
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(e.exercise_name + " exercise technique")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Watch demo on YouTube"
                    className="text-muted-foreground hover:text-accent"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                  </a>
                )}
              </h3>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-accent">
                Planned · {e.planned.sets || "—"} × {e.planned.reps || "—"} · {e.planned.rest || "—"}
                {e.planned.rpe ? ` · RPE ${e.planned.rpe}` : ""}
                {e.planned.tempo ? ` · Tempo ${e.planned.tempo}` : ""}
              </span>
            </div>
            {e.planned.technique_cues && (
              <p className="mb-1 text-[11px] italic text-muted-foreground/80">{e.planned.technique_cues}</p>
            )}
            {e.planned.notes && (
              <p className="mb-1.5 text-[11px] italic text-accent/70">{e.planned.notes}</p>
            )}

            {/* Per-set rows */}
            <div className="mb-1 grid grid-cols-[1.75rem_1fr_1fr_1.25rem] gap-1.5 px-0.5 text-[9px] font-bold uppercase tracking-widest text-foreground">
              <span className="text-foreground0">Set</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Weight (kg)</span>
              <span />
            </div>
            <div className="space-y-1.5">
              {e.sets.map((st, si) => {
                const ghost = lastByName.get(e.exercise_name)?.[si];
                const ghostReps = !st.reps && ghost?.reps ? ghost.reps : "";
                const ghostKg = !st.weight && ghost?.weight ? ghost.weight : "";
                return (
                  <div
                    key={si}
                    className={`grid grid-cols-[1.75rem_1fr_1fr_1.25rem] items-center gap-1.5 rounded transition-all ${
                      rewards[`${i}-${si}`] ? "animate-scale-in bg-accent/15 ring-1 ring-accent/40" : ""
                    }`}
                  >
                    <span className="text-center text-xs font-bold text-foreground0">
                      {rewards[`${i}-${si}`] ? <Heart className="mx-auto h-3.5 w-3.5 fill-accent text-accent" /> : si + 1}
                    </span>
                    {/* Reps stepper */}
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => bumpReps(i, si, -1)} aria-label="−1 rep"
                        className="h-8 w-8 shrink-0 rounded-md border border-border bg-secondary text-foreground active:scale-95 hover:bg-secondary/70 inline-flex items-center justify-center">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        inputMode="numeric"
                        value={st.reps}
                        onChange={(ev) => updateSet(i, si, "reps", ev.target.value)}
                        placeholder={ghostReps || e.planned.reps || "—"}
                        className={`h-8 w-full rounded bg-secondary px-1 text-center text-sm font-mono text-foreground outline-none focus:ring-1 focus:ring-ring ${!st.reps && ghostReps ? "placeholder:text-foreground/40 placeholder:italic" : "placeholder:text-muted-foreground/50"}`}
                      />
                      <button type="button" onClick={() => bumpReps(i, si, 1)} aria-label="+1 rep"
                        className="h-8 w-8 shrink-0 rounded-md border border-border bg-secondary text-foreground active:scale-95 hover:bg-secondary/70 inline-flex items-center justify-center">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* Weight stepper */}
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => bumpWeight(i, si, -2.5)} aria-label="−2.5 kg"
                        className="h-8 w-8 shrink-0 rounded-md border border-border bg-secondary text-foreground active:scale-95 hover:bg-secondary/70 inline-flex items-center justify-center">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        inputMode="decimal"
                        value={st.weight}
                        onChange={(ev) => updateSet(i, si, "weight", ev.target.value)}
                        placeholder={ghostKg || "kg"}
                        className={`h-8 w-full rounded bg-secondary px-1 text-center text-sm font-mono text-foreground outline-none focus:ring-1 focus:ring-ring ${!st.weight && ghostKg ? "placeholder:text-foreground/40 placeholder:italic" : "placeholder:text-muted-foreground/50"}`}
                      />
                      <button type="button" onClick={() => bumpWeight(i, si, 2.5)} aria-label="+2.5 kg"
                        className="h-8 w-8 shrink-0 rounded-md border border-border bg-secondary text-foreground active:scale-95 hover:bg-secondary/70 inline-flex items-center justify-center">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeSet(i, si)}
                      className="text-muted-foreground/50 hover:text-foreground"
                      aria-label="Remove set"
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={() => addSet(i)}
                type="button"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent"
              >
                <Plus className="h-3 w-3" /> Add set
              </button>
              <input
                value={e.notes}
                onChange={(ev) => updateExNotes(i, ev.target.value)}
                placeholder="Notes…"
                className="h-6 flex-1 rounded bg-transparent px-1 text-xs text-foreground/90 placeholder:text-muted-foreground/50 outline-none focus:bg-secondary"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Session notes */}
      <div className="mt-3">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Session notes — how did it feel?"
          className="h-8 w-full rounded bg-card px-2.5 text-xs text-foreground placeholder:text-foreground0 outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Action bar */}
      <div className="sticky bottom-2 mt-3 flex items-center justify-end gap-2 rounded-md bg-card/95 p-2 backdrop-blur">
        <button
          type="button"
          onClick={() => void onExportPdf()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-foreground transition hover:bg-secondary"
        >
          <Download className="h-3.5 w-3.5" /> Export PDF
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || entries.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save session"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Regenerate with feedback — closes the loop between trainer judgement and AI.
// ---------------------------------------------------------------------------
function RegenerateWithFeedbackDialog({
  planId,
  clientId,
  assessmentId,
  durationWeeks,
  previousPlan,
  onRegenerated,
  isPhasedComplete,
}: {
  planId: string;
  clientId: string;
  assessmentId: string | null;
  durationWeeks: number;
  previousPlan: { title: string; summary: string | null; weeks: Week[] };
  onRegenerated: (plan: { title?: string; summary?: string; weeks?: Week[] }) => void;
  isPhasedComplete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; phase: "idle" | "context" | "weeks" | "saving" | "done" }>(
    { done: 0, total: 0, phase: "idle" },
  );
  const generateWeekFn = useServerFn(generatePlanWeek);
  const persistFn = useServerFn(persistRegeneratedPlan);
  const proposeProgressionsFn = useServerFn(proposeProgressions);
  const bulkFillFn = useServerFn(bulkFillRemainingWeeks);
  const constraintsFn = useServerFn(getPlanConstraints);
  const constraintsQ = useQuery({
    queryKey: ["plan-constraints", planId],
    queryFn: () => constraintsFn({ data: { plan_id: planId } }),
    enabled: open,
    staleTime: 60_000,
  });
  const constraints = constraintsQ.data?.ok ? constraintsQ.data : null;
  const tierTone = constraints?.tier === "advanced"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
    : constraints?.tier === "remedial"
      ? "border-blue-500/40 bg-blue-500/10 text-blue-200"
      : "border-amber-500/40 bg-amber-500/10 text-amber-200";
  const tierLabel = constraints?.tier === "advanced"
    ? "🟢 Avançado"
    : constraints?.tier === "remedial"
      ? "🔵 Remedial"
      : "🟡 Conservador";

  const submit = async () => {
    if (!feedback.trim()) {
      toast.error("Write what you want changed.");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: durationWeeks, phase: "context" });
    try {
      // Pull client + assessment + stored programming_variables for context.
      const { data: client, error: clientErr } = await supabase
        .from("clients").select("*").eq("id", clientId).single();
      if (clientErr || !client) throw new Error(clientErr?.message ?? "Client not found");

      let assessment: any = null;
      if (assessmentId) {
        const { data: a } = await supabase.from("assessments").select("*").eq("id", assessmentId).single();
        assessment = a;
      } else {
        const { data: a } = await supabase
          .from("assessments").select("*").eq("client_id", clientId)
          .order("updated_at", { ascending: false }).limit(1).maybeSingle();
        assessment = a;
      }
      if (!assessment) throw new Error("No assessment found for this client.");

      // Read stored programming_variables (Cockpit) so the regen honours the
      // ceiling the trainer set. Free-text feedback overrides ("rpe 6.5") are
      // parsed deterministically and pisam o stored.
      const { data: planRow } = await supabase
        .from("workout_plans")
        .select("programming_variables")
        .eq("id", planId)
        .maybeSingle();
      const storedPv = (planRow?.programming_variables ?? null) as Record<string, any> | null;
      const override = parseRpeOverrideFromFeedback(feedback);
      const resolvedPv = {
        ...(storedPv ?? {}),
        ...(override ?? {}),
      };

      const skeleton = {
        title: previousPlan.title ?? null,
        summary: previousPlan.summary ?? null,
        weeks: (previousPlan.weeks ?? []).map((w) => ({
          week_number: w.week_number,
          focus: w.focus ?? null,
          rationale: w.rationale ?? null,
          days: (w.days ?? []).map((d) => ({
            day_label: d.day_label,
            focus: d.focus ?? null,
            rationale: d.rationale ?? null,
          })),
        })),
      };

      setProgress({ done: 0, total: durationWeeks, phase: "weeks" });
      const clientPayload = {
        full_name: client?.full_name ?? "Client",
        age: client.age,
        sex: client.sex,
        height_cm: client.height_cm ? Number(client.height_cm) : null,
        weight_kg: client.weight_kg ? Number(client.weight_kg) : null,
      };

      // R74 — Honour the rule "AI gera no máximo 1 microciclo". Generate ONLY
      // Week 1 with the AI; weeks 2..N are produced deterministically by
      // Stage 4 (Bompa wave + NSCA increments) + Stage 5 (clone W1 + apply
      // deltas). The previous parallel POOL=3 fan-out let the model pick
      // different exercises per week, which the table flagged as "(swapped)".
      const w1 = await generateWeekFn({
        data: {
          plan_id: planId,
          client_id: clientId,
          client: clientPayload,
          assessment: { ...assessment, secondary_goals: null },
          duration_weeks: durationWeeks,
          week_number: 1,
          trainer_feedback: feedback.trim(),
          previous_plan: skeleton,
          programming_variables: resolvedPv,
        },
      });
      if (!w1.ok) {
        if ((w1 as any).billingRequired) {
          window.location.href = "/billing";
          return;
        }
        throw new Error(`Week 1: ${(w1 as any).error}`);
      }
      setProgress((p) => ({ ...p, done: 1 }));
      const newWeeks = [w1.week];
      const newTitle = w1.title || previousPlan.title;
      const newSummary = w1.summary || previousPlan.summary;

      setProgress((p) => ({ ...p, phase: "saving" }));
      // C1 — call the canonical writer. For phased-complete plans this
      // wipes + re-inserts every workout_plan_days row (the real source of
      // truth) so the realtime subscription cannot snap us back to stale
      // content. For legacy plans (no day rows) the write of plan_data still
      // takes effect via the same RPC.
      const persistRes = await persistFn({
        data: {
          planId,
          title: newTitle,
          summary: newSummary,
          weeks: newWeeks as any,
          programming_variables: resolvedPv as any,
          trainer_feedback: feedback.trim(),
        },
      });
      if (!persistRes.ok) throw new Error(persistRes.error);

      // R74 — Stage 4 + Stage 5: deterministic progression + bulk-fill of
      // weeks 2..N from the freshly inserted Week 1. Skipped when the plan is
      // a single week (nothing to fill). Failures are surfaced as warnings
      // because Week 1 is already persisted and usable on its own.
      if (durationWeeks > 1) {
        const prog = await proposeProgressionsFn({ data: { planId } });
        if (!prog.ok) {
          toast.warning(`Week 1 saved, but progression failed: ${(prog as any).error ?? "unknown"}`);
        } else {
          const bulk = await bulkFillFn({ data: { planId } });
          if (!bulk.ok) {
            toast.warning(`Week 1 saved, but bulk-fill failed: ${(bulk as any).error ?? "unknown"}`);
          }
        }
      }

      onRegenerated({ title: newTitle, summary: newSummary, weeks: newWeeks });
      setProgress((p) => ({ ...p, phase: "done" }));
      const totalEx = newWeeks.reduce(
        (acc: number, w: any) =>
          acc + (w.days ?? []).reduce((a: number, d: any) => a + (d.exercises ?? []).length, 0),
        0,
      );
      const cockpitNote = override?.rpe_ceiling
        ? ` · RPE cap ${override.rpe_ceiling} (do feedback)`
        : storedPv?.rpe_ceiling
          ? ` · RPE cap ${storedPv.rpe_ceiling} (Cockpit)`
          : "";
      toast.success("Plan regenerated", {
        description: `Semana 1 (AI) + ${Math.max(0, durationWeeks - 1)} semanas determinísticas (Bompa wave) · ${totalEx} exercícios em W1${cockpitNote}.`,
      });
      setFeedback("");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Regeneration failed");
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0, phase: "idle" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Regenerate (Cockpit-aware)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regenerate with feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Tell the AI what to change. Be specific — reference week, day, exercise or rationale. The current plan will be overwritten.
          </p>
          {constraintsQ.isLoading && (
            <div className="space-y-1.5">
              <div className="h-6 animate-pulse rounded-md bg-muted/40" />
              <div className="h-6 animate-pulse rounded-md bg-muted/40" />
            </div>
          )}
          {constraints && (
            <div className="space-y-1.5">
              <div
                className={`flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${tierTone}`}
                title={constraints.reasons.join(" · ")}
              >
                <span className="font-semibold uppercase tracking-widest">Tier</span>
                <span>{tierLabel}</span>
                <span className="text-foreground/70">· {constraints.reasons.join(" · ")}</span>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-widest text-foreground/80">RPE mín</span>
                {" — "}
                Main {constraints.rpeFloors.main} · Acessórios {constraints.rpeFloors.accessory} · Carries {constraints.rpeFloors.carry}
              </div>
            </div>
          )}
          <Label htmlFor="regen-fb" className="text-xs uppercase tracking-widest text-muted-foreground">
            Your corrections
          </Label>
          <AutoTextarea
            id="regen-fb"
            minRows={5}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={`E.g. "Week 2 Day 3: drop back squat — client reports knee discomfort. Replace with goblet squat or split squat. Cap RPE at 7 for all squat patterns."`}
          />
          <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[11px] text-muted-foreground space-y-1">
            <p>
              Wave-loading periodisation is auto-injected (W1 base → W2 +volume → W3 +intensity → W4 deload, anchored by training age). Your feedback can shift the anchor but cannot flatten the wave — that&apos;s the program working.
            </p>
            <p>
              Older sessions stay archived under this plan so your logging history isn&apos;t lost.
            </p>
          </div>
          {busy && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>
                {progress.phase === "context" && "Reading client + assessment + Cockpit…"}
                {progress.phase === "weeks" && `Generating weeks ${progress.done}/${progress.total} (parallel)…`}
                {progress.phase === "saving" && "Saving new plan + archiving old sessions…"}
                {progress.phase === "done" && "Done."}
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !feedback.trim()}>
            {busy ? "Regenerating…" : "Regenerate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * CapacityGainBlock — renders the "what got better" headline card when this
 * plan is Block N>1 and we have any prior-block sessions in the lineage.
 * Splits the lineage `sessions` array by plan_id (current vs prior) and
 * delegates to <CapacityGainCard />.
 */
function CapacityGainBlock({
  plan, sessions, planId,
}: { plan: any; sessions: SessionRow[]; planId: string }) {
  const block = (plan as any)?.block_number ?? 1;
  if (!plan || block <= 1) return null;
  const priorPlanId = (plan as any)?.prior_plan_id ?? null;
  if (!priorPlanId) return null;
  const current = sessions.filter((s) => (s as any).plan_id === planId);
  const prior = sessions.filter((s) => (s as any).plan_id === priorPlanId);
  if (current.length === 0 && prior.length === 0) return null;
  const summary = computeCapacityGain(prior as any, current as any);
  // Pull the cached block_feedback for adesão / RPE drift.
  const fb = ((plan as any)?.generation_meta?.block_feedback ?? null) as BlockSummary | null;
  return (
    <div className="mb-4">
      <CapacityGainCard
        summary={summary}
        blockNumber={block}
        adherencePct={fb?.adherencePct ?? null}
        rpeDrift={null}
        transitionNote={(plan as any)?.block_transition_summary ?? null}
      />
    </div>
  );
}
