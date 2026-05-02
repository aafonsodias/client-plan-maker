import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  PlayCircle,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { exerciseDemoUrl } from "@/lib/exercise-demo";
import { getExerciseHistory } from "@/server/sessions.functions";
import { AutoTextarea } from "@/components/AutoTextarea";

/* ─────────── Types (mirror server SetLogSchema) ─────────── */

export type SetLog = {
  reps: string;
  weight: string;
  rpe?: string;
  done: boolean;
  ts?: string | null;
};

export type LogEntryV2 = {
  exercise_name: string;
  planned: { sets: string; reps: string; rpe?: string; rest?: string; notes?: string };
  sets: SetLog[];
  felt?: "easy" | "right" | "hard";
  notes: string;
};

/* ─────────── Helpers ─────────── */

/** Best top-set proxy = max(weight × reps) across the sets list. Treats
 *  AMRAP/blank reps as 0 so PRs require explicit numeric load. */
function topSetVolume(sets: Array<{ reps: string; weight: string }>): number {
  let best = 0;
  for (const s of sets) {
    const r = parseFloat(String(s.reps ?? "").replace(",", "."));
    const wRaw = String(s.weight ?? "")
      .toLowerCase()
      .replace(/\s+/g, "");
    // strip kg/lb/bw — convert lb to kg for comparison
    const numMatch = wRaw.match(/-?\d+(\.\d+)?/);
    if (!numMatch) continue;
    let w = parseFloat(numMatch[0]);
    if (wRaw.includes("lb")) w *= 0.4536;
    if (Number.isFinite(r) && Number.isFinite(w) && r > 0 && w > 0) {
      best = Math.max(best, r * w);
    }
  }
  return best;
}

function relativeWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "há 1 semana" : `há ${weeks} semanas`;
}

/* ─────────── Component ─────────── */

export function ExerciseSetsCard({
  entry,
  index,
  onChange,
  token,
  planId,
}: {
  entry: LogEntryV2;
  index: number;
  onChange: (i: number, next: LogEntryV2) => void;
  token: string;
  planId: string;
}) {
  const fetchHistory = useServerFn(getExerciseHistory);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getExerciseHistory>>>([]);
  const [poppedSet, setPoppedSet] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchHistory({
          data: { token, plan_id: planId, exercise_name: entry.exercise_name, limit: 5 },
        });
        if (!cancelled) setHistory(rows);
      } catch {
        /* silent — history is decorative */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.exercise_name, planId, token, fetchHistory]);

  const last = history[0];
  const lastTopSet = useMemo(() => {
    if (!last) return null;
    if (last.sets?.length) {
      // Pick the heaviest done set
      const done = last.sets.filter((s: any) => s.done && s.weight);
      if (!done.length) return null;
      const sorted = [...done].sort(
        (a: any, b: any) => topSetVolume([b]) - topSetVolume([a]),
      );
      return { reps: sorted[0].reps, weight: sorted[0].weight, when: last.session_date };
    }
    if (last.actual?.weight) {
      return {
        reps: last.actual.reps || last.actual.sets || "",
        weight: last.actual.weight,
        when: last.session_date,
      };
    }
    return null;
  }, [last]);

  // PR detection: best historical volume vs current entry top set
  const historicalBest = useMemo(() => {
    let best = 0;
    for (const h of history) {
      const sets = h.sets?.length
        ? h.sets.filter((s: any) => s.done)
        : h.actual
          ? [{ reps: h.actual.reps, weight: h.actual.weight }]
          : [];
      best = Math.max(best, topSetVolume(sets as any));
    }
    return best;
  }, [history]);

  const currentTop = useMemo(
    () => topSetVolume(entry.sets.filter((s) => s.done)),
    [entry.sets],
  );

  const isPR = currentTop > 0 && currentTop > historicalBest;

  // Trend arrow: compare current top to last session's top
  const trend: "up" | "flat" | "down" | null = useMemo(() => {
    if (!last || currentTop === 0) return null;
    const lastSets = last.sets?.length
      ? last.sets.filter((s: any) => s.done)
      : last.actual
        ? [{ reps: last.actual.reps, weight: last.actual.weight }]
        : [];
    const lastTop = topSetVolume(lastSets as any);
    if (lastTop === 0) return null;
    const diff = (currentTop - lastTop) / lastTop;
    if (diff > 0.03) return "up";
    if (diff < -0.03) return "down";
    return "flat";
  }, [last, currentTop]);

  const doneCount = entry.sets.filter((s) => s.done).length;
  const total = entry.sets.length;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const updateSet = (si: number, patch: Partial<SetLog>) => {
    const sets = entry.sets.map((s, i) => (i === si ? { ...s, ...patch } : s));
    onChange(index, { ...entry, sets });
  };

  const toggleDone = (si: number) => {
    const cur = entry.sets[si];
    const nextDone = !cur.done;
    updateSet(si, { done: nextDone, ts: nextDone ? new Date().toISOString() : null });
    if (nextDone) {
      setPoppedSet(si);
      setTimeout(() => setPoppedSet(null), 260);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {/* progress bar */}
      <div className="h-0.5 w-full bg-border/40">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* header */}
      <div className="flex items-start justify-between gap-3 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{entry.exercise_name}</h3>
            {isPR && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-400"
                title="Personal record!"
              >
                <Trophy className="h-2.5 w-2.5" /> PR
              </span>
            )}
            {trend && !isPR && (
              <span
                className={
                  "inline-flex items-center " +
                  (trend === "up"
                    ? "text-emerald-500"
                    : trend === "down"
                      ? "text-amber-500"
                      : "text-muted-foreground")
                }
                title={
                  trend === "up"
                    ? "Acima da última sessão"
                    : trend === "down"
                      ? "Abaixo da última sessão"
                      : "Igual à última sessão"
                }
              >
                {trend === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trend === "down" ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Alvo: {entry.planned.sets || "—"} × {entry.planned.reps || "—"}
            {entry.planned.rpe ? ` @ RPE ${entry.planned.rpe}` : ""}
            {entry.planned.rest ? ` · descanso ${entry.planned.rest}` : ""}
          </p>
          {lastTopSet && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">
              Última vez: {lastTopSet.reps} × {lastTopSet.weight}
              <span className="text-muted-foreground/60"> · {relativeWhen(lastTopSet.when)}</span>
            </p>
          )}
        </div>
        {exerciseDemoUrl(entry.exercise_name) && (
          <a
            href={exerciseDemoUrl(entry.exercise_name) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-accent hover:text-accent"
            title="Ver demonstração"
          >
            <PlayCircle className="h-3 w-3" /> Demo
          </a>
        )}
      </div>

      {/* sets */}
      <div className="mt-2 divide-y divide-border/40 px-3 pb-2">
        {entry.sets.map((s, si) => (
          <div key={si} className="flex items-center gap-2 py-1.5">
            <button
              type="button"
              onClick={() => toggleDone(si)}
              aria-label={s.done ? "Desmarcar set" : "Marcar set como feito"}
              className={
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition " +
                (s.done
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border bg-background text-muted-foreground hover:border-emerald-500/60") +
                (poppedSet === si ? " animate-set-tick" : "")
              }
            >
              {s.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="text-[10px] font-bold">{si + 1}</span>}
            </button>
            <input
              className="h-7 w-14 rounded border border-input bg-background px-1 text-center text-sm tabular-nums"
              placeholder="reps"
              value={s.reps}
              onChange={(ev) => updateSet(si, { reps: ev.target.value })}
            />
            <span className="text-[10px] text-muted-foreground">×</span>
            <input
              className="h-7 w-20 rounded border border-input bg-background px-1.5 text-sm"
              placeholder="kg"
              value={s.weight}
              onChange={(ev) => updateSet(si, { weight: ev.target.value })}
            />
            {entry.planned.rpe && (
              <input
                className="h-7 w-12 rounded border border-input bg-background px-1 text-center text-sm tabular-nums"
                placeholder="RPE"
                value={s.rpe ?? ""}
                onChange={(ev) => updateSet(si, { rpe: ev.target.value })}
              />
            )}
          </div>
        ))}
      </div>

      {/* footer: felt + notes */}
      <div className="space-y-1.5 border-t border-border/40 bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Como sentiste?</span>
          {(["easy", "right", "hard"] as const).map((k) => {
            const emoji = k === "easy" ? "😌" : k === "right" ? "🎯" : "😵‍💫";
            const active = entry.felt === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onChange(index, { ...entry, felt: active ? undefined : k })}
                className={
                  "rounded-full border px-2 py-0.5 text-sm leading-none transition " +
                  (active
                    ? "border-accent bg-accent/15"
                    : "border-transparent hover:border-border")
                }
                aria-label={k}
              >
                {emoji}
              </button>
            );
          })}
        </div>
        <AutoTextarea
          minRows={1}
          className="text-xs py-1"
          placeholder="Notas (opcional)…"
          value={entry.notes}
          onChange={(ev) => onChange(index, { ...entry, notes: ev.target.value })}
        />
      </div>
    </div>
  );
}