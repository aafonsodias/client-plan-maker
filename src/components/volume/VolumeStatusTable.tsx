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

const STATUS_TONE: Record<VolumeStatus, Tone> = {
  under: "neutral",
  optimal: "success",
  over: "warn",
  danger: "danger",
};

const STATUS_LABEL: Record<VolumeStatus, string> = {
  under: "Abaixo do MEV",
  optimal: "Sweet spot",
  over: "Acima do MAV",
  danger: "Acima do MRV",
};

function messageFor(status: VolumeStatus, sets: number, lm: ReturnType<typeof landmarkOf>): string {
  switch (status) {
    case "under": {
      const gap = Math.max(1, lm.mev - Math.floor(sets));
      return `Faltam ~${gap} série${gap === 1 ? "" : "s"} (alvo ${lm.mev}).`;
    }
    case "optimal":
      return `Dentro do alvo (${lm.mev}–${lm.mav}).`;
    case "over":
      return `+${Math.ceil(sets - lm.mav)} acima do alvo. Vigia recuperação.`;
    case "danger":
      return `Excede MRV (${lm.mrv}). Corta ~${Math.ceil(sets - lm.mav)}.`;
  }
}

function landmarkOf(m: MuscleGroup) {
  return VOLUME_LANDMARKS[m];
}

type Props = {
  volume: VolumeByMuscle;
};

export function VolumeStatusTable({ volume }: Props) {
  const rows = MUSCLE_GROUP_ORDER.map((m) => {
    const lm = landmarkOf(m);
    const sets = roundSets(volume[m]);
    const status = statusFor(sets, lm);
    return { m, lm, sets, status };
  });

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
              {sets % 1 === 0 ? sets : sets.toFixed(1)} séries
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneChip(STATUS_TONE[status])}`}>
              {STATUS_LABEL[status]}
            </span>
            <span className="text-[11px] text-muted-foreground">
              MEV {lm.mev} · MAV {lm.mav} · MRV {lm.mrv}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{messageFor(status, sets, lm)}</p>
        </div>
      ))}
    </div>
    <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary/40 text-[11px] uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Grupo</th>
            <th className="px-3 py-2 font-medium">Séries</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Sugestão</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, lm, sets, status }) => (
            <tr key={m} className="border-t border-border/60">
              <td className="px-3 py-2.5 font-medium">
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${toneDot(STATUS_TONE[status])}`} />
                  {MUSCLE_GROUP_LABELS_PT[m]}
                </span>
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {sets % 1 === 0 ? sets : sets.toFixed(1)}
              </td>
              <td className="px-3 py-2.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`inline-flex cursor-help rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneChip(STATUS_TONE[status])}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    MEV {lm.mev} · MAV {lm.mav} · MRV {lm.mrv}
                  </TooltipContent>
                </Tooltip>
              </td>
              <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
                {messageFor(status, sets, lm)}
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