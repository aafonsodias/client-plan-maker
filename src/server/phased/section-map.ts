// Maps assessment sections → which fields they contribute to the brief.
// Drives Pre-Stage 0 micro-prompts. Section IDs match the section IDs
// already used in the assessment UI (clients_.$clientId.tsx).

export const PHASED_SECTIONS = [
  "parq",
  "risk",
  "anthro",
  "meds",
  "goal",
  "readiness",
  "training",
  "lifestyle",
  "nutrition",
  "mobility",
  "posture",
  "screen",
  "history",
  "performance",
] as const;

export type PhasedSectionId = (typeof PHASED_SECTIONS)[number];

// What the AI is allowed to emit for each section. Keys correspond to
// SectionAnalysisSchema fields. Drives the per-section system prompt.
export const SECTION_BRIEF_CONTRIBUTIONS: Record<PhasedSectionId, string[]> = {
  parq: ["red_flags", "contraindication_notes"],
  risk: ["red_flags", "contraindication_notes"],
  meds: ["red_flags", "contraindication_notes"],
  anthro: ["training_age_band", "notes_for_next_stage"],
  goal: ["primary_goal", "secondary_goals"],
  readiness: ["notes_for_next_stage"],
  training: ["sessions_per_week", "equipment_constraints", "training_age_band"],
  lifestyle: ["recovery_profile", "notes_for_next_stage"],
  nutrition: ["recovery_profile", "notes_for_next_stage"],
  mobility: ["movement_competency_summary", "notes_for_next_stage"],
  posture: ["movement_competency_summary", "notes_for_next_stage"],
  screen: ["movement_competency_summary"],
  history: ["training_age_band", "notes_for_next_stage"],
  performance: ["training_age_band", "notes_for_next_stage"],
};

// Picks the assessment fields each section actually owns. Pre-Stage 0
// only sends THESE fields to the model — never the full assessment row.
export function pickSectionPayload(
  section: PhasedSectionId,
  assessment: Record<string, unknown>
): Record<string, unknown> {
  const a = assessment;
  switch (section) {
    case "parq":
      return {
        parq_passed: a.parq_passed,
        parq_answers: (a.extended as any)?.parq_answers,
        medical_conditions: a.medical_conditions,
        injuries: a.injuries,
      };
    case "risk":
      return {
        acsm_risk_category: a.acsm_risk_category,
        risk_factors: (a.extended as any)?.risk_factors,
        age: (a.extended as any)?.age,
        sex: (a.extended as any)?.sex,
      };
    case "meds":
      return { medications: a.medications, med_flags: a.med_flags };
    case "anthro":
      return {
        waist_cm: a.waist_cm,
        hip_cm: a.hip_cm,
        body_fat_pct: a.body_fat_pct,
        body_fat_method: a.body_fat_method,
      };
    case "goal":
      return {
        primary_goal: a.primary_goal,
        secondary_goals: a.secondary_goals,
        smart_specific: a.smart_specific,
        smart_measurable: a.smart_measurable,
        smart_deadline: a.smart_deadline,
      };
    case "readiness":
      return { readiness_stage: a.readiness_stage };
    case "training":
      return {
        experience_level: a.experience_level,
        training_days_per_week: a.training_days_per_week,
        session_duration_minutes: a.session_duration_minutes,
        training_location: a.training_location,
        available_equipment: a.available_equipment,
        preferences: a.preferences,
      };
    case "lifestyle":
      return {
        sleep_quality: a.sleep_quality,
        stress_level: a.stress_level,
        energy_levels: a.energy_levels,
        recovery_capacity: a.recovery_capacity,
        lifestyle: a.lifestyle,
        hours_seated: (a.extended as any)?.hours_seated_per_day,
        daily_steps: (a.extended as any)?.daily_steps,
      };
    case "nutrition":
      return {
        nutrition_habits: a.nutrition_habits,
        hydration_glasses_per_day: a.hydration_glasses_per_day,
        meals_per_day: (a.extended as any)?.meals_per_day,
        alcohol_units_per_week: (a.extended as any)?.alcohol_units_per_week,
        processed_food_frequency: (a.extended as any)?.processed_food_frequency,
        water_litres_per_day: (a.extended as any)?.water_litres_per_day,
      };
    case "mobility":
      return {
        mobility_limitations: a.mobility_limitations,
        mobility_scores: (a.extended as any)?.mobility_scores,
      };
    case "posture":
      return {
        standing_posture_notes: a.standing_posture_notes,
        known_imbalances: a.known_imbalances,
        dominant_side: a.dominant_side,
      };
    case "screen":
      return {
        squat_depth_score: a.squat_depth_score,
        squat_depth_note: a.squat_depth_note,
        overhead_reach_score: a.overhead_reach_score,
        overhead_reach_note: a.overhead_reach_note,
        hip_hinge_score: a.hip_hinge_score,
        hip_hinge_note: a.hip_hinge_note,
        single_leg_balance_score: a.single_leg_balance_score,
        single_leg_balance_note: a.single_leg_balance_note,
      };
    case "history":
      return {
        years_training: a.years_training,
        previous_program_style: a.previous_program_style,
        max_lifts: a.max_lifts,
      };
    case "performance":
      return {
        resting_heart_rate: a.resting_heart_rate,
        cardio_capacity: a.cardio_capacity,
        cardio_test: (a.extended as any)?.cardio_test,
        test_result: (a.extended as any)?.cardio_test_result,
      };
  }
}