import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Inbox, ClipboardList, Sparkles, Cake, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ClientAvatar } from "@/components/ClientAvatar";
import { ClientPhasePill } from "@/components/ClientPhasePill";
import { ClientPhase } from "@/lib/client-phase";
import { getTierFromYears, type TierMeta } from "@/lib/training-tier";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toneDot } from "@/lib/status-tone";
import {
  CardPlan, CardLog, planFocus, currentWeek, daysSinceLog, formatRelativeDays,
} from "@/lib/client-card-data";
import { clientNextAction } from "@/lib/client-next-action";

type Props = {
  client: {
    id: string;
    full_name: string;
    email: string | null;
    photo_url: string | null;
    intake_status?: string;
    assessment_completion?: number | null;
    date_of_birth?: string | null;
  };
  phase: ClientPhase | undefined;
  plan: CardPlan | null;
  logs: CardLog[];
  onDelete: () => void;
  flagged?: boolean;
};

export function ClientPlayerCard({ client, phase, plan, logs, onDelete, flagged = false }: Props) {
  const { t, i18n } = useTranslation("common");
  const lang = i18n.language === "pt" ? "pt" : "en";
  const [signals, setSignals] = useState<{ risk: string | null; readiness: number | null; tier: TierMeta | null }>({ risk: null, readiness: null, tier: null });

  // Tiny lightweight fetch for the inline ACSM/Recovery chips. Single row, cheap.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("assessments")
        .select("acsm_risk_category, sleep_quality, stress_level, years_training")
        .eq("client_id", client.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const sleep = Number((data as any).sleep_quality);
      const stress = Number((data as any).stress_level);
      const haveSleep = Number.isFinite(sleep) && sleep > 0;
      let readiness: number | null = null;
      if (haveSleep) {
        const sleepPart = (sleep / 10) * 50;
        const stressPart = Number.isFinite(stress) && stress > 0 ? ((11 - stress) / 10) * 30 : 15;
        readiness = Math.round(sleepPart + stressPart + 10);
      }
      const yearsRaw = (data as any).years_training;
      const years = yearsRaw == null ? null : Number(yearsRaw);
      const tier = years != null && Number.isFinite(years) ? getTierFromYears(years) : null;
      setSignals({ risk: (data as any).acsm_risk_category ?? null, readiness, tier });
    })();
    return () => { cancelled = true; };
  }, [client.id]);

  const focus = planFocus(plan);
  const week = currentWeek(plan, logs);
  const block = plan?.block_number ?? null;
  const lastLog = logs.length > 0 ? logs[0] : null;
  const days = daysSinceLog(lastLog);

  // Coarse protocol-stage hint inferred from data we already have on the card
  // (no extra fetches). Honest about limits: we can pinpoint stage 1, 2, and 5
  // exactly; anything in between collapses to "em produção".
  const assessmentPct = client.assessment_completion ?? 0;
  const protocolStage: { n: number | null; label: string; tone: "muted" | "amber" | "emerald" } =
    plan?.generation_status === "complete"
      ? { n: 5, label: "Pronto", tone: "emerald" }
      : plan
        ? { n: null, label: "Em produção", tone: "amber" }
        : assessmentPct >= 80
          ? { n: 2, label: "Briefing", tone: "amber" }
          : { n: 1, label: "Avaliação", tone: "muted" };

  const nextAction = clientNextAction({
    id: client.id,
    intake_status: client.intake_status ?? "not_sent",
    assessment_completion: client.assessment_completion ?? 0,
    date_of_birth: client.date_of_birth ?? null,
    has_plan: Boolean(plan),
  });
  const ActionIcon = nextAction
    ? nextAction.kind === "review"
      ? Inbox
      : nextAction.kind === "complete"
        ? ClipboardList
        : nextAction.kind === "generate"
          ? Sparkles
          : Cake
    : null;

  // Status line (line 3): chooses one of a few honest states.
  let statusText: string | null = null;
  let statusTone: "success" | "neutral" | "warn" = "neutral";

  if (phase?.kind === "ended") {
    statusText = t("clients.card.block_ended");
    statusTone = "warn";
  } else if (phase?.kind === "idle") {
    statusText = t("clients.card.idle_days", { n: phase.daysSince });
    statusTone = "warn";
  } else if (plan && !lastLog) {
    statusText = t("clients.card.plan_ready");
    statusTone = "success";
  } else if (plan && lastLog) {
    statusText = t("clients.card.last_log", { when: formatRelativeDays(days, lang) });
    statusTone = days <= 7 ? "success" : days <= 14 ? "neutral" : "warn";
  } else if (!plan) {
    statusText = phase?.kind === "ready"
      ? t("clients.card.ready_to_build")
      : t("clients.card.intake_pending");
    statusTone = phase?.kind === "ready" ? "success" : "neutral";
  }

  // Line 2: block · week · focus (only when there's a plan)
  let blockLine: string | null = null;
  if (plan && block !== null && week !== null) {
    const parts: string[] = [
      t("clients.card.block_n", { n: block }),
      t("clients.card.week_n", { n: week }),
    ];
    if (focus) parts.push(focus);
    blockLine = parts.join(" · ");
  }

  return (
    <div
      className={`group relative border-b border-border/50 last:border-b-0 ${
        flagged ? "border-l-2 border-l-amber-500/60" : ""
      }`}
    >
      <div className="flex items-stretch hover:bg-muted/60">
      <Link
        to="/clients/$clientId"
        params={{ clientId: client.id }}
        className="flex flex-1 items-center gap-3 px-3 py-3 text-left sm:gap-4 sm:px-5 sm:py-4"
      >
        <ClientAvatar name={client.full_name} photoUrl={client.photo_url} size={40} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="break-words text-sm font-semibold sm:text-base">{client.full_name}</p>
            {phase && (
              <span className="inline-flex">
                <ClientPhasePill phase={phase} />
              </span>
            )}
          </div>
          {blockLine && (
            <p className="truncate text-xs text-muted-foreground sm:text-sm">{blockLine}</p>
          )}
          {(signals.risk || signals.readiness != null) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {signals.risk && (
                <span
                  className="inline-flex items-center gap-1.5"
                  title={`ACSM ${signals.risk} CVD risk`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      signals.risk === "high"
                        ? "bg-red-500"
                        : signals.risk === "moderate"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                  />
                  {signals.risk === "high"
                    ? t("clients.card.cvd_high", { defaultValue: "High CVD risk" })
                    : signals.risk === "moderate"
                      ? t("clients.card.cvd_mod", { defaultValue: "Mod CVD risk" })
                      : t("clients.card.cvd_low", { defaultValue: "Low CVD risk" })}
                </span>
              )}
              {signals.readiness != null && (
                <span
                  className="inline-flex items-center gap-1.5 tabular-nums"
                  title={t("clients.cockpit.recovery")}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      signals.readiness >= 75
                        ? "bg-emerald-500"
                        : signals.readiness >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                  />
                  {t("clients.card.recovery_pct", { defaultValue: "Recovery {{n}}%", n: signals.readiness })}
                </span>
              )}
            </div>
          )}
          {statusText && (
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot(statusTone)}`} />
              {statusText}
            </p>
          )}
          {!blockLine && !statusText && (
            <p className="truncate text-xs text-muted-foreground">{client.email ?? t("clients.no_email")}</p>
          )}
        </div>
        <span
          className={[
            "ml-2 hidden shrink-0 self-center items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums sm:inline-flex",
            protocolStage.tone === "emerald"
              ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400"
              : protocolStage.tone === "amber"
                ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-300"
                : "border-border bg-background text-muted-foreground",
          ].join(" ")}
          title={`Protocolo · ${protocolStage.label}`}
        >
          {protocolStage.n != null && <span className="opacity-70">{protocolStage.n}/5</span>}
          <span>{protocolStage.label}</span>
        </span>
      </Link>
      {nextAction && (
        nextAction.target.type === "client" ? (
          <Link
            to="/clients/$clientId"
            params={{ clientId: nextAction.target.clientId }}
            className="hidden self-center mr-1 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-amber-700 opacity-0 transition hover:bg-amber-500/10 group-hover:opacity-100 focus:opacity-100 sm:inline-flex dark:text-amber-400"
            onClick={(e) => e.stopPropagation()}
          >
            {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
            <span>{t(nextAction.ctaKey)}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link
            to="/plans/new"
            search={{ clientId: nextAction.target.clientId }}
            className="hidden self-center mr-1 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-amber-700 opacity-0 transition hover:bg-amber-500/10 group-hover:opacity-100 focus:opacity-100 sm:inline-flex dark:text-amber-400"
            onClick={(e) => e.stopPropagation()}
          >
            {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
            <span>{t(nextAction.ctaKey)}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        )
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="mr-3 self-center rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
            aria-label={t("clients.delete_aria")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clients.delete_title", { name: client.full_name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("clients.delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("clients.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("clients.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}