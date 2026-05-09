// Round X — SMART goal templates.
// Schema follows the round spec; i18n keys live under `assessment.goals.tpl.<id>.*`
// and category labels under `assessment.goals.cat.<category>`.

export type GoalCategory =
  | "strength"
  | "hypertrophy"
  | "composition"
  | "endurance"
  | "mobility"
  | "function";

export interface GoalTemplate {
  id: string;
  category: GoalCategory;
  /** i18n key for the SMART specific sentence. */
  specific_key: string;
  /** i18n key for the measurable target. */
  measurable_key: string;
  /** Proposed deadline in weeks from today. */
  default_weeks: number;
}

const tpl = (id: string, category: GoalCategory, default_weeks: number): GoalTemplate => ({
  id,
  category,
  specific_key: `goals.tpl.${id}.specific`,
  measurable_key: `goals.tpl.${id}.measurable`,
  default_weeks,
});

export const GOAL_TEMPLATES: GoalTemplate[] = [
  // STRENGTH
  tpl("str_squat_15bw_5", "strength", 16),
  tpl("str_bench_bw_5", "strength", 16),
  tpl("str_dl_2bw_3", "strength", 20),
  // HYPERTROPHY
  tpl("hyp_arm_3cm", "hypertrophy", 12),
  tpl("hyp_thigh_4cm", "hypertrophy", 12),
  // COMPOSITION
  tpl("comp_fatloss_5", "composition", 16),
  tpl("comp_recomp", "composition", 20),
  // ENDURANCE
  tpl("end_5k_25", "endurance", 10),
  tpl("end_cooper_2400", "endurance", 8),
  // MOBILITY
  tpl("mob_toes_painfree", "mobility", 6),
  tpl("mob_overhead_full", "mobility", 8),
  // FUNCTION
  tpl("fn_carry_30s", "function", 12),
  tpl("fn_get_up_floor", "function", 8),
];

export const GOAL_CATEGORIES: GoalCategory[] = [
  "strength",
  "hypertrophy",
  "composition",
  "endurance",
  "mobility",
  "function",
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