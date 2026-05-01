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