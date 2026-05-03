import { useMemo, useState } from "react";
import { Activity, Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { computeWeeklyVolume, type PlanLike } from "@/lib/volume-compute";
import { computeWeeklyActualVolume } from "@/lib/volume-actual";
import { MuscleVolumeRadar } from "./MuscleVolumeRadar";
import { VolumeStatusTable } from "./VolumeStatusTable";
import type { AdaptationRow } from "@/lib/block-adaptation";

type Props = {
  plan: PlanLike;
  adaptation?: AdaptationRow[];
  sessions?: Array<{ week_number: number; status?: string | null; entries?: any[] | null }>;
};

/**
 * Volume diagnostic section — derived 100% from plan data.
 * Counts sets per muscle group across each week and compares to MEV/MAV/MRV.
 * Pure read-only diagnosis. We never auto-edit the plan.
 */
export function VolumeSection({ plan, adaptation, sessions }: Props) {
  const byWeek = useMemo(() => computeWeeklyVolume(plan), [plan]);
  const byWeekActual = useMemo(
    () => (sessions && sessions.length > 0 ? computeWeeklyActualVolume(plan, sessions) : null),
    [plan, sessions],
  );
  const weeks = useMemo(
    () => Array.from(byWeek.keys()).sort((a, b) => a - b),
    [byWeek]
  );

  const [activeWeek, setActiveWeek] = useState<number | null>(
    weeks.length > 0 ? weeks[0] : null
  );
  const currentWeek = activeWeek ?? weeks[0] ?? null;
  const currentVolume = currentWeek != null ? byWeek.get(currentWeek) : null;
  const currentActual = currentWeek != null && byWeekActual ? byWeekActual.get(currentWeek) ?? null : null;

  if (!currentVolume || weeks.length === 0) {
    return null;
  }

  return (
    <section data-tour="volume-section" className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <Activity className="mt-0.5 h-4 w-4 text-accent" />
          <div>
            <h2 className="text-base font-bold tracking-tight">Volume prescrito vs landmarks</h2>
            <p className="text-[11px] text-muted-foreground">
              Verifica antes de aprovar — séries por grupo muscular face a MEV/MAV/MRV (Israetel/Helms). Não inclui o que o cliente realizou.
            </p>
          </div>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Sobre MEV/MAV/MRV"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                <p className="mb-2 font-semibold">Como ler</p>
                <p className="mb-1"><span className="font-medium">MEV</span> — mínimo para estimular crescimento.</p>
                <p className="mb-1"><span className="font-medium">MAV</span> — alvo (sweet spot).</p>
                <p className="mb-2"><span className="font-medium">MRV</span> — máximo recuperável; acima é overreaching.</p>
                <p className="text-muted-foreground">Cada série conta 1× para o músculo primário e 0.5× para cada secundário. Valores referência para praticantes intermédios — ajusta com critério.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {weeks.length > 1 && (
          <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-0.5 text-xs">
            {weeks.map((w) => (
              <button
                key={w}
                onClick={() => setActiveWeek(w)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  w === currentWeek
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                W{w}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <MuscleVolumeRadar volume={currentVolume} />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "oklch(0.68 0.16 240)" }} />
              Esta semana
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "oklch(0.70 0.13 145)" }} />
              MAV alvo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm border border-dashed" style={{ borderColor: "oklch(0.72 0.14 30)" }} />
              MRV tecto
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <VolumeStatusTable volume={currentVolume} actual={currentActual} adaptation={adaptation} />
        </div>
      </div>
    </section>
  );
}