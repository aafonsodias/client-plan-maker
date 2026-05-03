import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MUSCLE_GROUP_LABELS_PT,
  MUSCLE_GROUP_ORDER,
  VOLUME_LANDMARKS,
  statusFor,
  type MuscleGroup,
  type VolumeStatus,
} from "@/lib/volume-landmarks";
import { roundSets, type VolumeByMuscle } from "@/lib/volume-compute";
import { toneChip, toneDot, type Tone } from "@/lib/status-tone";
import type { AdaptationRow } from "@/lib/block-adaptation";
import { VERDICT_LABEL_PT } from "@/lib/block-adaptation";

const STATUS_TONE: Record<VolumeStatus, Tone> = {
  under: "neutral",
  optimal: "success",
  over: "warn",
  danger: "danger",
};

const STATUS_KEY: Record<VolumeStatus, string> = {
  under: "volume.table.status_under",
  optimal: "volume.table.status_optimal",
  over: "volume.table.status_over",
  danger: "volume.table.status_danger",
};

function messageFor(
  status: VolumeStatus,
  sets: number,
  lm: ReturnType<typeof landmarkOf>,
  t: (k: string, opts?: any) => string,
): string {
  switch (status) {
    case "under": {
      const gap = Math.max(1, lm.mev - Math.floor(sets));
      return gap === 1
        ? t("volume.table.msg_under_one", { mev: lm.mev })
        : t("volume.table.msg_under_other", { count: gap, mev: lm.mev });
    }
    case "optimal":
      return t("volume.table.msg_optimal", { mev: lm.mev, mav: lm.mav });
    case "over":
      return t("volume.table.msg_over", { count: Math.ceil(sets - lm.mav) });
    case "danger":
      return t("volume.table.msg_danger", { mrv: lm.mrv, count: Math.ceil(sets - lm.mav) });
  }
}

function landmarkOf(m: MuscleGroup) {
  return VOLUME_LANDMARKS[m];
}

type Props = {
  volume: VolumeByMuscle;
  actual?: VolumeByMuscle | null;
  adaptation?: AdaptationRow[];
};

export function VolumeStatusTable({ volume, actual, adaptation }: Props) {
  const { t } = useTranslation("common");
  const adaptByMuscle = new Map<MuscleGroup, AdaptationRow>();
  for (const a of adaptation ?? []) adaptByMuscle.set(a.muscle, a);
  const rows = MUSCLE_GROUP_ORDER.map((m) => {
    const lm = landmarkOf(m);
    const sets = roundSets(volume[m]);
    const done = actual ? roundSets(actual[m]) : null;
    const ratio = done != null && sets > 0 ? done / sets : null;
    const status = statusFor(sets, lm);
    return { m, lm, sets, done, ratio, status, adapt: adaptByMuscle.get(m) };
  });

  function ratioTone(r: number | null): Tone {
    if (r == null) return "neutral";
    if (r >= 0.8) return "success";
    if (r >= 0.5) return "warn";
    return "danger";
  }

  return (
    <TooltipProvider delayDuration={150}>
    <>
    {/* Mobile: stacked cards. Tables get unreadable below 380px. */}
    <div className="space-y-2 md:hidden">
      {rows.map(({ m, lm, sets, status }) => (
        <div key={m} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 font-medium">
              <span className={`h-2 w-2 rounded-full ${toneDot(STATUS_TONE[status])}`} />
              {MUSCLE_GROUP_LABELS_PT[m]}
            </span>
            <span className="tabular-nums text-sm text-muted-foreground">
              {sets % 1 === 0 ? sets : sets.toFixed(1)} {t("volume.table.sets")}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneChip(STATUS_TONE[status])}`}>
              {t(STATUS_KEY[status])}
            </span>
            <span className="text-[11px] text-muted-foreground">
              MEV {lm.mev} · MAV {lm.mav} · MRV {lm.mrv}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{messageFor(status, sets, lm, t)}</p>
          {adaptByMuscle.get(m) && adaptByMuscle.get(m)!.verdict !== "on_target" && (
            <p className="mt-1 text-[11px] text-amber-300">
              {t("volume.table.adjusted_chip", { verdict: VERDICT_LABEL_PT[adaptByMuscle.get(m)!.verdict] })}
            </p>
          )}
        </div>
      ))}
    </div>
    <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary/40 text-[11px] uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t("volume.table.muscle")}</th>
            <th className="px-3 py-2 font-medium">{t("volume.table.prescribed")}</th>
            {actual && <th className="px-3 py-2 font-medium">{t("volume.table.actual")}</th>}
            <th className="px-3 py-2 font-medium">{t("volume.table.status")}</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">{t("volume.table.suggestion")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, lm, sets, done, ratio, status }) => (
            <tr key={m} className="border-t border-border/60">
              <td className="px-3 py-2.5 font-medium">
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${toneDot(STATUS_TONE[status])}`} />
                  {MUSCLE_GROUP_LABELS_PT[m]}
                  {adaptByMuscle.get(m) && adaptByMuscle.get(m)!.verdict !== "on_target" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help text-[10px] font-semibold text-amber-300">↘</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {t("volume.table.adjusted_tooltip", {
                          verdict: VERDICT_LABEL_PT[adaptByMuscle.get(m)!.verdict],
                          from: adaptByMuscle.get(m)!.baseline.ceilingSets,
                          to: adaptByMuscle.get(m)!.adapted.ceilingSets,
                        })}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {sets % 1 === 0 ? sets : sets.toFixed(1)}
              </td>
              {actual && (
                <td className="px-3 py-2.5 tabular-nums">
                  <span className="inline-flex items-center gap-2">
                    <span className={`tabular-nums ${ratio == null ? "text-muted-foreground" : ""}`}>
                      {done == null ? "—" : done % 1 === 0 ? done : done.toFixed(1)}
                    </span>
                    {ratio != null && (
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${toneChip(ratioTone(ratio))}`}>
                        {Math.round(ratio * 100)}%
                      </span>
                    )}
                  </span>
                </td>
              )}
              <td className="px-3 py-2.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`inline-flex cursor-help rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneChip(STATUS_TONE[status])}`}>
                      {t(STATUS_KEY[status])}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    MEV {lm.mev} · MAV {lm.mav} · MRV {lm.mrv}
                  </TooltipContent>
                </Tooltip>
              </td>
              <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
                {messageFor(status, sets, lm, t)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
    </TooltipProvider>
  );
}