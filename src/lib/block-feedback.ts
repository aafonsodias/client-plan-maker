import { MUSCLE_GROUP_ORDER, type MuscleGroup } from "./volume-landmarks";

/**
 * Summarise how the prior block actually went so the next block's volume
 * prescription can adapt. We classify each muscle as:
 *   - under_recovered  → pulled back to MEV, slower curve
 *   - on_target        → continue MEV → MAV → MRV curve
 *   - under_loaded     → start above MEV, push faster toward MRV
 *
 * Inputs come straight from `workout_sessions.entries` (the same shape the
 * logbook writes).
 */

export type MuscleVerdict = "under_recovered" | "on_target" | "under_loaded";

export type MuscleSummary = {
  muscle: MuscleGroup;
  meanRpe: number | null;
  totalSets: number;
  verdict: MuscleVerdict;
};

export type BlockSummary = {
  adherencePct: number;
  totalSessions: number;
  completedSessions: number;
  perMuscle: MuscleSummary[];
};

type SessionLike = {
  status?: string | null;
  entries?: any;
};

function inferMuscleFromName(name: string): MuscleGroup | null {
  const n = (name || "").toLowerCase();
  if (/agachamento|squat|leg press|hack|lunge|afundo/.test(n)) return "quads";
  if (/leg curl|deadlift|romanian|peso morto|stiff|nordic/.test(n)) return "hamstrings";
  if (/hip thrust|glute|elev[a|á]ç[a|ã]o p[e|é]lvica|abdução/.test(n)) return "glutes";
  if (/bench|supino|press peitoral|chest|fly|crucifixo/.test(n)) return "chest";
  if (/row|remada|pull[- ]?down|pulldown|chin|pull[- ]?up|barra fixa/.test(n)) return "back";
  if (/overhead|shoulder press|press militar|lateral raise|elev[a|á]ç[a|ã]o lateral/.test(n)) return "shoulders";
  if (/curl|bicep|rosca/.test(n)) return "biceps";
  if (/triceps|tr[i|í]cipe|push[- ]?down|french|skull/.test(n)) return "triceps";
  if (/calf|gémeo|gemeo|panturrilha/.test(n)) return "calves";
  if (/plank|prancha|crunch|abdom|core|pallof|hollow/.test(n)) return "core";
  return null;
}

function classify(meanRpe: number | null, adherencePct: number): MuscleVerdict {
  if (adherencePct < 70) return "under_recovered";
  if (meanRpe !== null && meanRpe >= 9) return "under_recovered";
  if (meanRpe !== null && meanRpe <= 6.5) return "under_loaded";
  return "on_target";
}

export function summarizePriorBlock(sessions: SessionLike[]): BlockSummary {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "done").length;
  const adherencePct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Per-muscle aggregation
  const buckets = new Map<MuscleGroup, { rpes: number[]; sets: number }>();
  for (const m of MUSCLE_GROUP_ORDER) buckets.set(m, { rpes: [], sets: 0 });

  for (const s of sessions) {
    const entries = (s.entries ?? []) as any[];
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const muscle: MuscleGroup | null =
        (e?.primary_muscle && MUSCLE_GROUP_ORDER.includes(e.primary_muscle as MuscleGroup)
          ? (e.primary_muscle as MuscleGroup)
          : null) ?? inferMuscleFromName(e?.exercise ?? e?.name ?? "");
      if (!muscle) continue;
      const sets = Array.isArray(e?.sets) ? e.sets : [];
      const b = buckets.get(muscle)!;
      b.sets += sets.length;
      for (const set of sets) {
        const rpe = Number(set?.rpe);
        if (Number.isFinite(rpe)) b.rpes.push(rpe);
      }
    }
  }

  const perMuscle: MuscleSummary[] = MUSCLE_GROUP_ORDER.map((muscle) => {
    const b = buckets.get(muscle)!;
    const meanRpe = b.rpes.length > 0 ? b.rpes.reduce((a, c) => a + c, 0) / b.rpes.length : null;
    return {
      muscle,
      meanRpe: meanRpe !== null ? Number(meanRpe.toFixed(2)) : null,
      totalSets: b.sets,
      verdict: classify(meanRpe, adherencePct),
    };
  });

  return { adherencePct, totalSessions, completedSessions, perMuscle };
}

export function verdictLabelPt(v: MuscleVerdict): string {
  switch (v) {
    case "under_recovered":
      return "sob-recuperação";
    case "under_loaded":
      return "sub-carregado";
    default:
      return "no alvo";
  }
}