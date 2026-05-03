import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  MUSCLE_GROUP_LABELS_PT,
  MUSCLE_GROUP_ORDER,
  type MuscleGroup,
} from "@/lib/volume-landmarks";
import type { VolumeByMuscle } from "@/lib/volume-compute";

/**
 * WeeklyVolumeBars — para a semana activa, mostra prescrito vs realizado por
 * grupo muscular (séries). Honest-by-default: só renderiza se houver pelo
 * menos uma série realizada num dos grupos. Caso contrário, devolve null e a
 * `VolumeStatusTable` continua a ser a fonte de verdade.
 */
type Props = {
  prescribed: VolumeByMuscle;
  actual: VolumeByMuscle | null;
};

export function WeeklyVolumeBars({ prescribed, actual }: Props) {
  const data = useMemo(() => {
    return MUSCLE_GROUP_ORDER.map((m: MuscleGroup) => ({
      muscle: MUSCLE_GROUP_LABELS_PT[m],
      prescrito: Number((prescribed[m] ?? 0).toFixed(1)),
      realizado: actual ? Number((actual[m] ?? 0).toFixed(1)) : 0,
    }));
  }, [prescribed, actual]);

  const totalActual = data.reduce((a, b) => a + b.realizado, 0);
  if (!actual || totalActual <= 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-secondary/20 p-2">
      <p className="mb-1 px-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        Prescrito vs realizado · séries
      </p>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap={6}>
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="muscle"
              interval={0}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Bar dataKey="prescrito" fill="oklch(0.68 0.16 240)" radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Bar dataKey="realizado" fill="oklch(0.70 0.13 145)" radius={[3, 3, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}