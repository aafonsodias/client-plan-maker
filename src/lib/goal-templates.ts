// Round X — SMART goal templates.
// Schema follows the round spec; i18n keys live under `assessment.goals.tpl.<id>.*`
// and category labels under `assessment.goals.cat.<category>`.

export type GoalCategory =
  | "cardiovascular_health"
  | "strength"
  | "hypertrophy"
  | "composition"
  | "endurance"
  | "mobility"
  | "function"
  | "skill";

export interface GoalTemplate {
  id: string;
  category: GoalCategory;
  /** i18n key for the SMART specific sentence. */
  specific_key: string;
  /** i18n key for the measurable target. */
  measurable_key: string;
  /** Proposed deadline in weeks from today. */
  default_weeks: number;
  /** Capacity / measurement slugs this template depends on (Round E hook). */
  requires?: string[];
}

const tpl = (
  id: string,
  category: GoalCategory,
  default_weeks: number,
  requires: string[] = [],
): GoalTemplate => ({
  id,
  category,
  specific_key: `goals.tpl.${id}.specific`,
  measurable_key: `goals.tpl.${id}.measurable`,
  default_weeks,
  requires,
});

export const GOAL_TEMPLATES: GoalTemplate[] = [
  // CARDIOVASCULAR / HEALTH (3)
  tpl("cv_rhr_lower",      "cardiovascular_health", 12, ["resting_heart_rate"]),
  tpl("cv_bp_systolic",    "cardiovascular_health", 16, ["blood_pressure_systolic"]),
  tpl("cv_cooper_2400",    "cardiovascular_health", 8,  ["cooper_12min"]),
  // STRENGTH (4)
  tpl("str_squat_1bw_5",   "strength", 12, ["1rm_squat"]),
  tpl("str_squat_15bw_5",  "strength", 16, ["1rm_squat"]),
  tpl("str_bench_75bw_5",  "strength", 16, ["1rm_bench"]),
  tpl("str_dl_15bw_5",     "strength", 16, ["1rm_deadlift"]),
  // HYPERTROPHY (3)
  tpl("hyp_arm",           "hypertrophy", 12, ["arm_circumference"]),
  tpl("hyp_thigh",         "hypertrophy", 12, ["thigh_circumference"]),
  tpl("hyp_glutes",        "hypertrophy", 16, ["hip_circumference"]),
  // COMPOSITION (3)
  tpl("comp_fatloss",      "composition", 16, ["body_fat_pct"]),
  tpl("comp_recomp",       "composition", 20, ["body_fat_pct", "weight"]),
  tpl("comp_waist",        "composition", 12, ["waist_circumference"]),
  // ENDURANCE (3)
  tpl("end_5k_continuous", "endurance",   8,  ["5k_run"]),
  tpl("end_5k_25min",      "endurance",   10, ["5k_run"]),
  tpl("end_cooper",        "endurance",   8,  ["cooper_12min"]),
  // MOBILITY (4)
  tpl("mob_toes",          "mobility",    6,  ["sit_and_reach"]),
  tpl("mob_overhead",      "mobility",    8,  ["overhead_wall_test"]),
  tpl("mob_squat_deep",    "mobility",    8,  ["deep_squat_assessment"]),
  tpl("mob_cervical",      "mobility",    4,  ["cervical_rotation_test"]),
  // FUNCTION (3)
  tpl("fn_floor_rise",     "function",    6,  ["floor_rise_test"]),
  tpl("fn_stairs_unaided", "function",    4,  ["stair_climb_test"]),
  tpl("fn_carry",          "function",    8,  ["farmers_carry_test"]),
  // SKILL (3 — full library lives in skill-aspirations.ts)
  tpl("skill_handstand",   "skill",       20, ["overhead_mobility", "shoulder_press_strength"]),
  tpl("skill_split",       "skill",       24, ["sit_and_reach", "hip_abduction_rom"]),
  tpl("skill_first_pullup","skill",       12, ["pullup_max", "deadhang_max"]),
];

export const GOAL_CATEGORIES: GoalCategory[] = [
  "cardiovascular_health",
  "strength",
  "hypertrophy",
  "composition",
  "endurance",
  "mobility",
  "function",
  "skill",
];

export function deadlineFromDuration(opts: { weeks?: number; months?: number; years?: number }): string {
  const d = new Date();
  if (opts.weeks) d.setDate(d.getDate() + opts.weeks * 7);
  if (opts.months) d.setMonth(d.getMonth() + opts.months);
  if (opts.years) d.setFullYear(d.getFullYear() + opts.years);
  return d.toISOString().slice(0, 10);
}

export const DURATION_PRESETS: { id: string; weeks?: number; months?: number; years?: number }[] = [
  { id: "4w", weeks: 4 },
  { id: "8w", weeks: 8 },
  { id: "12w", weeks: 12 },
  { id: "16w", weeks: 16 },
  { id: "6m", months: 6 },
  { id: "1y", years: 1 },
];