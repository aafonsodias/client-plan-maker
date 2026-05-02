import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  MUSCLE_GROUP_ORDER,
  VOLUME_LANDMARKS,
  type MuscleGroup,
} from "@/lib/volume-landmarks";
import { roundSets, type VolumeByMuscle } from "@/lib/volume-compute";

// Shortened labels so they don't collide with the radar polygons.
const MUSCLE_LABEL_SHORT: Record<MuscleGroup, string> = {
  chest: "Peito",
  back: "Costas",
  quads: "Quad",
  hamstrings: "Isquios",
  glutes: "Glúteos",
  shoulders: "Ombros",
  biceps: "Bi",
  triceps: "Tri",
  calves: "Gémeos",
  core: "Core",
};

type Props = {
  volume: VolumeByMuscle;
  /** Hide groups with 0 sets AND no landmark (keeps radar tidy on partial plans). */
  hideEmpty?: boolean;
};

export function MuscleVolumeRadar({ volume, hideEmpty = false }: Props) {
  const groups: MuscleGroup[] = hideEmpty
    ? MUSCLE_GROUP_ORDER.filter((m) => volume[m] > 0 || VOLUME_LANDMARKS[m].mev > 0)
    : MUSCLE_GROUP_ORDER;

  const data = groups.map((m) => {
    const lm = VOLUME_LANDMARKS[m];
    return {
      muscle: MUSCLE_LABEL_SHORT[m],
      key: m,
      mev: lm.mev,
      mav: lm.mav,
      mrv: lm.mrv,
      actual: roundSets(volume[m]),
    };
  });

  // Radius max — cap a bit above MRV or actual, whichever's higher
  const max = Math.max(
    ...data.flatMap((d) => [d.mrv, d.actual]),
    16
  );

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="65%" margin={{ top: 16, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="muscle"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, max]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
            tickCount={4}
            stroke="hsl(var(--border))"
          />

          {/* Reference rings — drawn first so the actual polygon sits on top */}
          <Radar
            name="MRV"
            dataKey="mrv"
            stroke="oklch(0.72 0.14 30)"
            strokeDasharray="4 4"
            strokeWidth={1}
            fill="oklch(0.72 0.14 30)"
            fillOpacity={0.04}
            isAnimationActive={false}
          />
          <Radar
            name="MAV"
            dataKey="mav"
            stroke="oklch(0.70 0.13 145)"
            strokeWidth={1}
            fill="oklch(0.70 0.13 145)"
            fillOpacity={0.10}
            isAnimationActive={false}
          />
          <Radar
            name="MEV"
            dataKey="mev"
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="2 3"
            strokeWidth={1}
            fill="transparent"
            isAnimationActive={false}
          />

          <Radar
            name="Esta semana"
            dataKey="actual"
            stroke="oklch(0.68 0.16 240)"
            strokeWidth={2}
            fill="oklch(0.68 0.16 240)"
            fillOpacity={0.32}
            isAnimationActive={false}
          />

          <Tooltip
            cursor={{ stroke: "hsl(var(--accent))", strokeWidth: 1 }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              color: "hsl(var(--popover-foreground))",
            }}
            formatter={(value: number, name: string) => [
              `${value} séries`,
              name,
            ]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}