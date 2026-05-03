/**
 * Prescriptive weekly set targets per muscle, derived from MEV/MAV/MRV
 * landmarks and the position of the week inside the mesocycle.
 *
 * This is the *input* to Stage 2/3 generation — the AI must hit these
 * targets, not improvise. The post-hoc volume validator becomes a safety
 * net rather than the source of truth.
 *
 * Phase model (4-week accumulation block by default):
 *   week 1   → MEV         (entry / re-introduction)
 *   week 2   → MEV + 25%   (rising)
 *   week 3   → MAV         (peak adaptive)
 *   week 4   → MAV→MRV     (overload, intensification)
 *   deload   → MEV * 0.6   (planned dip)
 *
 * For longer mesocycles we stretch the curve linearly between MEV and MRV
 * and place a deload on the final week.
 */

import {
  VOLUME_LANDMARKS,
  MUSCLE_GROUP_ORDER,
  type MuscleGroup,
  type VolumeLandmark,
} from "./volume-landmarks";
import type { BlockSummary, MuscleVerdict } from "./block-feedback";

export type PrescriptionRow = {
  muscle: MuscleGroup;
  target: number;
  min: number;
  max: number;
  landmark: VolumeLandmark;
};

export type WeekPrescription = {
  week: number;
  isDeload: boolean;
  rows: PrescriptionRow[];
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function targetForWeek(
  lm: VolumeLandmark,
  week: number,
  totalWeeks: number,
  isDeload: boolean,
  verdict: MuscleVerdict = "on_target",
): { target: number; min: number; max: number } {
  if (isDeload) {
    const t = Math.max(0, Math.round(lm.mev * 0.6));
    return { target: t, min: Math.max(0, t - 1), max: t + 1 };
  }
  // 0 → start, 1 → ceiling, with MAV at the inflection (~2/3 by default).
  // Verdict from prior block shifts both endpoints and inflection so
  // sub-recovered muscles re-enter at MEV with shorter accumulation, and
  // under-loaded muscles start above MEV and reach MRV faster.
  const accumWeeks = Math.max(1, totalWeeks - 1); // last week is deload
  const phase = (week - 1) / accumWeeks; // 0..1 across the accumulation
  let startLandmark = lm.mev;
  let ceilingLandmark = lm.mrv;
  let inflection = 0.66;
  if (verdict === "under_recovered") {
    startLandmark = lm.mev;
    ceilingLandmark = lm.mav; // never push past MAV in a recovery block
    inflection = 0.85; // most of the block sits between MEV and MAV
  } else if (verdict === "under_loaded") {
    startLandmark = Math.min(lm.mav, lm.mev + 2);
    ceilingLandmark = lm.mrv;
    inflection = 0.5; // hit MAV by mid-block, then push to MRV
  }
  let target: number;
  if (phase <= inflection) {
    target = lerp(startLandmark, lm.mav, phase / inflection);
  } else {
    target = lerp(lm.mav, ceilingLandmark, (phase - inflection) / Math.max(0.01, 1 - inflection));
  }
  const rounded = Math.round(target);
  return {
    target: rounded,
    min: Math.max(lm.mev, rounded - 2),
    max: Math.min(ceilingLandmark, rounded + 2),
  };
}

/**
 * Prescribe weekly volume for every tracked muscle.
 * `blockNumber` is reserved for future progressive-overload bumps across
 * mesocycles (block 2 nudges MAV by +1, etc.) — currently a no-op.
 */
type PrescribeOpts = {
  isDeload?: boolean;
  blockNumber?: number;
  priorSummary?: BlockSummary | null;
};

function verdictFor(opts: PrescribeOpts, muscle: MuscleGroup): MuscleVerdict {
  const row = opts.priorSummary?.perMuscle.find((p) => p.muscle === muscle);
  return row?.verdict ?? "on_target";
}

export function prescribeWeek(
  week: number,
  totalWeeks: number,
  opts: PrescribeOpts = {},
): WeekPrescription {
  const isDeload = opts.isDeload ?? week === totalWeeks;
  const rows: PrescriptionRow[] = MUSCLE_GROUP_ORDER.map((muscle) => {
    const lm = VOLUME_LANDMARKS[muscle];
    const t = targetForWeek(lm, week, totalWeeks, isDeload, verdictFor(opts, muscle));
    return { muscle, ...t, landmark: lm };
  });
  return { week, isDeload, rows };
}

export function prescribeMesocycle(
  totalWeeks: number,
  opts: PrescribeOpts = {},
): WeekPrescription[] {
  return Array.from({ length: totalWeeks }, (_, i) =>
    prescribeWeek(i + 1, totalWeeks, opts),
  );
}

/**
 * Render the prescription as a compact prompt block the LLM can read.
 * Format chosen to be token-cheap and unambiguous.
 */
export function prescriptionPromptBlock(
  totalWeeks: number,
  opts: PrescribeOpts = {},
): string {
  const meso = prescribeMesocycle(totalWeeks, opts);
  const header =
    "VOLUME PRESCRIPTION (weekly sets per muscle — HARD CONSTRAINT, not a suggestion)";
  const legend =
    "Format: muscle: w1=target(min..max) w2=... · deload weeks marked [D]";
  const adaptationNote = opts.priorSummary
    ? `\nADAPTATION CONTEXT: prior block adherence ${opts.priorSummary.adherencePct}%. Per-muscle verdicts: ${opts.priorSummary.perMuscle
        .filter((p) => p.verdict !== "on_target")
        .map((p) => `${p.muscle}=${p.verdict}`)
        .join(", ") || "all on target"}.`
    : "";
  const lines = MUSCLE_GROUP_ORDER.map((m) => {
    const cells = meso.map((w) => {
      const row = w.rows.find((r) => r.muscle === m)!;
      const tag = w.isDeload ? "[D]" : "";
      return `w${w.week}${tag}=${row.target}(${row.min}..${row.max})`;
    }).join(" ");
    return `- ${m.padEnd(10)} ${cells}`;
  }).join("\n");
  return `${header}${adaptationNote}\n${legend}\n${lines}\nIf an exercise hits multiple muscles, primary counts 1.0 set, secondary counts 0.5 set. Stay inside (min..max) for every muscle every week.`;
}