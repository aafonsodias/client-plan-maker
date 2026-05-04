import { Check, Circle } from "lucide-react";
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
  lastAssessmentAt,
  briefApproved,
  blueprintApproved,
  microcycleApproved,
  progressionsApproved,
  intervalDays = 14,
  onReassessClick,
}: {
  assessmentPct: number | null;
  lastAssessmentAt: string | null;
  briefApproved: boolean;
  blueprintApproved: boolean;
  microcycleApproved: boolean;
  progressionsApproved: boolean;
  intervalDays?: number;
  onReassessClick?: () => void;
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

  return (
    <section
      aria-label="Protocolo"
      className="rounded-2xl border border-border bg-card/60 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Protocolo
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {stages.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                  s.done
                    ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400"
                    : "border-border bg-background text-muted-foreground",
                ].join(" ")}
              >
                {s.done ? (
                  <Check className="h-3 w-3" strokeWidth={2.75} />
                ) : (
                  <Circle className="h-3 w-3" strokeWidth={2} />
                )}
                <span className="font-bold">{s.n}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </span>
              {i < stages.length - 1 && (
                <span className="text-muted-foreground/40">·</span>
              )}
            </div>
          ))}
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
    </section>
  );
}