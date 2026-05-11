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
  // Mode-specific (all optional)
  duration_s?: number;
  distance_m?: number;
  avg_hr?: number;
  rounds?: number;
  work_s?: number;
  rest_s?: number;
  hold_s?: number;
};

export type LoggerMode =
  | "strength"
  | "hypertrophy"
  | "cardio"
  | "intervals"
  | "mobility"
  | "skill"
  | "mixed";

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
  onSetKeyDown,
  mode = "strength",
}: {
  entry: LogEntryV2;
  index: number;
  onChange: (i: number, next: LogEntryV2) => void;
  token: string;
  planId: string;
  onSetKeyDown?: (
    ev: React.KeyboardEvent<HTMLInputElement>,
    setIndex: number,
    field: "reps" | "weight" | "rpe",
  ) => void;
  mode?: LoggerMode;
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
    const sets = entry.sets.map((s, i) => {
      if (i !== si) return s;
      const merged = { ...s, ...patch } as SetLog;
      // Auto-mark done when all required cells for the current mode are filled.
      // Never auto-uncheck — the trainer can still toggle manually.
      if (!merged.done && isRowComplete(mode, merged)) {
        merged.done = true;
        merged.ts = new Date().toISOString();
        setPoppedSet(si);
        setTimeout(() => setPoppedSet(null), 260);
      }
      return merged;
    });
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
          <SetRow
            key={si}
            mode={mode}
            set={s}
            setIndex={si}
            entryIndex={index}
            popped={poppedSet === si}
            onToggleDone={() => toggleDone(si)}
            onPatch={(patch) => updateSet(si, patch)}
            onKey={onSetKeyDown}
            showRpe={!!entry.planned.rpe || mode === "strength" || mode === "hypertrophy"}
          />
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

/* ─────────── SetRow — branches by logger mode ─────────── */

type NumPatch = Partial<SetLog>;

function isRowComplete(mode: LoggerMode, s: SetLog): boolean {
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
  const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  switch (mode) {
    case "cardio":
      return num(s.duration_s) && num(s.distance_m);
    case "intervals":
      return num(s.rounds) && num(s.work_s) && num(s.rest_s);
    case "mobility":
    case "skill":
      return num(s.hold_s);
    default:
      // strength / hypertrophy / mixed
      return str(s.reps) && str(s.weight);
  }
}

function parseIntSafe(v: string): number | undefined {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
function parseFloatSafe(v: string): number | undefined {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
function mmssToSeconds(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(\d+):(\d{1,2})$/);
  if (!m) return undefined;
  const mm = Number(m[1]);
  const ss = Number(m[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss >= 60) return undefined;
  return mm * 60 + ss;
}
function secondsToMmss(s: number | undefined): string {
  if (typeof s !== "number" || !Number.isFinite(s)) return "";
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function DoneToggle({
  done,
  index,
  popped,
  onClick,
}: {
  done: boolean;
  index: number;
  popped: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={done ? "Desmarcar set" : "Marcar set como feito"}
      className={
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition sm:h-7 sm:w-7 " +
        (done
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-border bg-background text-muted-foreground hover:border-emerald-500/60") +
        (popped ? " animate-set-tick" : "")
      }
    >
      {done ? <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={3} /> : <span className="text-xs font-bold sm:text-[10px]">{index + 1}</span>}
    </button>
  );
}

function SetRow({
  mode,
  set,
  setIndex,
  entryIndex,
  popped,
  onToggleDone,
  onPatch,
  onKey,
  showRpe,
}: {
  mode: LoggerMode;
  set: SetLog;
  setIndex: number;
  entryIndex: number;
  popped: boolean;
  onToggleDone: () => void;
  onPatch: (patch: NumPatch) => void;
  onKey?: (ev: React.KeyboardEvent<HTMLInputElement>, si: number, f: "reps" | "weight" | "rpe") => void;
  showRpe: boolean;
}) {
  const inputCls =
    "h-9 rounded border border-input bg-background px-2 text-sm tabular-nums sm:h-7";

  // CARDIO — duração · distância (km) · FC
  if (mode === "cardio") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 py-1.5">
        <DoneToggle done={set.done} index={setIndex} popped={popped} onClick={onToggleDone} />
        <input
          className={`${inputCls} w-20`}
          placeholder="mm:ss"
          inputMode="numeric"
          value={secondsToMmss(set.duration_s)}
          onChange={(ev) => onPatch({ duration_s: mmssToSeconds(ev.target.value) })}
        />
        <span className="text-[10px] text-muted-foreground">·</span>
        <input
          className={`${inputCls} w-20`}
          placeholder="km"
          inputMode="decimal"
          value={typeof set.distance_m === "number" ? String(set.distance_m / 1000) : ""}
          onChange={(ev) => {
            const km = parseFloatSafe(ev.target.value);
            onPatch({ distance_m: typeof km === "number" ? Math.round(km * 1000) : undefined });
          }}
        />
        <span className="text-[10px] text-muted-foreground">·</span>
        <input
          className={`${inputCls} w-16`}
          placeholder="bpm"
          inputMode="numeric"
          value={typeof set.avg_hr === "number" ? String(set.avg_hr) : ""}
          onChange={(ev) => onPatch({ avg_hr: parseIntSafe(ev.target.value) })}
        />
        {showRpe && (
          <input
            className={`${inputCls} w-12 text-center`}
            placeholder="RPE"
            inputMode="decimal"
            value={set.rpe ?? ""}
            onChange={(ev) => onPatch({ rpe: ev.target.value })}
          />
        )}
      </div>
    );
  }

  // INTERVALS — rondas × trabalho/descanso
  if (mode === "intervals") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 py-1.5">
        <DoneToggle done={set.done} index={setIndex} popped={popped} onClick={onToggleDone} />
        <input
          className={`${inputCls} w-14 text-center`}
          placeholder="rondas"
          inputMode="numeric"
          value={typeof set.rounds === "number" ? String(set.rounds) : ""}
          onChange={(ev) => onPatch({ rounds: parseIntSafe(ev.target.value) })}
        />
        <span className="text-[10px] text-muted-foreground">×</span>
        <input
          className={`${inputCls} w-16`}
          placeholder="trab s"
          inputMode="numeric"
          value={typeof set.work_s === "number" ? String(set.work_s) : ""}
          onChange={(ev) => onPatch({ work_s: parseIntSafe(ev.target.value) })}
        />
        <span className="text-[10px] text-muted-foreground">/</span>
        <input
          className={`${inputCls} w-16`}
          placeholder="desc s"
          inputMode="numeric"
          value={typeof set.rest_s === "number" ? String(set.rest_s) : ""}
          onChange={(ev) => onPatch({ rest_s: parseIntSafe(ev.target.value) })}
        />
        {showRpe && (
          <input
            className={`${inputCls} w-12 text-center`}
            placeholder="RPE"
            inputMode="decimal"
            value={set.rpe ?? ""}
            onChange={(ev) => onPatch({ rpe: ev.target.value })}
          />
        )}
      </div>
    );
  }

  // MOBILITY / SKILL — duração apenas
  if (mode === "mobility" || mode === "skill") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 py-1.5">
        <DoneToggle done={set.done} index={setIndex} popped={popped} onClick={onToggleDone} />
        <input
          className={`${inputCls} w-24`}
          placeholder="mm:ss · hold"
          inputMode="numeric"
          value={secondsToMmss(set.hold_s)}
          onChange={(ev) => onPatch({ hold_s: mmssToSeconds(ev.target.value) })}
        />
      </div>
    );
  }

  // STRENGTH / HYPERTROPHY / MIXED — reps × peso (+ RPE)
  return (
    <div className="flex items-center gap-2 py-1.5">
      <DoneToggle done={set.done} index={setIndex} popped={popped} onClick={onToggleDone} />
      <input
        className={`${inputCls} w-14 text-center`}
        placeholder="reps"
        inputMode="numeric"
        value={set.reps}
        onChange={(ev) => onPatch({ reps: ev.target.value })}
        onKeyDown={(ev) => onKey?.(ev, setIndex, "reps")}
        data-set-input={`${entryIndex}:${setIndex}:reps`}
      />
      <span className="text-[10px] text-muted-foreground">×</span>
      <input
        className={`${inputCls} w-20`}
        placeholder="kg"
        inputMode="decimal"
        value={set.weight}
        onChange={(ev) => onPatch({ weight: ev.target.value })}
        onKeyDown={(ev) => onKey?.(ev, setIndex, "weight")}
        data-set-input={`${entryIndex}:${setIndex}:weight`}
      />
      {showRpe && (
        <input
          className={`${inputCls} w-12 text-center`}
          placeholder="RPE"
          inputMode="decimal"
          value={set.rpe ?? ""}
          onChange={(ev) => onPatch({ rpe: ev.target.value })}
          onKeyDown={(ev) => onKey?.(ev, setIndex, "rpe")}
          data-set-input={`${entryIndex}:${setIndex}:rpe`}
        />
      )}
    </div>
  );
}