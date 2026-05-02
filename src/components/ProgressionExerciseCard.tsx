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
  const flat = max === min;
  const range = flat ? 1 : max - min;
  const w = 88;
  const h = 28;
  const step = w / (cum.length - 1);
  const points = cum
    .map((v, i) => {
      const x = i * step;
      // When all deltas are 0, lock the line to the vertical centre so the
      // polyline still has a visible 88px-wide stroke instead of collapsing
      // to a single point (which renders as just dots in some browsers).
      const y = flat ? h / 2 : h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {cum.map((_, i) => {
        const [x, y] = points.split(" ")[i].split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r={1.2} fill={color} />;
      })}
    </svg>
  );
}

// Sign-based palette: trend direction beats dimension category — the user
// needs to spot at a glance whether a row is progressing, holding, or
// deloading. "Flat" uses amber so it never reads as broken / greyed-out.
const TREND_UP = "hsl(142 70% 45%)"; // emerald
const TREND_DOWN = "hsl(0 72% 55%)"; // rose
const TREND_FLAT = "hsl(38 92% 55%)"; // amber — hold / deload signal

function deltaClass(v: number): string {
  if (v > 0) return "text-emerald-400 font-semibold";
  if (v < 0) return "text-rose-400 font-semibold";
  return "text-muted-foreground";
}

// Convert "d3_pull_ups" → { day: 3, name: "Pull Ups" }
function prettifyExerciseId(id: string): { day: number | null; name: string } {
  const m = id.match(/^d(\d+)_(.+)$/);
  if (!m) return { day: null, name: id };
  const day = parseInt(m[1], 10);
  const name = m[2]
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { day, name };
}

export function ProgressionExerciseCard({
  exerciseId,
  rows,
  onChange,
}: {
  exerciseId: string;
  rows: Row[];
  onChange: (rowIdx: number, patch: Partial<Row>) => void;
}) {
  const pretty = prettifyExerciseId(exerciseId);
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {pretty.day !== null && (
            <span className="mr-2 inline-flex items-center rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
              Day {pretty.day}
            </span>
          )}
          {pretty.name}
        </h3>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">{exerciseId}</p>
      </header>
      <div className="space-y-3">
        {rows.map((r) => {
          const w2 = parseDelta(r.week_2_delta);
          const w3 = parseDelta(r.week_3_delta);
          const w4 = parseDelta(r.week_4_delta);
          const cum = w2 + w3 + w4;
          const trendColor = cum > 0 ? TREND_UP : cum < 0 ? TREND_DOWN : TREND_FLAT;
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
                    className={`mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-sm tabular-nums ${deltaClass(w2)}`}
                    placeholder="+2.5kg"
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  W3
                  <input
                    value={r.week_3_delta}
                    onChange={(e) => onChange(r._idx, { week_3_delta: e.target.value })}
                    className={`mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-sm tabular-nums ${deltaClass(w3)}`}
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  W4
                  <input
                    value={r.week_4_delta}
                    onChange={(e) => onChange(r._idx, { week_4_delta: e.target.value })}
                    className={`mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-sm tabular-nums ${deltaClass(w4)}`}
                  />
                </label>
              </div>
              <div className="flex flex-col items-end">
                <Sparkline values={[w2, w3, w4]} color={trendColor} />
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
