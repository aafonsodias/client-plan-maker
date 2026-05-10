// Round C — curated skill aspiration lookup (zero AI).
// Founder-curated. New entries added manually. Substring-matched against
// keywords in PT/EN/ES. Unmatched aspirations are logged via
// `logUnmatchedAspiration` so the founder can review and curate over time.

import type { GoalCategory } from "./goal-templates";

export interface SkillAspiration {
  id: string;
  /** Match keywords (PT + EN + ES) — fuzzy lowercase substring matching. */
  keywords: string[];
  category: GoalCategory;
  default_weeks: number;
  /** Capacity domain slugs prerequisite to working this skill. */
  required_capacities: string[];
  /** Measurement test slugs to capture before starting. */
  required_measurements: string[];
  /** i18n keys (under `aspirations.<id>.*`). */
  specific_key: string;
  measurable_key: string;
  prerequisite_note_key: string;
}

function asp(
  id: string,
  keywords: string[],
  default_weeks: number,
  required_capacities: string[],
  required_measurements: string[],
): SkillAspiration {
  return {
    id,
    keywords,
    category: "skill",
    default_weeks,
    required_capacities,
    required_measurements,
    specific_key: `aspirations.${id}.specific`,
    measurable_key: `aspirations.${id}.measurable`,
    prerequisite_note_key: `aspirations.${id}.note`,
  };
}

export const SKILL_ASPIRATIONS: SkillAspiration[] = [
  asp("handstand",          ["pino", "handstand", "parada de mãos", "parada de manos"], 20,
      ["movement_quality", "muscular_strength"],
      ["overhead_mobility", "shoulder_press_strength"]),
  asp("split",              ["esparregata", "split", "frontal split", "spagat"], 24,
      ["flexibility"],
      ["sit_and_reach", "hip_abduction_rom"]),
  asp("pullup",             ["primeiro pullup", "first pullup", "pull up", "pull-up"], 12,
      ["muscular_strength", "muscular_endurance"],
      ["pullup_max", "deadhang_max"]),
  asp("muscle_up",          ["muscle up", "muscleup", "muscle-up"], 24,
      ["muscular_strength", "power"],
      ["pullup_max", "dip_max"]),
  asp("planche",            ["planche"], 36,
      ["muscular_strength", "movement_quality"],
      ["pseudo_planche_pushup", "shoulder_protraction_rom"]),
  asp("front_lever",        ["front lever"], 32,
      ["muscular_strength"],
      ["tuck_front_lever_hold", "pullup_max"]),
  asp("back_lever",         ["back lever"], 24,
      ["muscular_strength", "movement_quality"],
      ["tuck_back_lever_hold"]),
  asp("bridge",             ["ponte", "bridge", "puente"], 12,
      ["flexibility", "movement_quality"],
      ["bridge_assessment", "shoulder_extension_rom"]),
  asp("pistol_squat",       ["pistol squat", "pistol", "agachamento pistol", "agachamento numa perna"], 16,
      ["muscular_strength", "balance", "flexibility"],
      ["1rm_squat", "single_leg_balance"]),
  asp("human_flag",         ["human flag", "bandeira"], 32,
      ["muscular_strength", "movement_quality"],
      ["side_plank_max", "pullup_max"]),
  asp("single_leg_deadlift",["single leg deadlift", "peso morto unilateral", "peso-morto unilateral"], 12,
      ["muscular_strength", "balance"],
      ["1rm_deadlift", "single_leg_balance"]),
  asp("first_pushup",       ["primeira flexão", "first pushup", "primeira pushup", "primeira flexao"], 8,
      ["muscular_strength"],
      ["incline_pushup_max"]),
];

/**
 * Deterministic substring matcher. Returns the first aspiration whose
 * keywords appear in the user input (case-insensitive). No fuzzy distance,
 * no AI — predictable on purpose.
 */
export function matchAspiration(input: string): SkillAspiration | null {
  const normalized = input.trim().toLowerCase();
  if (normalized.length < 3) return null;
  for (const a of SKILL_ASPIRATIONS) {
    for (const kw of a.keywords) {
      if (normalized.includes(kw.toLowerCase())) return a;
    }
  }
  return null;
}