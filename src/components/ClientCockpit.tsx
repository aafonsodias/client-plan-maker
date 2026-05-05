import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Download, Edit3, ChevronRight, ChevronDown, Loader2, ArrowRight } from "lucide-react";
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
  const [stageOpen, setStageOpen] = useState(false);
  const [openCompliance, setOpenCompliance] = useState(false);

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

  // Default to stage 1 (assessment), but don't auto-expand the panel —
  // user opens it by clicking a stage chip.
  useEffect(() => {
    if (loading) return;
    if (planComplete) setActiveStage(4);
    else if (plan) setActiveStage(2);
    else setActiveStage(1);
  }, [loading, planComplete, plan?.id]);

  const handleStageClick = (n: number) => {
    const stage = n as 1 | 2 | 3 | 4 | 5;
    if (stageOpen && activeStage === stage) {
      setStageOpen(false);
    } else {
      setActiveStage(stage);
      setStageOpen(true);
    }
  };

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
            <button
              type="button"
              onClick={() => setOpenCompliance((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:text-amber-400"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${openCompliance ? "rotate-0" : "-rotate-90"}`} />
              {t("clients.cockpit.stage.4.title")} · Compliance
            </button>
            {planLink(t("clients.cockpit.stage.4.cta"))}
          </div>
          {openCompliance && (
            <Suspense fallback={<div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("actions.loading")}</div>}>
              <ComplianceDashboard clientId={clientId} />
            </Suspense>
          )}
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
  }, [activeStage, plan, coverage, realPct, totalWeeks, t, clientId, openCompliance]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("actions.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border bg-secondary/20 px-4 py-4 sm:px-5">
      {/* 1. Protocol rail — single compact line */}
      <ProtocolRail
        bare
        assessmentPct={realPct}
        lastAssessmentAt={assessment?.performed_on ?? assessment?.updated_at ?? null}
        briefApproved={briefApproved}
        blueprintApproved={blueprintApproved}
        microcycleApproved={microcycleApproved}
        progressionsApproved={progressionsApproved}
        activeStage={stageOpen ? activeStage : null}
        onStageClick={handleStageClick}
      />

      {/* 2. Plan strip — directly under the protocol */}
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

      {/* 3. Stage panel — collapsed by default, opens on stage click */}
      {stageOpen && (
        <div className="rounded-xl border border-border bg-card/40 p-3">
          <div className="mb-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setStageOpen(false)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-secondary"
              aria-label="Fechar"
            >
              <ChevronDown className="h-3 w-3" /> Fechar
            </button>
          </div>
          {stagePanel}
        </div>
      )}
    </div>
  );
}
