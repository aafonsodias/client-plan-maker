import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toneChip, toneDot } from "@/lib/status-tone";
import {
  VERDICT_HINT_PT,
  VERDICT_LABEL_PT,
  summarizeAdaptation,
  type AdaptationRow,
} from "@/lib/block-adaptation";
import type { BlockSummary } from "@/lib/block-feedback";

type Props = {
  feedback: BlockSummary | null | undefined;
  variant?: "compact" | "full";
};

/**
 * Shows what the prior block taught the engine, and the volume shift each
 * muscle inherited because of it. Pure presentational.
 */
export function BlockAdaptationCard({ feedback, variant = "full" }: Props) {
  const { t } = useTranslation("common");
  const rows = summarizeAdaptation(feedback);
  if (!feedback || rows.length === 0) return null;

  if (variant === "compact") {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-wrap items-center gap-1.5">
          {rows
            .filter((r) => r.verdict !== "on_target")
            .map((r) => (
              <Tooltip key={r.muscle}>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-flex cursor-help items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${toneChip(r.tone)}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${toneDot(r.tone)}`} />
                    {r.muscleLabel}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  <p className="font-semibold">{r.muscleLabel} · {VERDICT_LABEL_PT[r.verdict]}</p>
                  <p className="mt-1 text-muted-foreground">{shiftLine(r, t)}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          {rows.every((r) => r.verdict === "on_target") && (
            <span className="text-[10px] text-muted-foreground">{t("adaptation.compact_all_target")}</span>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-lg border border-border bg-card/50 p-3">
        <header className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("adaptation.title")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("adaptation.adherence", { pct: feedback.adherencePct })}
          </p>
        </header>
        <div className="overflow-hidden rounded-md border border-border/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">{t("adaptation.col_muscle")}</th>
                <th className="px-2 py-1.5 font-medium">{t("adaptation.col_verdict")}</th>
                <th className="px-2 py-1.5 font-medium">{t("adaptation.col_rpe")}</th>
                <th className="px-2 py-1.5 font-medium">{t("adaptation.col_shift")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.muscle} className="border-t border-border/50">
                  <td className="px-2 py-1.5 font-medium">{r.muscleLabel}</td>
                  <td className="px-2 py-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`inline-flex cursor-help items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${toneChip(r.tone)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${toneDot(r.tone)}`} />
                          {VERDICT_LABEL_PT[r.verdict]}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {VERDICT_HINT_PT[r.verdict]}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                    {r.meanRpe !== null ? r.meanRpe.toFixed(1) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{shiftLine(r, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}

function shiftLine(r: AdaptationRow, t: (k: string, opts?: any) => string): string {
  const baseCeil = r.baseline.ceilingSets;
  const newCeil = r.adapted.ceilingSets;
  if (r.verdict === "on_target") {
    return t("adaptation.shift_normal", { ceiling: newCeil });
  }
  const arrow = newCeil < baseCeil ? "↓" : newCeil > baseCeil ? "↑" : "→";
  const startNote = r.adapted.startSets !== r.baseline.startSets
    ? t("adaptation.shift_start_note", { start: r.adapted.startSets })
    : "";
  return t("adaptation.shift_change", { base: baseCeil, arrow, newCeil }) + startNote;
}