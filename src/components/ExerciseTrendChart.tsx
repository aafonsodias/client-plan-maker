import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { TrendingUp, Trophy } from "lucide-react";

type SessionRow = {
  week_number: number;
  day_label: string;
  entries: any[];
  status?: string | null;
};

type Point = {
  week: number;
  weight: number | null;
  rpe: number | null;
  reps: number | null;
};

function parseFirstNumber(s: unknown): number | null {
  if (s == null) return null;
  const m = String(s).match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Aggregates `workout_sessions.entries` by exercise name and renders a small
 * recharts line of weight + RPE per week. Honest formatting: only shows what
 * was actually logged; if there are <2 weeks with data, renders an empty
 * state pointing the trainer to the import dialog.
 */
export function ExerciseTrendChart({
  sessions,
  blockNumber,
}: {
  sessions: SessionRow[];
  blockNumber: number;
}) {
  const { t } = useTranslation("common");
  const grouped = useMemo(() => {
    // exerciseName -> Map<week, accumulator>
    const out = new Map<string, Map<number, { wSum: number; wN: number; rSum: number; rN: number; repSum: number; repN: number }>>();
    for (const s of sessions) {
      const week = s.week_number ?? 0;
      const entries = Array.isArray(s.entries) ? s.entries : [];
      for (const e of entries) {
        const name = (e?.exercise_name ?? "").toString().trim();
        if (!name) continue;
        const actual = e?.actual ?? {};
        const w = parseFirstNumber(actual?.weight);
        const r = parseFirstNumber(actual?.rpe ?? actual?.reps_rpe);
        const reps = parseFirstNumber(actual?.reps);
        if (w == null && r == null && reps == null) continue;
        if (!out.has(name)) out.set(name, new Map());
        const wkMap = out.get(name)!;
        const acc = wkMap.get(week) ?? { wSum: 0, wN: 0, rSum: 0, rN: 0, repSum: 0, repN: 0 };
        if (w != null) { acc.wSum += w; acc.wN += 1; }
        if (r != null) { acc.rSum += r; acc.rN += 1; }
        if (reps != null) { acc.repSum += reps; acc.repN += 1; }
        wkMap.set(week, acc);
      }
    }
    return out;
  }, [sessions]);

  const cards = useMemo(() => {
    const items: { name: string; points: Point[]; pr: number | null; deltaKg: number | null }[] = [];
    for (const [name, wkMap] of grouped) {
      const points: Point[] = [...wkMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([week, a]) => ({
          week,
          weight: a.wN ? +(a.wSum / a.wN).toFixed(1) : null,
          rpe: a.rN ? +(a.rSum / a.rN).toFixed(1) : null,
          reps: a.repN ? +(a.repSum / a.repN).toFixed(1) : null,
        }));
      if (points.length < 1) continue;
      const weights = points.map((p) => p.weight).filter((x): x is number => x != null);
      const pr = weights.length ? Math.max(...weights) : null;
      const first = weights[0];
      const last = weights[weights.length - 1];
      const deltaKg = first != null && last != null ? +(last - first).toFixed(1) : null;
      items.push({ name, points, pr, deltaKg });
    }
    items.sort((a, b) => (b.points.length - a.points.length));
    return items;
  }, [grouped]);

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        <Trans i18nKey="trend.empty_html" ns="common" components={{ bold: <b className="text-foreground" /> }} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {cards.map((c) => {
        const lastPoint = c.points[c.points.length - 1];
        const isPr = lastPoint?.weight != null && c.pr != null && lastPoint.weight === c.pr && c.points.length > 1;
        const subtitle = c.deltaKg != null && c.deltaKg !== 0
          ? t("trend.delta", {
              count: c.points.length,
              delta: `${c.deltaKg > 0 ? "+" : ""}${c.deltaKg}`,
            })
          : t("trend.weeks", { count: c.points.length });
        return (
          <div key={c.name} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="truncate">{c.name}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
              </div>
              {isPr && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                  <Trophy className="h-3 w-3" /> PR Bloco {blockNumber}
                </span>
              )}
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={c.points} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickFormatter={(v) => `S${v}`}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    width={28}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[4, 10]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    width={20}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="weight"
                    name="kg"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="rpe"
                    name="RPE"
                    stroke="hsl(var(--accent-foreground))"
                    strokeOpacity={0.6}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 2 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}