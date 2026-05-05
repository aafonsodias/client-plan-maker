import type { Brief } from "./schemas";
import type { ProgrammingVariables, RedFlagAccommodation } from "./schemas";

/**
 * Smart defaults for the coach-facing PROGRAMMING SETUP card.
 * Derived from the brief — coach can override every field.
 */
export function defaultProgrammingVariables(brief: Brief): ProgrammingVariables {
  const sessions = brief.sessions_per_week?.recommended ?? 3;
  let training_split: ProgrammingVariables["training_split"];
  if (sessions <= 3) training_split = "full_body";
  else if (sessions === 4) training_split = "upper_lower";
  else if (sessions === 5) training_split = "upper_lower";
  else if (sessions === 6) training_split = "ppl";
  else training_split = "ppl_x2";

  const age = brief.training_age_band;
  const rpe_ceiling = age === "beginner" ? 8.0 : age === "intermediate" ? 9.0 : 9.5;

  return {
    training_split,
    deload_frequency: "every_4_weeks",
    deload_style: "volume_reduction",
    rpe_ceiling,
    exercise_bias: "compound_first",
    intensity_volume_tradeoff: "moderate_moderate",
    wave_model: "undulating",
    autoreg_strictness: "suggested",
    cockpit_preset: "custom",
  };
}

/**
 * Heuristic default strategy per red-flag string. Coach can always override.
 */
export function defaultStrategyForFlag(flag: string): RedFlagAccommodation["strategy"] {
  const f = flag.toLowerCase();
  if (/(damage|history|previous|surgery|tear|rupture|disc)/.test(f)) return "MODIFY";
  if (/(deficit|limitation|restricted|reduced|weakness|asymmetr)/.test(f)) return "MONITOR";
  if (/(pain|acute|sharp|inflam)/.test(f)) return "AVOID";
  return "ACCOMMODATE";
}

export function defaultAccommodations(brief: Brief): RedFlagAccommodation[] {
  return (brief.red_flags ?? []).map((flag) => ({
    flag,
    strategy: defaultStrategyForFlag(flag),
    detail: "",
  }));
}

/**
 * Reconcile stored accommodations with the current red_flags list:
 * - Keep entries that still match a flag (preserve coach choices)
 * - Add defaults for new flags
 * - Drop entries whose flag was removed
 */
export function reconcileAccommodations(
  brief: Brief,
  stored: RedFlagAccommodation[] | null | undefined
): RedFlagAccommodation[] {
  const map = new Map((stored ?? []).map((a) => [a.flag, a]));
  return (brief.red_flags ?? []).map(
    (flag) =>
      map.get(flag) ?? {
        flag,
        strategy: defaultStrategyForFlag(flag),
        detail: "",
      }
  );
}

/**
 * Wave-loading periodization (Bompa & Buzzichelli 6e §7.3-7.5):
 * - Week 1: accumulate volume at moderate intensity (anchor RPE).
 * - Week 2: raise volume first (+15%), keep intensity.
 * - Week 3: keep volume, raise intensity (+0.5 RPE).
 * - Week 4: deload (volume -40%, RPE -1.5 from anchor).
 *
 * Anchor RPE varies by training age + red flags:
 * - beginner / red flag present: 5.5 (médio-leve)
 * - intermediate: 6.5 (médio)
 * - advanced: 7.0 (médio-pesado)
 */
export type WaveTier = "beginner" | "intermediate" | "advanced";
export type WaveWeek = {
  week: number;
  rpe_low: number;
  rpe_high: number;
  volume_multiplier: number;
  tag: "base" | "+volume" | "+intensity" | "deload";
};

const WAVE_ANCHOR: Record<WaveTier, number> = {
  beginner: 5.5,
  intermediate: 6.5,
  advanced: 7.0,
};

export function pickWaveTier(opts: {
  trainingAgeBand?: string | null;
  redFlagsCount?: number;
  injuryActive?: boolean;
}): WaveTier {
  if (opts.injuryActive || (opts.redFlagsCount ?? 0) >= 2) return "beginner";
  const band = (opts.trainingAgeBand ?? "").toLowerCase();
  if (band === "advanced") return "advanced";
  if (band === "beginner") return "beginner";
  return "intermediate";
}

export function computeWaveRpe(
  tier: WaveTier,
  weekN: number,
  totalWeeks: number
): WaveWeek {
  const anchor = WAVE_ANCHOR[tier];
  // Last week of any block ≥3 weeks is deload.
  const isDeload = totalWeeks >= 3 && weekN === totalWeeks;
  if (isDeload) {
    return {
      week: weekN,
      rpe_low: Math.max(4, anchor - 1.5),
      rpe_high: Math.max(5, anchor - 1.0),
      volume_multiplier: 0.6,
      tag: "deload",
    };
  }
  // W1 base, W2 +volume, W3 +intensity, then cycle if more weeks.
  const phase = ((weekN - 1) % 3) as 0 | 1 | 2;
  if (phase === 0) {
    return { week: weekN, rpe_low: anchor, rpe_high: anchor + 1, volume_multiplier: 1.0, tag: "base" };
  }
  if (phase === 1) {
    return { week: weekN, rpe_low: anchor, rpe_high: anchor + 1, volume_multiplier: 1.15, tag: "+volume" };
  }
  return { week: weekN, rpe_low: anchor + 0.5, rpe_high: anchor + 1.5, volume_multiplier: 1.15, tag: "+intensity" };
}

export type WaveModel = "linear" | "undulating" | "block" | "conjugate";
export type WaveOptions = {
  /** Wave shape — defaults to undulating (legacy behaviour). */
  model?: WaveModel;
  /** Inject a deload every N weeks (3..6). Defaults to every 4. */
  deloadEveryN?: number;
};

function deloadWeek(tier: WaveTier, weekN: number): WaveWeek {
  const anchor = WAVE_ANCHOR[tier];
  return {
    week: weekN,
    rpe_low: Math.max(4, anchor - 1.5),
    rpe_high: Math.max(5, anchor - 1.0),
    volume_multiplier: 0.6,
    tag: "deload",
  };
}

function shapeWeek(
  tier: WaveTier,
  weekN: number,
  positionInBlock: number,
  model: WaveModel,
): WaveWeek {
  const anchor = WAVE_ANCHOR[tier];
  const base: WaveWeek = {
    week: weekN, rpe_low: anchor, rpe_high: anchor + 1, volume_multiplier: 1.0, tag: "base",
  };
  if (model === "linear") {
    // Volume held; intensity climbs +0.25 RPE per week within the block.
    const bump = Math.min(1.0, positionInBlock * 0.25);
    return { ...base, rpe_low: anchor + bump, rpe_high: anchor + 1 + bump,
      tag: positionInBlock === 0 ? "base" : "+intensity" };
  }
  if (model === "block") {
    // First half of block accumulates volume, second half intensifies.
    if (positionInBlock < 2) {
      return { ...base, volume_multiplier: 1.0 + 0.075 * positionInBlock, tag: positionInBlock === 0 ? "base" : "+volume" };
    }
    return { ...base, rpe_low: anchor + 0.5, rpe_high: anchor + 1.5, volume_multiplier: 1.1, tag: "+intensity" };
  }
  // undulating + conjugate (conjugate falls back to undulating until day-tagging lands).
  const phase = (positionInBlock % 3) as 0 | 1 | 2;
  if (phase === 0) return base;
  if (phase === 1) return { ...base, volume_multiplier: 1.15, tag: "+volume" };
  return { ...base, rpe_low: anchor + 0.5, rpe_high: anchor + 1.5, volume_multiplier: 1.15, tag: "+intensity" };
}

/**
 * Build a wave plan honouring the cockpit knobs. Backwards-compatible:
 * `buildWavePlan(tier, weeks)` still works (defaults to undulating, deload at end).
 */
export function buildWavePlan(
  tier: WaveTier,
  totalWeeks: number,
  opts: WaveOptions = {},
): WaveWeek[] {
  const model: WaveModel = opts.model ?? "undulating";
  const deloadEveryN = Math.min(6, Math.max(3, opts.deloadEveryN ?? 4));
  const out: WaveWeek[] = [];
  let positionInBlock = 0;
  for (let w = 1; w <= totalWeeks; w++) {
    const isDeloadWeek =
      totalWeeks >= 3 &&
      (w === totalWeeks || (w > 1 && (w - 1) % deloadEveryN === deloadEveryN - 1 && w !== totalWeeks - 1));
    if (isDeloadWeek) {
      out.push(deloadWeek(tier, w));
      positionInBlock = 0;
    } else {
      out.push(shapeWeek(tier, w, positionInBlock, model));
      positionInBlock++;
    }
  }
  return out;
}