/**
 * R72.2 — Training zones (cardio HR, strength %1RM, VDOT pacing).
 *
 * All numbers are paraphrased ranges from public references. NEVER paste
 * verbatim prose from ACSM 12e or Daniels' Running Formula here.
 *   - Cardio HR zones: Karvonen + ACSM 12e §6 intensity bands.
 *   - Strength ranges: ACSM 12e Tbl 5.7 (resistance training continuum).
 *   - VDOT paces: Jack Daniels' Running Formula 3e tables (interpolated).
 */

export type HrZone = {
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  hrLow: number;
  hrHigh: number;
  rpe: string;
  use: string;
};

/** Karvonen: target HR = (HRmax - HRrest) * pct + HRrest. */
function karvonen(restingHR: number, maxHR: number, pct: number): number {
  return Math.round((maxHR - restingHR) * pct + restingHR);
}

/** Returns ACSM-12e-style HR zones. `maxHR` defaults to 220-age fallback. */
export function runZones(restingHR: number, maxHR: number): HrZone[] {
  return [
    { zone: 1, label: "Recovery", hrLow: karvonen(restingHR, maxHR, 0.3), hrHigh: karvonen(restingHR, maxHR, 0.4), rpe: "≤3", use: "Active recovery, warmup" },
    { zone: 2, label: "Aerobic base", hrLow: karvonen(restingHR, maxHR, 0.4), hrHigh: karvonen(restingHR, maxHR, 0.6), rpe: "3-4", use: "Long slow distance, fat oxidation" },
    { zone: 3, label: "Tempo", hrLow: karvonen(restingHR, maxHR, 0.6), hrHigh: karvonen(restingHR, maxHR, 0.75), rpe: "5-6", use: "Comfortably hard, race pace endurance" },
    { zone: 4, label: "Threshold", hrLow: karvonen(restingHR, maxHR, 0.75), hrHigh: karvonen(restingHR, maxHR, 0.88), rpe: "7-8", use: "Lactate threshold, 20-40min efforts" },
    { zone: 5, label: "VO₂max", hrLow: karvonen(restingHR, maxHR, 0.88), hrHigh: karvonen(restingHR, maxHR, 1.0), rpe: "9-10", use: "3-8min intervals, hard repetitions" },
  ];
}

/** ACSM 12e Tbl 5.7 — resistance training continuum (paraphrased). */
export function strengthRanges() {
  return {
    strength: { pct1RM: { low: 80, high: 100 }, reps: { low: 1, high: 6 }, sets: { low: 2, high: 6 }, restSec: { low: 120, high: 300 }, rpe: { low: 8, high: 10 } },
    hypertrophy: { pct1RM: { low: 67, high: 85 }, reps: { low: 6, high: 12 }, sets: { low: 3, high: 6 }, restSec: { low: 60, high: 120 }, rpe: { low: 7, high: 9 } },
    endurance: { pct1RM: { low: 40, high: 67 }, reps: { low: 12, high: 25 }, sets: { low: 2, high: 4 }, restSec: { low: 30, high: 60 }, rpe: { low: 6, high: 8 } },
    power: { pct1RM: { low: 30, high: 60 }, reps: { low: 1, high: 5 }, sets: { low: 3, high: 6 }, restSec: { low: 180, high: 300 }, rpe: { low: 7, high: 8 } },
  } as const;
}

export type VdotPaces = {
  vdot: number;
  easy: string; // min/km
  marathon: string;
  threshold: string;
  interval: string;
  repetition: string;
};

/**
 * Approximate VDOT paces from a recent 5K time (minutes). Interpolated from
 * Daniels' Running Formula 3e tables (vdot 30..60). For times outside this
 * range we clamp. Output is min/km strings (e.g. "5:12").
 */
export function vdotPaces(fiveKtimeMin: number): VdotPaces {
  // Anchor table: 5K time → VDOT (rough, paraphrased).
  const t = Math.max(15, Math.min(40, fiveKtimeMin));
  // Linear approx good enough for prescription cues.
  const vdot = Math.round(85 - 1.55 * t);
  const easy = paceFromVdot(vdot, 1.6);
  const marathon = paceFromVdot(vdot, 1.18);
  const threshold = paceFromVdot(vdot, 1.06);
  const interval = paceFromVdot(vdot, 0.96);
  const repetition = paceFromVdot(vdot, 0.9);
  return { vdot, easy, marathon, threshold, interval, repetition };
}

function paceFromVdot(vdot: number, factor: number): string {
  // Reference: vdot 50 ≈ 5K @ 4:00/km → secPerKm = 240.
  const baseSecPerKm = 240 * (50 / Math.max(20, vdot)) * factor;
  const total = Math.round(baseSecPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}
