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
): { target: number; min: number; max: number } {
  if (isDeload) {
    const t = Math.max(0, Math.round(lm.mev * 0.6));
    return { target: t, min: Math.max(0, t - 1), max: t + 1 };
  }
  // 0 → MEV, 1 → MRV, with MAV at ~2/3 of the way
  const accumWeeks = Math.max(1, totalWeeks - 1); // last week is deload
  const phase = (week - 1) / accumWeeks; // 0..1 across the accumulation
  let target: number;
  if (phase <= 0.66) {
    // MEV → MAV across the first 2/3 of the block
    target = lerp(lm.mev, lm.mav, phase / 0.66);
  } else {
    // MAV → MRV during the intensification third
    target = lerp(lm.mav, lm.mrv, (phase - 0.66) / 0.34);
  }
  const rounded = Math.round(target);
  return {
    target: rounded,
    min: Math.max(lm.mev, rounded - 2),
    max: Math.min(lm.mrv, rounded + 2),
  };
}

/**
 * Prescribe weekly volume for every tracked muscle.
 * `blockNumber` is reserved for future progressive-overload bumps across
 * mesocycles (block 2 nudges MAV by +1, etc.) — currently a no-op.
 */
export function prescribeWeek(
  week: number,
  totalWeeks: number,
  opts: { isDeload?: boolean; blockNumber?: number } = {},
): WeekPrescription {
  const isDeload = opts.isDeload ?? week === totalWeeks;
  const rows: PrescriptionRow[] = MUSCLE_GROUP_ORDER.map((muscle) => {
    const lm = VOLUME_LANDMARKS[muscle];
    const t = targetForWeek(lm, week, totalWeeks, isDeload);
    return { muscle, ...t, landmark: lm };
  });
  return { week, isDeload, rows };
}

export function prescribeMesocycle(
  totalWeeks: number,
  opts: { blockNumber?: number } = {},
): WeekPrescription[] {
  return Array.from({ length: totalWeeks }, (_, i) =>
    prescribeWeek(i + 1, totalWeeks, { blockNumber: opts.blockNumber }),
  );
}

/**
 * Render the prescription as a compact prompt block the LLM can read.
 * Format chosen to be token-cheap and unambiguous.
 */
export function prescriptionPromptBlock(
  totalWeeks: number,
  opts: { blockNumber?: number } = {},
): string {
  const meso = prescribeMesocycle(totalWeeks, opts);
  const header =
    "VOLUME PRESCRIPTION (weekly sets per muscle — HARD CONSTRAINT, not a suggestion)";
  const legend =
    "Format: muscle: w1=target(min..max) w2=... · deload weeks marked [D]";
  const lines = MUSCLE_GROUP_ORDER.map((m) => {
    const cells = meso.map((w) => {
      const row = w.rows.find((r) => r.muscle === m)!;
      const tag = w.isDeload ? "[D]" : "";
      return `w${w.week}${tag}=${row.target}(${row.min}..${row.max})`;
    }).join(" ");
    return `- ${m.padEnd(10)} ${cells}`;
  }).join("\n");
  return `${header}\n${legend}\n${lines}\nIf an exercise hits multiple muscles, primary counts 1.0 set, secondary counts 0.5 set. Stay inside (min..max) for every muscle every week.`;
}