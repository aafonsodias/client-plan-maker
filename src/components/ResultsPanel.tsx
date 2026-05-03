import { useMemo, useState } from "react";
import { Activity, TrendingUp, MessageCircle, Dumbbell } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
import { rpeTone, parseRpe, formatRpe } from "@/lib/rpe-tone";
import type { PlanData } from "@/lib/pdf";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type SessionRow = {
  id: string;
  week_number: number;
  day_label: string;
  session_date: string;
  logged_by: string;
  entries: any[];
  session_notes: string | null;
  client_feedback?: { kind?: string; text?: string } | null;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  category: string;
  body: string;
  status: string;
  author: string;
  created_at: string;
};

/**
 * ResultsPanel — the "filled demo" view of a plan.
 * Surfaces what was actually trained: KPIs, RPE wave, weekly volume,
 * top-lift load progression, full logbook table, and the bot/client feedback feed.
 */
export function ResultsPanel({
  plan,
  sessions,
  feedback = [],
}: {
  plan: PlanData;
  sessions: SessionRow[];
  feedback?: FeedbackRow[];
}) {
  const [openSession, setOpenSession] = useState<SessionRow | null>(null);
  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const sessionCount = sessions.length;
    const totalPlanned = plan.weeks.reduce(
      (acc, w) => acc + w.days.length,
      0,
    );
    const adherence = totalPlanned > 0
      ? Math.min(100, Math.round((sessionCount / totalPlanned) * 100))
      : 0;

    const rpes: number[] = [];
    let totalReps = 0;
    let totalLoadKg = 0;
    for (const s of sessions) {
      for (const e of s.entries ?? []) {
        const r = parseRpe(e?.actual?.rpe);
        if (r != null) rpes.push(r);
        const reps = Number(String(e?.actual?.reps ?? "").match(/\d+/)?.[0] ?? 0);
        const sets = Number(String(e?.actual?.sets ?? "").match(/\d+/)?.[0] ?? 0);
        const load = Number(String(e?.actual?.weight ?? "").match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
        if (reps && sets) totalReps += reps * sets;
        if (load && reps && sets) totalLoadKg += load * reps * sets;
      }
    }
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    return { sessionCount, adherence, avgRpe, totalReps, totalLoadKg };
  }, [sessions, plan]);

  // ── RPE trend (per session) ───────────────────────────────────────────────
  const rpeSeries = useMemo(() => {
    return [...sessions]
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
      .map((s, i) => {
        const rs = (s.entries ?? [])
          .map((e: any) => parseRpe(e?.actual?.rpe))
          .filter((r): r is number => r != null);
        const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
        return {
          idx: i + 1,
          date: s.session_date.slice(5),
          rpe: avg != null ? Number(avg.toFixed(2)) : null,
          week: s.week_number,
        };
      })
      .filter((p) => p.rpe != null);
  }, [sessions]);

  // ── Weekly volume ─────────────────────────────────────────────────────────
  const volumeSeries = useMemo(() => {
    const byWeek = new Map<number, { week: number; reps: number; tonnage: number }>();
    for (const s of sessions) {
      const bucket = byWeek.get(s.week_number) ?? { week: s.week_number, reps: 0, tonnage: 0 };
      for (const e of s.entries ?? []) {
        const reps = Number(String(e?.actual?.reps ?? "").match(/\d+/)?.[0] ?? 0);
        const sets = Number(String(e?.actual?.sets ?? "").match(/\d+/)?.[0] ?? 0);
        const load = Number(String(e?.actual?.weight ?? "").match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
        bucket.reps += reps * sets;
        bucket.tonnage += Math.round(load * reps * sets);
      }
      byWeek.set(s.week_number, bucket);
    }
    return [...byWeek.values()].sort((a, b) => a.week - b.week);
  }, [sessions]);

  // ── Top-5 lifts: load progression ─────────────────────────────────────────
  const topLifts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      for (const e of s.entries ?? []) {
        const name = String(e?.exercise_name ?? "").trim();
        if (!name) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]);
    const palette = ["#10b981", "#84cc16", "#f59e0b", "#f97316", "#ef4444"];
    const series = top.map((name, i) => {
      const points = sessions
        .filter((s) => (s.entries ?? []).some((e: any) => e?.exercise_name === name))
        .sort((a, b) => a.session_date.localeCompare(b.session_date))
        .map((s) => {
          const e = (s.entries ?? []).find((x: any) => x?.exercise_name === name);
          const load = Number(String(e?.actual?.weight ?? "").match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
          return { date: s.session_date.slice(5), load: load || null };
        })
        .filter((p) => p.load != null);
      return { name, color: palette[i] ?? "#64748b", points };
    });
    return series;
  }, [sessions]);

  // Merge top-lift points into a single dataset for the chart (X = date)
  const liftChartData = useMemo(() => {
    const dates = new Set<string>();
    topLifts.forEach((s) => s.points.forEach((p) => dates.add(p.date)));
    return [...dates].sort().map((date) => {
      const row: any = { date };
      for (const lift of topLifts) {
        const found = lift.points.find((p) => p.date === date);
        row[lift.name] = found?.load ?? null;
      }
      return row;
    });
  }, [topLifts]);

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
        <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Sem sessões registadas ainda.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Os resultados aparecem aqui à medida que o cliente regista treinos. Para demos, use o painel "Demo Lab" para popular automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Sessões" value={String(kpis.sessionCount)} hint="treinos registados" />
        <KpiCard label="Adesão" value={`${kpis.adherence}%`} hint="vs plano total" />
        <KpiCard
          label="RPE médio"
          value={formatRpe(kpis.avgRpe)}
          hint={kpis.avgRpe != null ? rpeTone(kpis.avgRpe).label : "—"}
          accent={kpis.avgRpe != null ? rpeTone(kpis.avgRpe).hex : undefined}
        />
        <KpiCard label="Tonelagem" value={`${(kpis.totalLoadKg / 1000).toFixed(1)} t`} hint={`${kpis.totalReps} reps totais`} />
      </div>

      {/* Charts row — denser fold: RPE trend + Top lifts side by side on lg+ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          icon={<TrendingUp className="h-4 w-4" />}
          title="Tendência de RPE por sessão"
          subtitle="Cor segue a intensidade — verde calmo → vermelho máximo."
        >
          <div className="h-44 w-full">
            <ResponsiveContainer>
              <LineChart data={rpeSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis domain={[3, 10]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [`RPE ${v}`, "média sessão"]}
                />
                <Line
                  type="monotone"
                  dataKey="rpe"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null) return <g />;
                    const tn = rpeTone(payload.rpe);
                    return <circle cx={cx} cy={cy} r={4} fill={tn.hex} stroke="#0b0b0b" strokeWidth={1} />;
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {topLifts.length > 0 && liftChartData.length > 1 ? (
          <ChartCard
            icon={<TrendingUp className="h-4 w-4" />}
            title="Top 5 exercícios — progressão de carga"
          >
            <div className="h-44 w-full">
              <ResponsiveContainer>
                <LineChart data={liftChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  {topLifts.map((lift) => (
                    <Line
                      key={lift.name}
                      type="monotone"
                      dataKey={lift.name}
                      stroke={lift.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: lift.color }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topLifts.map((l) => (
                <span key={l.name} className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2 py-0.5 text-[10px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </span>
              ))}
            </div>
          </ChartCard>
        ) : (
          <ChartCard
            icon={<TrendingUp className="h-4 w-4" />}
            title="Top exercícios — progressão de carga"
            subtitle="Aparece quando o mesmo exercício for registado em ≥2 sessões."
          >
            <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
              Ainda sem dados suficientes.
            </div>
          </ChartCard>
        )}
      </div>

      {/* Weekly volume realised — full-width row */}
      <ChartCard
        icon={<Dumbbell className="h-4 w-4" />}
        title="Volume semanal realizado (tonelagem)"
        subtitle="Soma de carga × reps × sets do que foi efectivamente registado. Para volume vs MEV/MAV/MRV (prescrito), abre o modo Edit."
      >
        <div className="h-40 w-full">
          <ResponsiveContainer>
            <BarChart data={volumeSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `W${v}`} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any, name: string) => [`${v} kg`, name === "tonnage" ? "tonelagem" : name]}
                labelFormatter={(l) => `Semana ${l}`}
              />
              <Bar dataKey="tonnage" radius={[6, 6, 0, 0]}>
                {volumeSeries.map((_d, i) => (
                  <Cell key={i} fill="#84cc16" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Full logbook table */}
      <SectionCard title="Logbook" subtitle={`${sessions.length} sessões registadas`}>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-1 text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left font-semibold">Data</th>
                <th className="px-2 py-1 text-left font-semibold">Semana</th>
                <th className="px-2 py-1 text-left font-semibold">Sessão</th>
                <th className="px-2 py-1 text-left font-semibold">Exercícios</th>
                <th className="px-2 py-1 text-left font-semibold">RPE</th>
                <th className="px-2 py-1 text-left font-semibold">Por</th>
                <th className="px-2 py-1 text-left font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {[...sessions]
                .sort((a, b) => b.session_date.localeCompare(a.session_date))
                .map((s) => {
                  const rs = (s.entries ?? [])
                    .map((e: any) => parseRpe(e?.actual?.rpe))
                    .filter((r): r is number => r != null);
                  const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
                  const tn = rpeTone(avg);
                  return (
                    <tr key={s.id} className="bg-card/60">
                      <td className="rounded-l-md px-2 py-1.5">{s.session_date}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">W{s.week_number}</td>
                      <td className="px-2 py-1.5">{s.day_label}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{(s.entries ?? []).length}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tn.pill}`}>
                          {formatRpe(avg)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground capitalize">{s.logged_by}</td>
                      <td className="rounded-r-md px-2 py-1.5">
                        {s.client_feedback?.text && (
                          <span title={s.client_feedback.text} className="inline-flex">
                            <MessageCircle className="h-3.5 w-3.5 text-amber-300" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Feedback feed */}
      {(feedback.length > 0 || sessions.some((s) => s.client_feedback?.text)) && (
        <SectionCard title="Feedback do cliente" subtitle="Perguntas, queixas e sinais de stress capturados durante o plano">
          <ul className="space-y-2">
            {sessions
              .filter((s) => s.client_feedback?.text)
              .sort((a, b) => b.session_date.localeCompare(a.session_date))
              .slice(0, 8)
              .map((s) => (
                <FeedbackItem
                  key={`s-${s.id}`}
                  date={s.session_date}
                  category={s.client_feedback?.kind ?? "note"}
                  body={s.client_feedback!.text!}
                />
              ))}
            {feedback.slice(0, 8).map((f) => (
              <FeedbackItem
                key={`f-${f.id}`}
                date={f.created_at.slice(0, 10)}
                category={f.category}
                body={f.body}
              />
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold" style={accent ? { color: accent } : undefined}>{value}</span>
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ChartCard({ icon, title, subtitle, children }: { icon?: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {subtitle && <p className="-mt-2 mb-2 text-[11px] text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function FeedbackItem({ date, category, body }: { date: string; category: string; body: string }) {
  const tone = categoryTone(category);
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
      <span className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
        {category}
      </span>
      <span className="flex-1 leading-relaxed">{body}</span>
      <span className="text-[10px] text-muted-foreground">{date}</span>
    </li>
  );
}

function categoryTone(cat: string): string {
  switch (cat) {
    case "complaint":
    case "pain":
      return "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30";
    case "stress":
      return "bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-500/30";
    case "question":
      return "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30";
    case "praise":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30";
    default:
      return "bg-muted/40 text-muted-foreground ring-1 ring-inset ring-border";
  }
}