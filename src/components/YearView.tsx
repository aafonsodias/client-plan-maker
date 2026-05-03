import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  Legend,
  CartesianGrid,
  LineChart,
} from "recharts";
import {
  buildYearSummary,
  exerciseStrengthSeries,
  exercisesInSummary,
  type YearSummary,
} from "@/lib/longitudinal";
import { verdictMixSummary } from "@/lib/block-adaptation";

type Props = { clientId: string };

export default function YearView({ clientId }: Props) {
  const [summary, setSummary] = useState<YearSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    buildYearSummary(clientId).then((s) => {
      if (cancel) return;
      setSummary(s);
      const exes = exercisesInSummary(s);
      setExercise(exes[0] ?? null);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [clientId]);

  const exes = useMemo(() => (summary ? exercisesInSummary(summary) : []), [summary]);
  const strengthSeries = useMemo(
    () => (summary && exercise ? exerciseStrengthSeries(summary, exercise) : []),
    [summary, exercise],
  );

  if (loading) return <p className="text-sm text-muted-foreground">A carregar histórico…</p>;
  if (!summary || summary.weeks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Sem dados longitudinais ainda. Cria blocos e regista sessões para ver a evolução anual.
      </div>
    );
  }

  const chartData = summary.weeks.map((w) => ({
    week: w.globalWeek,
    block: w.blockNumber,
    adherence: w.adherencePct,
    rpe: w.avgRpe ?? null,
    tonnage: w.totalTonnage,
    sessionsLogged: w.sessionsLogged,
    sessionsPlanned: w.sessionsPlanned,
  }));

  return (
    <div data-tour="year-view" className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Vista anual</h2>
          <p className="text-xs text-muted-foreground">
            {summary.totalBlocks} blocos · {summary.totalWeeks} semanas · {summary.totalSessions} sessões registadas
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Stat label="Adesão global" value={`${summary.overallAdherencePct}%`} />
        </div>
      </header>

      <Card title="Adesão semanal" subtitle="% das sessões planeadas que foram registadas, semana a semana">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} unit="%" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 10]} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {summary.blockBoundaries.map((b, i) => (
                <ReferenceArea
                  key={b.blockNumber}
                  yAxisId="left"
                  x1={b.startWeek}
                  x2={b.endWeek}
                  fill={i % 2 === 0 ? "hsl(var(--muted))" : "transparent"}
                  fillOpacity={0.25}
                />
              ))}
              <Bar yAxisId="left" dataKey="adherence" name="Adesão (%)" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="rpe" name="RPE médio" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Tonelagem semanal" subtitle="Volume total levantado por semana — proxy da carga acumulada">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Bar dataKey="tonnage" name="Tonelagem (kg)" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card
        title="Curva de força"
        subtitle="Maior carga registada por semana para um exercício específico"
        right={
          <select
            value={exercise ?? ""}
            onChange={(e) => setExercise(e.target.value)}
            className="h-7 rounded bg-secondary px-2 text-xs text-foreground"
          >
            {exes.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        }
      >
        {strengthSeries.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem registos para este exercício.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={strengthSeries} margin={{ top: 10, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="globalWeek" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit="kg" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Line type="monotone" dataKey="weight" name={exercise ?? ""} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Mapa de blocos" subtitle="Resumo por bloco para inspecção rápida">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="py-2 text-left font-semibold">Bloco</th>
                <th className="py-2 text-left font-semibold">Semanas</th>
                <th className="py-2 text-right font-semibold">Sessões</th>
                <th className="py-2 text-right font-semibold">Adesão</th>
                <th className="py-2 text-right font-semibold">RPE médio</th>
                <th className="py-2 text-right font-semibold">Tonelagem</th>
                <th className="py-2 text-left font-semibold">Adaptação</th>
              </tr>
            </thead>
            <tbody>
              {summary.blockBoundaries.map((b) => {
                const wks = summary.weeks.filter((w) => w.blockNumber === b.blockNumber);
                const sessions = wks.reduce((a, w) => a + w.sessionsLogged, 0);
                const planned = wks.reduce((a, w) => a + w.sessionsPlanned, 0);
                const adh = planned > 0 ? Math.round((sessions / planned) * 100) : 0;
                const rpes = wks.map((w) => w.avgRpe).filter((x): x is number => x !== null);
                const avgRpe = rpes.length > 0 ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null;
                const tonnage = wks.reduce((a, w) => a + w.totalTonnage, 0);
                return (
                  <tr key={b.blockNumber} className="border-b border-border/50">
                    <td className="py-2 font-semibold text-foreground">{b.title}</td>
                    <td className="py-2 text-muted-foreground">w{b.startWeek}–w{b.endWeek}</td>
                    <td className="py-2 text-right tabular-nums">{sessions}/{planned}</td>
                    <td className="py-2 text-right tabular-nums">{adh}%</td>
                    <td className="py-2 text-right tabular-nums">{avgRpe ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">{tonnage.toLocaleString()} kg</td>
                    <td className="py-2 text-muted-foreground">{verdictMixSummary((b as any).blockFeedback)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary px-3 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}