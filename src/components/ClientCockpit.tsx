import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Download, Edit3, BookOpen, RefreshCw, Loader2, AlertTriangle, Activity } from "lucide-react";
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
 * Mirrors the header strip from /clients/$clientId so trainers don't need
 * to leave the list to *check* a client. The detail route stays as the
 * builder/editor surface.
 *
 * Fetches its own auxiliary data (assessment + generation_state) on mount
 * so the dashboard list stays cheap until cards are expanded.
 */
export function ClientCockpit({ clientId, plan, logs }: Props) {
  const { t, i18n } = useTranslation("common");
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<any | null>(null);
  const [genState, setGenState] = useState<any | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [{ data: a }, planRow] = await Promise.all([
        supabase
          .from("assessments")
          .select("acsm_risk_category, parq_passed, sleep_quality, stress_level, updated_at, performed_on")
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        plan
          ? supabase
              .from("workout_plans")
              .select("generation_state")
              .eq("id", plan.id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (cancelled) return;
      setAssessment(a ?? null);
      setGenState((planRow as any)?.data?.generation_state ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, plan?.id]);

  const approvedStages: string[] = Array.isArray(genState?.approved_stages) ? genState.approved_stages : [];
  const briefApproved = approvedStages.includes("brief");
  const blueprintApproved = approvedStages.includes("blueprint");
  const microcycleApproved = approvedStages.includes("microcycle");
  const progressionsApproved = approvedStages.includes("progressions");

  const week = currentWeek(plan, logs) ?? 1;
  const totalWeeks = plan?.duration_weeks ?? null;
  const block = plan?.block_number ?? 1;

  // Recovery score (sleep 50%, stress 30%, soreness 20%) — same formula as detail page.
  const sleep = Number(assessment?.sleep_quality);
  const stress = Number(assessment?.stress_level);
  const sore = 0; // soreness not stored on assessments; recovery falls back to neutral
  const haveSignals = Number.isFinite(sleep) && sleep > 0;
  const sleepPart = haveSignals ? (sleep / 10) * 50 : 25;
  const stressPart = Number.isFinite(stress) && stress > 0 ? ((11 - stress) / 10) * 30 : 15;
  const sorePart = Number.isFinite(sore) && sore > 0 ? ((11 - sore) / 10) * 20 : 10;
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("actions.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border bg-secondary/20 px-4 py-4 sm:px-5">
      {/* Readiness chips */}
      {(assessment || haveSignals) && (
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Protocol rail (read-only — chips reflect approvals, no expand handlers) */}
      <ProtocolRail
        bare
        assessmentPct={null}
        lastAssessmentAt={assessment?.performed_on ?? assessment?.updated_at ?? null}
        briefApproved={briefApproved}
        blueprintApproved={blueprintApproved}
        microcycleApproved={microcycleApproved}
        progressionsApproved={progressionsApproved}
      />

      {/* Plan header strip */}
      {plan && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{plan.title ?? t("clients.cockpit.no_title")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("clients.card.block_n", { n: block })} · {t("clients.cockpit.week_x_of_y", { x: week, y: totalWeeks ?? "—" })}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
            {t("clients.cockpit.pdf")}
          </Button>
        </div>
      )}

      {/* Compliance — lazy, only when there's a plan to compare against */}
      {plan && (
        <div className="overflow-hidden rounded-xl border border-border bg-card/40 p-3">
          <Suspense fallback={<div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("actions.loading")}</div>}>
            <ComplianceDashboard clientId={clientId} />
          </Suspense>
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" asChild>
          <Link to="/clients/$clientId/year" params={{ clientId }}>
            <BookOpen className="mr-1.5 h-3.5 w-3.5" /> {t("clients.cockpit.open_logbook")}
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/clients/$clientId" params={{ clientId }}>
            <Edit3 className="mr-1.5 h-3.5 w-3.5" /> {t("clients.cockpit.open_editor")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
