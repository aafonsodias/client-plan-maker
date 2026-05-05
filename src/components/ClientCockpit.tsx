import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Download, Edit3, ChevronRight, Loader2, AlertTriangle, Activity, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ProtocolRail } from "@/components/ProtocolRail";
import { downloadPlanById } from "@/lib/download-plan";
import { toast } from "sonner";
import type { CardPlan, CardLog } from "@/lib/client-card-data";
import { currentWeek } from "@/lib/client-card-data";

const ComplianceDashboard = lazy(() =>
  import("@/components/ComplianceDashboard").then((m) => ({ default: m.ComplianceDashboard }))
);

type Props = {
  clientId: string;
  plan: CardPlan | null;
  logs: CardLog[];
};

/**
 * Read-mode cockpit shown inline under a player card on /dashboard.
 *
 * Layout (top → bottom):
 *   1. ProtocolRail — 5 clickable stages, drives the StagePanel below.
 *   2. StagePanel  — content for the active stage.
 *   3. Plan strip  — title is a Link to /plans/$id; PDF + editor are icon buttons.
 *   4. Signals     — ACSM + Recovery chips, separated from the protocol.
 */
export function ClientCockpit({ clientId, plan, logs }: Props) {
  const { t } = useTranslation("common");
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<any | null>(null);
  const [genState, setGenState] = useState<any | null>(null);
  const [coverage, setCoverage] = useState<{ done: number; total: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [activeStage, setActiveStage] = useState<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [{ data: a }, planRow] = await Promise.all([
        supabase
          .from("assessments")
          .select("id, acsm_risk_category, parq_passed, sleep_quality, stress_level, updated_at, performed_on")
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        plan
          ? supabase.from("workout_plans").select("generation_state, generation_meta").eq("id", plan.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (cancelled) return;
      setAssessment(a ?? null);
      setGenState((planRow as any)?.data ?? null);

      // Pull real coverage if we have an assessment id.
      const aId = (a as any)?.id;
      if (aId) {
        const { data: cov } = await supabase
          .from("assessments")
          .select("section_analyses")
          .eq("id", aId)
          .maybeSingle();
        const analyses = ((cov as any)?.section_analyses ?? {}) as Record<string, unknown>;
        // 14 phased sections (kept in sync with PHASED_SECTIONS server-side)
        const TOTAL = 14;
        const done = Object.values(analyses).filter(Boolean).length;
        setCoverage({ done: Math.min(done, TOTAL), total: TOTAL });
      } else {
        setCoverage(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, plan?.id]);

  const approvedStages: string[] = Array.isArray(genState?.generation_state?.approved_stages)
    ? genState.generation_state.approved_stages
    : [];
  const planComplete = !!plan && plan.generation_status === "complete";
  const briefApproved = approvedStages.includes("brief") || planComplete;
  const blueprintApproved = approvedStages.includes("blueprint") || planComplete;
  const microcycleApproved = approvedStages.includes("microcycle") || planComplete;
  const progressionsApproved = approvedStages.includes("progressions") || planComplete;

  const week = currentWeek(plan, logs) ?? 1;
  const totalWeeks = plan?.duration_weeks ?? null;
  const block = plan?.block_number ?? 1;

  // Real assessment %: from coverage if available, else null.
  const realPct = coverage && coverage.total > 0
    ? Math.round((coverage.done / coverage.total) * 100)
    : null;

  // Pick a sensible default stage when data lands.
  useEffect(() => {
    if (loading) return;
    if (planComplete) setActiveStage(4);
    else if (plan) setActiveStage(2);
    else setActiveStage(1);
  }, [loading, planComplete, plan?.id]);

  // Recovery score
  const sleep = Number(assessment?.sleep_quality);
  const stress = Number(assessment?.stress_level);
  const haveSignals = Number.isFinite(sleep) && sleep > 0;
  const sleepPart = haveSignals ? (sleep / 10) * 50 : 25;
  const stressPart = Number.isFinite(stress) && stress > 0 ? ((11 - stress) / 10) * 30 : 15;
  const sorePart = 10;
  const readiness = Math.round(sleepPart + stressPart + sorePart);

  const risk: string = assessment?.acsm_risk_category ?? "low";
  const riskLabel = risk === "high" ? "Alto" : risk === "moderate" ? "Moderado" : "Baixo";
  const riskTone =
    risk === "high"
      ? "border-red-500/40 bg-red-500/10 text-red-400"
      : risk === "moderate"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  const readyTone =
    readiness >= 75
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
      : readiness >= 50
        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
        : "border-red-500/40 bg-red-500/10 text-red-400";

  const handleDownload = async () => {
    if (!plan) return;
    setDownloading(true);
    try {
      await downloadPlanById(plan.id, week);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const stagePanel = useMemo(() => {
    const linkCls =
      "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary";
    const clientLink = (label: string) => (
      <Link to="/clients/$clientId" params={{ clientId }} className={linkCls}>
        {label} <ArrowRight className="h-3 w-3" />
      </Link>
    );
    const planLink = (label: string) =>
      plan ? (
        <Link to="/plans/$planId" params={{ planId: plan.id }} className={linkCls}>
          {label} <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null;

    if (activeStage === 1) {
      const summary = coverage
        ? t("clients.cockpit.stage.1.summary", { done: coverage.done, total: coverage.total, pct: realPct ?? 0 })
        : "—";
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">{t("clients.cockpit.stage.1.title")}</p>
            <p className="truncate">{summary}</p>
          </div>
          {clientLink(t("clients.cockpit.stage.1.cta"))}
        </div>
      );
    }

    const stageKey = String(activeStage) as "2" | "3" | "4" | "5";
    if (!plan) {
      return (
        <div className="text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{t(`clients.cockpit.stage.${stageKey}.title` as const)}</p>
          <p>{t(`clients.cockpit.stage.${stageKey}.empty` as const)}</p>
        </div>
      );
    }

    if (activeStage === 4) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">{t("clients.cockpit.stage.4.title")}</p>
            {planLink(t("clients.cockpit.stage.4.cta"))}
          </div>
          <Suspense fallback={<div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("actions.loading")}</div>}>
            <ComplianceDashboard clientId={clientId} />
          </Suspense>
        </div>
      );
    }

    let summary: string = t(`clients.cockpit.stage.${stageKey}.summary` as const, { weeks: totalWeeks ?? "—" });
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{t(`clients.cockpit.stage.${stageKey}.title` as const)}</p>
          <p className="truncate">{summary}</p>
        </div>
        {planLink(t(`clients.cockpit.stage.${stageKey}.cta` as const))}
      </div>
    );
  }, [activeStage, plan, coverage, realPct, totalWeeks, t, clientId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("actions.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border bg-secondary/20 px-4 py-4 sm:px-5">
      {/* 1. Protocol rail — drives stage selection */}
      <ProtocolRail
        bare
        assessmentPct={realPct}
        lastAssessmentAt={assessment?.performed_on ?? assessment?.updated_at ?? null}
        briefApproved={briefApproved}
        blueprintApproved={blueprintApproved}
        microcycleApproved={microcycleApproved}
        progressionsApproved={progressionsApproved}
        activeStage={activeStage}
        onStageClick={(n) => setActiveStage(n as 1 | 2 | 3 | 4 | 5)}
      />

      {/* 2. Stage panel */}
      <div className="rounded-xl border border-border bg-card/40 p-3">
        {stagePanel}
      </div>

      {/* 3. Plan strip — title is the primary link, PDF/editor are icon buttons */}
      {plan && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 p-2">
          <Link
            to="/plans/$planId"
            params={{ planId: plan.id }}
            className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-secondary/60 hover:ring-1 hover:ring-amber-500/40"
            title={t("clients.cockpit.open_plan")}
          >
            <ChevronRight className="h-4 w-4 shrink-0 text-amber-400 transition group-hover:translate-x-0.5" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{plan.title ?? t("clients.cockpit.no_title")}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {t("clients.card.block_n", { n: block })} · {t("clients.cockpit.week_x_of_y", { x: week, y: totalWeeks ?? "—" })} · {t("clients.cockpit.open_plan")}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDownload}
              disabled={downloading}
              title={t("clients.cockpit.pdf_tooltip")}
              aria-label={t("clients.cockpit.pdf_tooltip")}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" asChild title={t("clients.cockpit.editor_tooltip")} aria-label={t("clients.cockpit.editor_tooltip")}>
              <Link to="/clients/$clientId" params={{ clientId }}>
                <Edit3 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* 4. Signals — separated from the protocol by a divider */}
      {(assessment || haveSignals) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("clients.cockpit.signals_label")}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${riskTone}`}>
            <AlertTriangle className="h-3 w-3" />
            <span className="text-[9px] uppercase tracking-widest opacity-70">ACSM</span>
            {riskLabel}
          </span>
          {haveSignals && (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums ${readyTone}`}>
              <Activity className="h-3 w-3" />
              <span className="text-[9px] uppercase tracking-widest opacity-70">{t("clients.cockpit.recovery")}</span>
              {readiness}/100
            </span>
          )}
        </div>
      )}
    </div>
  );
}
