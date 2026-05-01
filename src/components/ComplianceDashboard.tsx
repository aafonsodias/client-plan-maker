import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Activity, Dumbbell, CalendarCheck } from "lucide-react";
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

    let totalSets = 0;
    let totalTonnage = 0;
    let anyWeighed = false;
    const byExercise = new Map<string, { name: string; sets: number; tonnage: number; weighed: boolean }>();
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
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Adherence"
          value={stats.adherence != null ? `${stats.adherence}%` : "—"}
          hint={stats.planned > 0 ? `${stats.completed}/${stats.planned} sessions` : "No plan baseline"}
        />
        <KpiCard
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Sessions"
          value={String(stats.completed)}
          hint={stats.lastSessionDate ? `Last: ${stats.lastSessionDate}` : ""}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Total sets"
          value={String(stats.totalSets)}
        />
        <KpiCard
          icon={<Dumbbell className="h-4 w-4" />}
          label="Tonnage"
          value={stats.anyWeighed ? `${Math.round(stats.totalTonnage).toLocaleString()} kg` : "—"}
          hint={!stats.anyWeighed ? "Log weights to track" : ""}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Sessions / week (last 8w)
          </h3>
          <div className="flex h-32 items-end gap-2">
            {stats.weeksList.map((w) => (
              <div key={w.key} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-sm bg-primary/80 transition-all"
                    style={{ height: `${(w.count / maxBar) * 100}%`, minHeight: w.count > 0 ? "4px" : "0" }}
                    title={`${w.count} session${w.count === 1 ? "" : "s"}`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{w.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Top exercises by volume
          </h3>
          {stats.top.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exercises logged in this window.</p>
          ) : (
            <ul className="space-y-2">
              {stats.top.map((ex) => {
                const maxTon = stats.top[0].tonnage || 1;
                const pct = ex.weighed ? (ex.tonnage / maxTon) * 100 : (ex.sets / Math.max(...stats.top.map((e) => e.sets))) * 100;
                return (
                  <li key={ex.name} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{ex.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {ex.sets} sets {ex.weighed ? `· ${Math.round(ex.tonnage).toLocaleString()} kg` : ""}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}