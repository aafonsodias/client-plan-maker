import type { ProgressionPlan } from "@/server/phased/schemas";

type Row = ProgressionPlan["rows"][number] & { _idx: number };

// Parse a delta string like "+2.5kg", "-1 rep", "+0.5 RPE", "same"
// into a numeric magnitude (signed). Returns 0 when not parseable.
function parseDelta(s: string): number {
  if (!s) return 0;
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return 0;
  return Number(m[0]);
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  // Always start at week 1 baseline (0), then cumulative sum of deltas.
  const cum: number[] = [0];
  for (const v of values) cum.push(cum[cum.length - 1] + v);
  const min = Math.min(...cum);
  const max = Math.max(...cum);
  const range = max - min || 1;
  const w = 88;
  const h = 28;
  const step = w / (cum.length - 1);
  const points = cum
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {cum.map((_, i) => {
        const [x, y] = points.split(" ")[i].split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r={1.6} fill={color} />;
      })}
    </svg>
  );
}

const DIM_COLOR: Record<string, string> = {
  load: "hsl(var(--primary))",
  reps: "hsl(142 70% 45%)",
  sets: "hsl(38 92% 50%)",
  rpe: "hsl(0 72% 55%)",
  tempo: "hsl(280 60% 55%)",
  rest: "hsl(200 70% 50%)",
};

export function ProgressionExerciseCard({
  exerciseId,
  rows,
  onChange,
}: {
  exerciseId: string;
  rows: Row[];
  onChange: (rowIdx: number, patch: Partial<Row>) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-mono text-sm font-semibold text-foreground">{exerciseId}</h3>
      <div className="space-y-3">
        {rows.map((r) => {
          const w2 = parseDelta(r.week_2_delta);
          const w3 = parseDelta(r.week_3_delta);
          const w4 = parseDelta(r.week_4_delta);
          const color = DIM_COLOR[r.dimension.toLowerCase()] ?? "hsl(var(--primary))";
          return (
            <div
              key={r._idx}
              className="grid grid-cols-[80px_1fr_88px] items-center gap-3 border-t border-border/50 pt-3 first:border-t-0 first:pt-0"
            >
              <div className="text-xs">
                <div className="font-medium capitalize text-foreground">{r.dimension}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  W1 → W4
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <label className="text-[10px] text-muted-foreground">
                  W2
                  <input
                    value={r.week_2_delta}
                    onChange={(e) => onChange(r._idx, { week_2_delta: e.target.value })}
                    className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    placeholder="+2.5kg"
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  W3
                  <input
                    value={r.week_3_delta}
                    onChange={(e) => onChange(r._idx, { week_3_delta: e.target.value })}
                    className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  W4
                  <input
                    value={r.week_4_delta}
                    onChange={(e) => onChange(r._idx, { week_4_delta: e.target.value })}
                    className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                </label>
              </div>
              <div className="flex flex-col items-end">
                <Sparkline values={[w2, w3, w4]} color={color} />
                <span className="mt-0.5 text-[9px] text-muted-foreground">trend</span>
              </div>
              {r.rationale && (
                <p className="col-span-3 text-[11px] leading-snug text-muted-foreground">
                  {r.rationale}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
