import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { BriefSchema, type Brief } from "@/server/phased/schemas";
import {
  AlertTriangle,
  Target,
  Activity,
  Dumbbell,
  Calendar,
  ChevronDown,
  Loader2,
  ArrowLeft,
} from "lucide-react";

type Props = { planId: string };

const GOAL_LABEL: Record<string, string> = {
  hypertrophy: "Hipertrofia",
  strength: "Força",
  conditioning: "Condicionamento",
  mixed: "Misto",
  fat_loss: "Perda de gordura",
  general: "Geral",
};

const AGE_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermédio",
  advanced: "Avançado",
};

export function BriefContextRail({ planId }: Props) {
  const { t } = useTranslation("plan");
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const { data, error: dbErr } = await supabase
        .from("workout_plans")
        .select("brief")
        .eq("id", planId)
        .maybeSingle();
      if (cancelled) return;
      if (dbErr || !data) {
        setError(t("briefRail.load_error"));
        setLoading(false);
        return;
      }
      const parsed = BriefSchema.safeParse((data as any).brief);
      if (!parsed.success) {
        setError(t("briefRail.invalid"));
        setLoading(false);
        return;
      }
      setBrief(parsed.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, t]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="inline h-3 w-3 animate-spin" /> {t("briefRail.loading")}
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{error ?? t("briefRail.unavailable")}</p>
        <Link
          to="/plans/$planId/brief"
          params={{ planId }}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> {t("briefRail.open_brief")}
        </Link>
      </div>
    );
  }

  const totalEmph =
    (brief.emphasis_split?.upper ?? 0) +
    (brief.emphasis_split?.lower ?? 0) +
    (brief.emphasis_split?.conditioning ?? 0);
  const pct = (n: number) =>
    totalEmph > 0 ? `${Math.round((n / totalEmph) * 100)}%` : "—";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("briefRail.approved")}
          </h3>
          <Link
            to="/plans/$planId/brief"
            params={{ planId }}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            {t("briefRail.view")}
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("briefRail.context_caption")}
        </p>
      </div>

      {/* Objetivos */}
      <Section icon={<Target className="h-3.5 w-3.5" />} title={t("briefRail.objectives")}>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
              {GOAL_LABEL[brief.primary_goal] ?? brief.primary_goal}
            </span>
            <span className="text-xs text-muted-foreground">{t("briefRail.primary")}</span>
          </div>
          {brief.secondary_goals.length > 0 && (
            <ul className="space-y-0.5 pl-1 text-xs text-muted-foreground">
              {brief.secondary_goals.slice(0, 5).map((g, i) => (
                <li key={i}>· {g}</li>
              ))}
            </ul>
          )}
          <div className="pt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{AGE_LABEL[brief.training_age_band] ?? brief.training_age_band}</span>
            {brief.current_capacity_vs_pb != null && (
              <> · {t("briefRail.capacity_vs_pb")} <span className="font-medium text-foreground">{brief.current_capacity_vs_pb}/10</span></>
            )}
          </div>
        </div>
      </Section>

      {/* Sinais de alerta */}
      {brief.red_flags.length > 0 && (
        <Section
          icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          title={`${t("briefRail.red_flags")} · ${brief.red_flags.length}`}
          tone="warn"
        >
          <ul className="space-y-1 text-sm">
            {brief.red_flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span className="text-foreground/90">{flag}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Movimento */}
      <Section icon={<Activity className="h-3.5 w-3.5" />} title={t("briefRail.movement")}>
        <dl className="space-y-1 text-xs">
          {(["squat", "hinge", "push", "pull", "lunge", "carry"] as const).map((k) => {
            const v = brief.movement_competency_summary?.[k];
            if (!v) return null;
            return (
              <div key={k} className="grid grid-cols-[60px_1fr] gap-2">
                <dt className="font-medium uppercase tracking-wider text-muted-foreground">{k}</dt>
                <dd className="text-foreground/90">{v}</dd>
              </div>
            );
          })}
        </dl>
      </Section>

      {/* Equipamento e frequência */}
      <Section icon={<Dumbbell className="h-3.5 w-3.5" />} title={t("briefRail.equipment_freq")}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{t("briefRail.sessions_per_week")}</span>
            <span className="font-semibold text-foreground">{brief.sessions_per_week.recommended}</span>
            <span className="text-muted-foreground">
              ({brief.sessions_per_week.min}–{brief.sessions_per_week.max})
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("briefRail.mesocycle")} <span className="font-semibold text-foreground">{brief.mesocycle_length_weeks} {t("briefRail.weeks")}</span>
          </div>
          {brief.equipment_constraints.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {brief.equipment_constraints.map((eq, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {eq}
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Ênfase */}
      <Section icon={<Target className="h-3.5 w-3.5" />} title={t("briefRail.emphasis")}>
        <div className="space-y-1.5 text-xs">
          <Bar label={t("briefRail.emphasis_upper")} pct={pct(brief.emphasis_split?.upper ?? 0)} value={brief.emphasis_split?.upper ?? 0} total={totalEmph} />
          <Bar label={t("briefRail.emphasis_lower")} pct={pct(brief.emphasis_split?.lower ?? 0)} value={brief.emphasis_split?.lower ?? 0} total={totalEmph} />
          <Bar label={t("briefRail.emphasis_cond")} pct={pct(brief.emphasis_split?.conditioning ?? 0)} value={brief.emphasis_split?.conditioning ?? 0} total={totalEmph} />
        </div>
      </Section>

      {/* Notas para próxima stage */}
      {brief.notes_for_next_stage && (
        <Section icon={<ChevronDown className="h-3.5 w-3.5" />} title={t("briefRail.stage_notes")}>
          <p className="whitespace-pre-wrap text-xs text-foreground/80">{brief.notes_for_next_stage}</p>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  tone?: "warn";
}) {
  const border = tone === "warn" ? "border-amber-500/40" : "border-border";
  return (
    <div className={`rounded-xl border ${border} bg-card p-3.5`}>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Bar({ label, pct, value, total }: { label: string; pct: string; value: number; total: number }) {
  const widthPct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium text-foreground">{pct}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-accent transition-all" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

/** Mobile-friendly collapsible wrapper. Use this above the main content on small screens. */
export function BriefContextRailMobile({ planId }: { planId: string }) {
  const { t } = useTranslation("plan");
  return (
    <details className="lg:hidden mb-3 rounded-xl border border-border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Target className="h-4 w-4" /> {t("briefRail.rail_title")}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="p-3 pt-0">
        <BriefContextRail planId={planId} />
      </div>
    </details>
  );
}
