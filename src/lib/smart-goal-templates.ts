// Curated SMART goal templates surfaced in the assessment goal block.
// All user-facing strings are i18n keys under `assessment.goal_block.templates.<id>.*`.
// Each template fills `smart_specific`, `smart_measurable`, and computes
// `smart_deadline = today + default_weeks * 7`.

export type SmartGoalCategory =
  | "strength"
  | "hypertrophy"
  | "body_comp"
  | "endurance"
  | "mobility"
  | "skill"
  | "health";

export type SmartGoalTemplate = {
  id: string;
  category: SmartGoalCategory;
  default_weeks: number;
};

export const SMART_GOAL_TEMPLATES: SmartGoalTemplate[] = [
  { id: "strength_squat_bw", category: "strength", default_weeks: 16 },
  { id: "strength_bench_bw", category: "strength", default_weeks: 16 },
  { id: "strength_deadlift_2bw", category: "strength", default_weeks: 20 },
  { id: "hypertrophy_arms", category: "hypertrophy", default_weeks: 12 },
  { id: "hypertrophy_legs", category: "hypertrophy", default_weeks: 12 },
  { id: "body_comp_lose_fat", category: "body_comp", default_weeks: 16 },
  { id: "body_comp_recomp", category: "body_comp", default_weeks: 20 },
  { id: "endurance_5k", category: "endurance", default_weeks: 10 },
  { id: "endurance_cooper", category: "endurance", default_weeks: 8 },
  { id: "mobility_toe_touch", category: "mobility", default_weeks: 6 },
  { id: "mobility_overhead", category: "mobility", default_weeks: 8 },
  { id: "skill_first_pullup", category: "skill", default_weeks: 12 },
  { id: "skill_handstand", category: "skill", default_weeks: 16 },
  { id: "health_resting_hr", category: "health", default_weeks: 12 },
  { id: "health_steps", category: "health", default_weeks: 8 },
];

export function deadlineFromWeeks(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  // YYYY-MM-DD for <input type="date">
  return d.toISOString().slice(0, 10);
}