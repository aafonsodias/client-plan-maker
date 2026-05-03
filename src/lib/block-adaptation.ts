/**
 * Block adaptation — derive the prescription shift each muscle received
 * because of the prior block's verdict, and expose it for the UI.
 *
 * Single source of truth for the verdict→landmark math. `prescribe-volume`
 * imports `shiftForVerdict` from here; the UI imports `summarizeAdaptation`.
 * Silent divergence between prescription and UI would be worse than no UI.
 */

import {
  VOLUME_LANDMARKS,
  MUSCLE_GROUP_ORDER,
  MUSCLE_GROUP_LABELS_PT,
  type MuscleGroup,
  type VolumeLandmark,
} from "./volume-landmarks";
import type { BlockSummary, MuscleVerdict, MuscleSummary } from "./block-feedback";
import type { Tone } from "./status-tone";

export type Shift = {
  /** Landmark used as week-1 floor. */
  startSets: number;
  /** Landmark used as final-week ceiling. */
  ceilingSets: number;
  /** 0..1 phase position where the curve hits MAV. */
  inflection: number;
};

/**
 * Pure shift function. Mirrored exactly inside prescribe-volume's
 * targetForWeek — keep them in lockstep.
 */
export function shiftForVerdict(lm: VolumeLandmark, verdict: MuscleVerdict): Shift {
  if (verdict === "under_recovered") {
    return { startSets: lm.mev, ceilingSets: lm.mav, inflection: 0.85 };
  }
  if (verdict === "under_loaded") {
    return {
      startSets: Math.min(lm.mav, lm.mev + 2),
      ceilingSets: lm.mrv,
      inflection: 0.5,
    };
  }
  return { startSets: lm.mev, ceilingSets: lm.mrv, inflection: 0.66 };
}

export type AdaptationRow = {
  muscle: MuscleGroup;
  muscleLabel: string;
  verdict: MuscleVerdict;
  adherencePct: number;
  meanRpe: number | null;
  totalSets: number;
  baseline: Shift;
  adapted: Shift;
  /** Ceiling delta (adapted − baseline). Negative = pulled back. */
  ceilingDelta: number;
  tone: Tone;
};

const VERDICT_TONE: Record<MuscleVerdict, Tone> = {
  under_recovered: "warn",
  on_target: "success",
  under_loaded: "neutral",
};

export const VERDICT_LABEL_PT: Record<MuscleVerdict, string> = {
  under_recovered: "sob-recuperação",
  on_target: "no alvo",
  under_loaded: "sub-carregado",
};

export const VERDICT_HINT_PT: Record<MuscleVerdict, string> = {
  under_recovered: "Re-entra a MEV, tecto em MAV. Recuperar antes de empurrar.",
  on_target: "Curva normal MEV → MAV → MRV.",
  under_loaded: "Arranca acima de MEV, atinge MAV mais cedo, empurra para MRV.",
};

export function verdictTone(verdict: MuscleVerdict): Tone {
  return VERDICT_TONE[verdict];
}

export function summarizeAdaptation(feedback: BlockSummary | null | undefined): AdaptationRow[] {
  if (!feedback) return [];
  return MUSCLE_GROUP_ORDER.map((muscle) => {
    const row: MuscleSummary | undefined = feedback.perMuscle.find((p) => p.muscle === muscle);
    const verdict: MuscleVerdict = row?.verdict ?? "on_target";
    const lm = VOLUME_LANDMARKS[muscle];
    const baseline = shiftForVerdict(lm, "on_target");
    const adapted = shiftForVerdict(lm, verdict);
    return {
      muscle,
      muscleLabel: MUSCLE_GROUP_LABELS_PT[muscle],
      verdict,
      adherencePct: feedback.adherencePct,
      meanRpe: row?.meanRpe ?? null,
      totalSets: row?.totalSets ?? 0,
      baseline,
      adapted,
      ceilingDelta: adapted.ceilingSets - baseline.ceilingSets,
      tone: verdictTone(verdict),
    };
  });
}

export function dominantVerdict(feedback: BlockSummary | null | undefined): MuscleVerdict | null {
  if (!feedback) return null;
  const counts: Record<MuscleVerdict, number> = {
    under_recovered: 0,
    on_target: 0,
    under_loaded: 0,
  };
  for (const p of feedback.perMuscle) counts[p.verdict] += 1;
  // Bias toward the meaningful verdicts: if any muscle is off-target,
  // prefer that over a tie with on_target.
  if (counts.under_recovered >= counts.under_loaded && counts.under_recovered > 0) {
    return "under_recovered";
  }
  if (counts.under_loaded > 0) return "under_loaded";
  return "on_target";
}

export function verdictMixSummary(feedback: BlockSummary | null | undefined): string {
  if (!feedback) return "—";
  const counts = { under_recovered: 0, on_target: 0, under_loaded: 0 } as Record<MuscleVerdict, number>;
  for (const p of feedback.perMuscle) counts[p.verdict] += 1;
  const parts: string[] = [];
  if (counts.under_recovered) parts.push(`${counts.under_recovered} sob-rec`);
  if (counts.on_target) parts.push(`${counts.on_target} alvo`);
  if (counts.under_loaded) parts.push(`${counts.under_loaded} sub-carga`);
  return parts.join(" · ") || "—";
}