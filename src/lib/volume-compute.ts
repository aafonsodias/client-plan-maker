import {
  MUSCLE_GROUP_ORDER,
  type MuscleGroup,
  normaliseMuscle,
} from "./volume-landmarks";

/**
 * Volume aggregation derived from a phased plan structure
 * ({ weeks: [{ week_number, days: [{ exercises: [...] }] }] }).
 *
 * Counting policy (Renaissance Periodization standard):
 *   - 1.0 set per primary muscle
 *   - 0.5 set per secondary muscle
 * Set count parses "3" → 3, "3-4" → 3.5, "AMRAP" → 1, "" → 0.
 */

export type VolumeByMuscle = Record<MuscleGroup, number>;

export type ExerciseLike = {
  sets?: string | number | null;
  primary_muscles?: string[] | null;
  secondary_muscles?: string[] | null;
};

export type DayLike = {
  exercises?: ExerciseLike[] | null;
};

export type WeekLike = {
  week_number: number;
  days?: DayLike[] | null;
};

export type PlanLike = {
  weeks?: WeekLike[] | null;
};

function parseSetCount(raw: ExerciseLike["sets"]): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw);
  if (!raw || typeof raw !== "string") return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  // "3-4" or "3–4" → mean
  const range = trimmed.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  // first number wins ("3 sets", "3x10", "3" )
  const first = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (first) return Number(first[1]);
  return 0;
}

function emptyVolume(): VolumeByMuscle {
  return MUSCLE_GROUP_ORDER.reduce((acc, m) => {
    acc[m] = 0;
    return acc;
  }, {} as VolumeByMuscle);
}

export function computeVolumeForExercises(
  exercises: ExerciseLike[]
): VolumeByMuscle {
  const out = emptyVolume();
  for (const ex of exercises) {
    const sets = parseSetCount(ex.sets);
    if (sets <= 0) continue;
    const primary = (ex.primary_muscles ?? []).map(normaliseMuscle).filter(Boolean) as MuscleGroup[];
    const secondary = (ex.secondary_muscles ?? []).map(normaliseMuscle).filter(Boolean) as MuscleGroup[];
    // de-dupe within an exercise so Bench listing "chest, pecs" doesn't double
    const primarySet = new Set(primary);
    const secondarySet = new Set(secondary);
    for (const m of primarySet) out[m] += sets;
    for (const m of secondarySet) {
      if (!primarySet.has(m)) out[m] += sets * 0.5;
    }
  }
  return out;
}

export function computeWeeklyVolume(plan: PlanLike): Map<number, VolumeByMuscle> {
  const byWeek = new Map<number, VolumeByMuscle>();
  for (const w of plan.weeks ?? []) {
    const exercises: ExerciseLike[] = [];
    for (const d of w.days ?? []) {
      for (const ex of d.exercises ?? []) exercises.push(ex);
    }
    byWeek.set(w.week_number, computeVolumeForExercises(exercises));
  }
  return byWeek;
}

/** Round to 0.5 increments for display (a half-set is meaningful). */
export function roundSets(n: number): number {
  return Math.round(n * 2) / 2;
}