import {
  computeVolumeForExercises,
  type ExerciseLike,
  type PlanLike,
  type VolumeByMuscle,
} from "./volume-compute";
import { MUSCLE_GROUP_ORDER, type MuscleGroup } from "./volume-landmarks";

/**
 * Volume realizado — conta apenas séries efectivamente logadas em workout_sessions.
 * Cruza com o plano para ler primary/secondary muscles do exercício prescrito.
 */

type SessionLike = {
  week_number: number;
  status?: string | null;
  entries?: Array<{
    exercise_name?: string;
    sets?: Array<{ reps?: number; weight?: number; rpe?: number }>;
    actual?: { sets?: string | number; reps?: string | number; weight?: string | number };
  }> | null;
};

function emptyVolume(): VolumeByMuscle {
  return MUSCLE_GROUP_ORDER.reduce((a, m) => {
    a[m] = 0;
    return a;
  }, {} as VolumeByMuscle);
}

function actualSetCount(entry: any): number {
  // Prefer explicit `sets` array length when present
  if (Array.isArray(entry?.sets) && entry.sets.length > 0) {
    return entry.sets.filter((s: any) => s && (s.reps != null || s.weight != null)).length;
  }
  const raw = entry?.actual?.sets;
  if (typeof raw === "number") return Math.max(0, raw);
  if (typeof raw === "string") {
    const m = raw.match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  return 0;
}

/** Index plan exercises by lowercased name → muscles. */
function indexPlanExercises(plan: PlanLike): Map<string, ExerciseLike> {
  const map = new Map<string, ExerciseLike>();
  for (const w of plan.weeks ?? []) {
    for (const d of w.days ?? []) {
      for (const ex of d.exercises ?? []) {
        const name = String((ex as any).exercise_name ?? (ex as any).name ?? "").trim().toLowerCase();
        if (!name) continue;
        if (!map.has(name)) map.set(name, ex);
      }
    }
  }
  return map;
}

export function computeWeeklyActualVolume(
  plan: PlanLike,
  sessions: SessionLike[],
): Map<number, VolumeByMuscle> {
  const exIndex = indexPlanExercises(plan);
  const byWeek = new Map<number, VolumeByMuscle>();
  for (const s of sessions) {
    if (s.status === "missed") continue;
    const wk = s.week_number;
    const exercises: ExerciseLike[] = [];
    for (const e of s.entries ?? []) {
      const sets = actualSetCount(e);
      if (sets <= 0) continue;
      const name = String(e.exercise_name ?? "").trim().toLowerCase();
      const ref = name ? exIndex.get(name) : undefined;
      exercises.push({
        sets,
        primary_muscles: ref?.primary_muscles ?? null,
        secondary_muscles: ref?.secondary_muscles ?? null,
      });
    }
    const v = computeVolumeForExercises(exercises);
    const cur = byWeek.get(wk) ?? emptyVolume();
    for (const m of MUSCLE_GROUP_ORDER) cur[m] += v[m];
    byWeek.set(wk, cur);
  }
  return byWeek;
}