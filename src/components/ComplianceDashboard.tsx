import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, TrendingDown, Minus, Activity, Dumbbell, CalendarCheck } from "lucide-react";
import { markOnboardingStep } from "@/components/OnboardingChecklist";

/**
 * Per-client compliance dashboard.
 * Reads workout_sessions across ALL plans for this client and computes:
 *  - Adherence (logged vs planned in the selected window)
 *  - Sessions logged
 *  - Total sets
 *  - Total tonnage (kg) when weights are numeric
 *  - Last 8 weeks bar visualization (sessions per ISO week)
 *  - Top 5 exercises by tonnage / set volume
 * Pure client-side aggregation — no fabricated numbers.
 */

type Range = "30d" | "90d" | "all";

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(",", ".").trim();
  if (!s) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function entrySets(entry: any): { reps?: string; weight?: string }[] {
  if (Array.isArray(entry?.sets) && entry.sets.length > 0) return entry.sets;
  if (entry?.actual) {
    const setCount = parseNum(entry.actual.sets) ?? 0;
    if (setCount > 0) {
      return Array.from({ length: setCount }, () => ({
        reps: entry.actual.reps,
        weight: entry.actual.weight,
      }));
    }
  }
  return [];
}

function weekKey(d: Date): string {
  // ISO-ish: year + week number
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((t.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

export function ComplianceDashboard({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [range, setRange] = useState<Range>("30d");

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) void markOnboardingStep(user.id, "review_compliance");
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: planRows } = await supabase
        .from("workout_plans")
        .select("id, title, plan_data")
        .eq("client_id", clientId);
      const planIds = (planRows ?? []).map((p) => p.id);
      let sess: any[] = [];
      if (planIds.length > 0) {
        const { data } = await supabase
          .from("workout_sessions")
          .select("id, plan_id, week_number, day_label, session_date, entries, session_notes, logged_by")
          .in("plan_id", planIds)
          .order("session_date", { ascending: false });
        sess = data ?? [];
      }
      if (cancelled) return;
      setPlans(planRows ?? []);
      setSessions(sess);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const fromDate = useMemo(() => {
    if (range === "all") return null;
    const days = range === "30d" ? 30 : 90;
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [range]);

  const stats = useMemo(() => {
    const inRange = sessions.filter((s) => {
      if (!fromDate) return true;
      return new Date(s.session_date) >= fromDate;
    });

    // Same-size prior window (e.g. 30d immediately before fromDate) so each KPI
    // can show "Δ vs janela anterior" instead of a context-free absolute. (R52)
    const priorFrom = fromDate
      ? new Date(fromDate.getTime() - (Date.now() - fromDate.getTime()))
      : null;
    const inPrior = priorFrom
      ? sessions.filter((s) => {
          const d = new Date(s.session_date).getTime();
          return d >= priorFrom.getTime() && d < fromDate!.getTime();
        })
      : [];

    let totalSets = 0;
    let totalTonnage = 0;
    let anyWeighed = false;
    const byExercise = new Map<string, { name: string; sets: number; tonnage: number; weighed: boolean }>();
    let priorSets = 0;
    let priorTonnage = 0;
    const byWeek = new Map<string, number>();

    for (const s of inRange) {
      const wk = weekKey(new Date(s.session_date));
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
      for (const e of s.entries ?? []) {
        const lines = entrySets(e);
        let exSets = 0;
        let exTon = 0;
        let exWeighed = false;
        for (const ln of lines) {
          exSets += 1;
          const r = parseNum(ln.reps);
          const w = parseNum(ln.weight);
          if (r != null && w != null) {
            exTon += r * w;
            exWeighed = true;
          }
        }
        totalSets += exSets;
        totalTonnage += exTon;
        if (exWeighed) anyWeighed = true;
        const name = (e.exercise_name || "(unnamed)").trim();
        const cur = byExercise.get(name) ?? { name, sets: 0, tonnage: 0, weighed: false };
        cur.sets += exSets;
        cur.tonnage += exTon;
        cur.weighed = cur.weighed || exWeighed;
        byExercise.set(name, cur);
      }
    }

    for (const s of inPrior) {
      for (const e of s.entries ?? []) {
        const lines = entrySets(e);
        for (const ln of lines) {
          priorSets += 1;
          const r = parseNum(ln.reps);
          const w = parseNum(ln.weight);
          if (r != null && w != null) priorTonnage += r * w;
        }
      }
    }

    // Planned sessions in window: avg planned days/week across plans × weeks in window
    let plannedTotal = 0;
    for (const p of plans) {
      const weeks = (p.plan_data as any)?.weeks ?? [];
      const totalDays = weeks.reduce((acc: number, w: any) => acc + (w.days?.length ?? 0), 0);
      if (!fromDate) {
        plannedTotal += totalDays;
      } else {
        const days = Math.max(1, Math.round((Date.now() - fromDate.getTime()) / 86400000));
        const weeksInRange = days / 7;
        const avgPerWeek = weeks.length ? totalDays / weeks.length : 0;
        plannedTotal += avgPerWeek * weeksInRange;
      }
    }
    plannedTotal = Math.round(plannedTotal);

    const adherence = plannedTotal > 0 ? Math.min(100, Math.round((inRange.length / plannedTotal) * 100)) : null;

    // Δ helpers — null when the prior window has no signal (avoids "+∞%" lies).
    const deltaPct = (curr: number, prior: number): number | null => {
      if (!fromDate) return null;
      if (prior <= 0) return curr > 0 ? null : null;
      return Math.round(((curr - prior) / prior) * 100);
    };

    // Last 8 weeks for sparkline
    const weeksList: { key: string; count: number; label: string }[] = [];
    const today = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      const k = weekKey(d);
      weeksList.push({
        key: k,
        count: byWeek.get(k) ?? 0,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
      });
    }

    const top = Array.from(byExercise.values())
      .sort((a, b) => (b.tonnage - a.tonnage) || (b.sets - a.sets))
      .slice(0, 5);

    return {
      completed: inRange.length,
      planned: plannedTotal,
      adherence,
      totalSets,
      totalTonnage,
      anyWeighed,
      weeksList,
      top,
      lastSessionDate: inRange[0]?.session_date ?? null,
      priorCompleted: inPrior.length,
      deltaSessions: deltaPct(inRange.length, inPrior.length),
      deltaSets: deltaPct(totalSets, priorSets),
      deltaTonnage: deltaPct(totalTonnage, priorTonnage),
    };
  }, [sessions, plans, fromDate]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar adesão…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Ainda sem sessões registadas. Assim que o cliente (ou você) começar a registar a partir de um plano, o painel de adesão é preenchido automaticamente.
      </div>
    );
  }

  const maxBar = Math.max(1, ...stats.weeksList.map((w) => w.count));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Compliance</h2>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
          {(["30d", "90d", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "30d" ? "30 days" : r === "90d" ? "90 days" : "All time"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.planned > 0 ? (
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Adesão"
            value={`${stats.adherence}%`}
            hint={`${stats.completed}/${stats.planned} sessões`}
            verdict={
              stats.adherence! >= 80 ? { tone: "good", text: "no alvo" }
              : stats.adherence! >= 50 ? { tone: "warn", text: "abaixo do alvo" }
              : { tone: "bad", text: "muito abaixo" }
            }
          />
        ) : (
          <KpiCard
            icon={<CalendarCheck className="h-4 w-4" />}
            label="Consistência"
            value={String(stats.completed)}
            hint="sessões na janela"
            delta={stats.deltaSessions}
          />
        )}
        <KpiCard
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Sessões"
          value={String(stats.completed)}
          hint={stats.lastSessionDate ? `Última: ${stats.lastSessionDate}` : ""}
          delta={stats.deltaSessions}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Séries"
          value={String(stats.totalSets)}
          delta={stats.deltaSets}
        />
        <KpiCard
          icon={<Dumbbell className="h-4 w-4" />}
          label="Carga total"
          value={stats.anyWeighed ? `${Math.round(stats.totalTonnage).toLocaleString()} kg` : "—"}
          hint={!stats.anyWeighed ? "Sem cargas registadas" : ""}
          delta={stats.anyWeighed ? stats.deltaTonnage : null}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Sessões / semana (últimas 8)
          </h3>
          <SparklineWithTrend weeks={stats.weeksList} maxBar={maxBar} />
        </div>

        <TopExercisesPanel top={stats.top} />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  delta,
  verdict,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  /** Δ% vs the immediately-prior window. null = unknown (don't render). */
  delta?: number | null;
  verdict?: { tone: "good" | "warn" | "bad"; text: string };
}) {
  const trendCls =
    delta == null ? "text-muted-foreground"
      : delta > 0 ? "text-emerald-500"
      : delta < 0 ? "text-red-500"
      : "text-muted-foreground";
  const TrendIcon = delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const verdictCls =
    !verdict ? ""
      : verdict.tone === "good" ? "text-emerald-500"
      : verdict.tone === "warn" ? "text-amber-500"
      : "text-red-500";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        {TrendIcon && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${trendCls}`}>
            <TrendIcon className="h-3 w-3" />
            {delta! > 0 ? `+${delta}%` : `${delta}%`}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {verdict && (
        <p className={`mt-1 text-[11px] font-semibold ${verdictCls}`}>{verdict.text}</p>
      )}
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Bars + 3-week moving-average trend line. SVG only, no libs. */
function SparklineWithTrend({
  weeks,
  maxBar,
}: {
  weeks: { key: string; count: number; label: string }[];
  maxBar: number;
}) {
  const W = 320, H = 110, PAD = 6;
  const bw = (W - PAD * 2) / weeks.length;
  const yFor = (v: number) => H - PAD - (v / maxBar) * (H - PAD * 2);
  // 3-week moving average
  const ma = weeks.map((_, i) => {
    const slice = weeks.slice(Math.max(0, i - 2), i + 1);
    const avg = slice.reduce((a, w) => a + w.count, 0) / slice.length;
    return avg;
  });
  const linePath = ma
    .map((v, i) => `${i === 0 ? "M" : "L"} ${PAD + bw * (i + 0.5)} ${yFor(v)}`)
    .join(" ");
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full">
        {weeks.map((w, i) => {
          const h = (w.count / maxBar) * (H - PAD * 2);
          return (
            <rect
              key={w.key}
              x={PAD + bw * i + bw * 0.18}
              y={H - PAD - h}
              width={bw * 0.64}
              height={Math.max(w.count > 0 ? 2 : 0, h)}
              rx={2}
              className="fill-primary/70"
            >
              <title>{`${w.count} sessão${w.count === 1 ? "" : "ões"}`}</title>
            </rect>
          );
        })}
        <path
          d={linePath}
          fill="none"
          strokeWidth={1.5}
          className="stroke-amber-500/80"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {weeks.map((w) => (
          <span key={w.key}>{w.label}</span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Linha âmbar = média móvel de 3 semanas (tendência).
      </p>
    </div>
  );
}

/** Splits the leaderboard into "by load (kg)" and "by volume (sets)" so
 *  bodyweight exercises never get falsely compared in kilograms. (R52) */
function TopExercisesPanel({
  top,
}: {
  top: { name: string; sets: number; tonnage: number; weighed: boolean }[];
}) {
  const byLoad = [...top].filter((x) => x.weighed).sort((a, b) => b.tonnage - a.tonnage).slice(0, 5);
  const byVolume = [...top].sort((a, b) => b.sets - a.sets).slice(0, 5);
  if (top.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Top exercícios
        </h3>
        <p className="text-sm text-muted-foreground">Sem exercícios registados nesta janela.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Top exercícios
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <ExList
          title="Por carga (kg)"
          empty="Registe pesos para ver aqui."
          items={byLoad}
          metric={(x) => `${Math.round(x.tonnage).toLocaleString()} kg`}
          maxOf={(x) => x.tonnage}
        />
        <ExList
          title="Por volume (séries)"
          empty="Sem dados."
          items={byVolume}
          metric={(x) => `${x.sets} séries`}
          maxOf={(x) => x.sets}
        />
      </div>
    </div>
  );
}

function ExList({
  title,
  empty,
  items,
  metric,
  maxOf,
}: {
  title: string;
  empty: string;
  items: { name: string; sets: number; tonnage: number; weighed: boolean }[];
  metric: (x: { name: string; sets: number; tonnage: number; weighed: boolean }) => string;
  maxOf: (x: { name: string; sets: number; tonnage: number; weighed: boolean }) => number;
}) {
  if (items.length === 0) {
    return (
      <div>
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">{title}</h4>
        <p className="text-xs text-muted-foreground">{empty}</p>
      </div>
    );
  }
  const max = Math.max(1, ...items.map(maxOf));
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">{title}</h4>
      <ul className="space-y-2">
        {items.map((ex) => {
          const pct = (maxOf(ex) / max) * 100;
          return (
            <li key={ex.name} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{ex.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{metric(ex)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}