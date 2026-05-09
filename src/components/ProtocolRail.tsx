import { Check, Circle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Permanent 5-stage protocol rail. Always visible on the client page so the
 * journey reads as a single continuous spine — even after every stage is
 * approved. Compact one-row chips: number · label · check/circle.
 *
 * Stage 1 (Avaliação) gets a "next due" hint computed = lastAssessmentAt +
 * 14 days. We render purely from props so this stays a dumb presentational
 * component and zero new queries are added.
 */
export function ProtocolRail({
  assessmentPct,
  assessmentCoverage,
  lastAssessmentAt,
  briefApproved,
  blueprintApproved,
  microcycleApproved,
  progressionsApproved,
  intervalDays = 14,
  onReassessClick,
  onStage1Click,
  onShowSynthesis,
  stage1Expanded = false,
  bare = false,
  activeStage,
  onStageClick,
}: {
  assessmentPct: number | null;
  /** Optional fine-grained section coverage (e.g. 11/14). Renders inline on the stage 1 chip. */
  assessmentCoverage?: { done: number; total: number } | null;
  lastAssessmentAt: string | null;
  briefApproved: boolean;
  blueprintApproved: boolean;
  microcycleApproved: boolean;
  progressionsApproved: boolean;
  intervalDays?: number;
  onReassessClick?: () => void;
  /** Click handler for the Stage 1 chip — expands/collapses the assessment editor below. */
  onStage1Click?: () => void;
  /** When set and stage 1 is complete, renders a "synthesis" chip next to it. */
  onShowSynthesis?: () => void;
  stage1Expanded?: boolean;
  /** When true, renders without its own card chrome (used when embedded inside another card). */
  bare?: boolean;
  /** Currently active stage (1-5). Highlighted with amber ring. */
  activeStage?: number | null;
  /** When provided, every stage chip becomes a button that calls this. Stage 1 still defers to onStage1Click if set. */
  onStageClick?: (n: number) => void;
}) {
  const { t } = useTranslation("plan");
  const stage1Done = (assessmentPct ?? 0) >= 80;
  const stages = [
    { n: 1, label: t("stage.label.1", { defaultValue: "Avaliação" }), done: stage1Done },
    { n: 2, label: t("stage.label.2", { defaultValue: "Briefing" }), done: briefApproved },
    { n: 3, label: t("stage.label.3", { defaultValue: "Plano-mestre" }), done: blueprintApproved },
    { n: 4, label: t("stage.label.4", { defaultValue: "Semana-tipo" }), done: microcycleApproved },
    { n: 5, label: t("stage.label.5", { defaultValue: "Progressão" }), done: progressionsApproved },
  ];

  // Compute next-due chip for stage 1.
  let nextDueChip: { label: string; tone: "ok" | "soon" | "due" } | null = null;
  if (stage1Done && lastAssessmentAt) {
    const last = new Date(lastAssessmentAt).getTime();
    const due = last + intervalDays * 86400000;
    const days = Math.round((due - Date.now()) / 86400000);
    if (days < 0) {
      nextDueChip = { label: `Reavaliação · ${-days}d em atraso`, tone: "due" };
    } else if (days <= 3) {
      nextDueChip = { label: `Reavaliação · em ${days}d`, tone: "soon" };
    } else {
      nextDueChip = { label: `Reavaliação · em ${days}d`, tone: "ok" };
    }
  }

  const Wrapper: any = bare ? "div" : "section";
  const wrapperCls = bare ? "" : "rounded-2xl border border-border bg-card/60 p-3";
  return (
    <Wrapper aria-label={bare ? undefined : "Protocolo"} className={wrapperCls}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Protocolo
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {stages.map((s, i) => {
            const stage1Handler = s.n === 1 ? (onStage1Click ?? (onStageClick ? () => onStageClick(1) : undefined)) : undefined;
            const handler = s.n === 1 ? stage1Handler : (onStageClick ? () => onStageClick(s.n) : undefined);
            const isClickable = !!handler;
            const isActive = (s.n === 1 && (stage1Expanded || activeStage === 1)) || (s.n !== 1 && activeStage === s.n);
            const baseCls = [
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium transition",
              s.done
                ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400"
                : "border-border bg-background text-muted-foreground",
              isClickable ? "cursor-pointer hover:brightness-110" : "",
              isActive ? "ring-1 ring-amber-500/40" : "",
            ].join(" ");
            const inner = (
              <>
                {s.done ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  <Circle className="h-2.5 w-2.5" strokeWidth={2} />
                )}
                <span className="font-bold">{s.n}</span>
                <span>{s.label}</span>
                {s.n === 1 && assessmentPct != null && (
                  <span className="tabular-nums opacity-70">
                    {assessmentCoverage ? `${assessmentCoverage.done}/${assessmentCoverage.total} · ` : ""}
                    {assessmentPct}%
                  </span>
                )}
              </>
            );
            return (
              <div key={s.n} className="flex shrink-0 items-center gap-1">
                {isClickable ? (
                  <button
                    type="button"
                    onClick={handler}
                    className={baseCls}
                    aria-pressed={isActive}
                    title={s.label}
                  >
                    {inner}
                  </button>
                ) : (
                  <span className={baseCls}>{inner}</span>
                )}
                {s.n === 1 && stage1Done && onShowSynthesis && (
                  <button
                    type="button"
                    onClick={onShowSynthesis}
                    className="hidden sm:inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[0.05] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 hover:bg-amber-500/10"
                    title="Ver síntese da avaliação"
                  >
                    <Sparkles className="h-2.5 w-2.5" /> Síntese
                  </button>
                )}
                {i < stages.length - 1 && (
                  <span className="text-muted-foreground/40">›</span>
                )}
              </div>
            );
          })}
        </div>
        {nextDueChip && (
          <button
            type="button"
            onClick={onReassessClick}
            disabled={!onReassessClick}
            title={onReassessClick ? "Registar reavaliação" : undefined}
            className={[
              "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
              onReassessClick ? "hover:brightness-110 cursor-pointer" : "cursor-default",
              nextDueChip.tone === "due"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                : nextDueChip.tone === "soon"
                  ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-300"
                  : "border-border bg-background text-muted-foreground",
            ].join(" ")}
          >
            {nextDueChip.label}
          </button>
        )}
      </div>
    </Wrapper>
  );
}