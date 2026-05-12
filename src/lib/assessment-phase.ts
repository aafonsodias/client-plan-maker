import { PATTERN_IDS } from "@/lib/movement-criteria";

/**
 * Assessment phase helper — Round 1 of the MVP assessment-to-plan redesign.
 *
 * Splits the existing 14 assessment section ids into two groups WITHOUT
 * changing any data shape, ids, or persisted state:
 *
 *   - Self Intake / Auto-Avaliação — what the client can complete alone.
 *   - Assessment Session / Sessão de Avaliação — practical/observational
 *     items that may need a PT, mirror, equipment or guided testing.
 *
 * Completion logic mirrors the inline `isSectionComplete()` in
 * `routes/clients_.$clientId.tsx` so phase derivation never drifts from
 * the per-section badges shown on the cockpit.
 */

export const SELF_INTAKE_SECTION_IDS = [
  "parq",
  "risk",
  "training",
  "injuries",
  "history",
  "goal",
  "meds",
  "readiness",
  "lifestyle",
  "nutrition",
] as const;

export const ASSESSMENT_SESSION_SECTION_IDS = [
  "anthro",
  "mobility",
  "posture",
  "screen",
  "performance",
] as const;

export type SelfIntakeSectionId = (typeof SELF_INTAKE_SECTION_IDS)[number];
export type AssessmentSessionSectionId = (typeof ASSESSMENT_SESSION_SECTION_IDS)[number];
export type AssessmentSectionId = SelfIntakeSectionId | AssessmentSessionSectionId;

export type AssessmentPhase = "self_intake_pending" | "session_pending" | "complete";

/** Optional context the validator can accept to count cross-table data
 *  (e.g. injuries stored in `assessment_injuries`). Backwards-compatible:
 *  callers that don't pass it fall back to legacy in-row fields. */
export type CompletionContext = {
  injuriesCount?: number;
};

function hasVal(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Movement-screen pattern is "handled" (counts toward completion) when ANY of:
 * 1) explicitly marked Not assessed,
 * 2) at least one form criterion was toggled (true OR false — assessed even if poor),
 * 3) any capacity field was populated.
 * Form score is NOT used for completion — low scores are valid assessment data.
 */
export function isPatternHandled(p: string, a: any): boolean {
  if (!a) return false;
  if (a.screen_not_assessed?.[p] === true) return true;
  const fc = a[`${p}_form_criteria`];
  if (fc && typeof fc === "object" && Object.keys(fc).length > 0) return true;
  const cap = a[`${p}_capacity`];
  if (cap && typeof cap === "object" && Object.values(cap).some(hasVal)) return true;
  if (hasVal(cap) && typeof cap !== "object") return true;
  return false;
}

/** Returns the patterns that are still unhandled (for missing-items messaging). */
export function unhandledScreenPatterns(a: any): string[] {
  return PATTERN_IDS.filter((p) => !isPatternHandled(p, a));
}

/**
 * Per-section completeness — mirrors the cockpit logic exactly. Kept here
 * so derived helpers (`isSelfIntakeComplete`, `isAssessmentSessionComplete`,
 * `assessmentPhase`) and `client-phase.ts` can share one source of truth.
 */
export function isSectionCompleteForPhase(
  id: AssessmentSectionId | string,
  a: any,
  ctx: CompletionContext = {},
): boolean {
  if (!a) return false;
  switch (id) {
    case "parq":
      return Object.values(a.parq ?? {}).every((v) => v === true || v === false)
        && Object.keys(a.parq ?? {}).length >= 7;
    case "risk":
      return hasVal(a.risk?.bmi_category);
    case "training":
      return hasVal(a.experience_level)
        && hasVal(a.training_days_per_week)
        && hasVal(a.session_duration_minutes)
        && (a.available_equipment?.length ?? 0) > 0;
    case "injuries":
      // Counts the body-map rows (assessment_injuries) too, so adding
      // injuries via the visual selector flips the section to complete.
      return a.no_injuries === true
        || (ctx.injuriesCount ?? 0) > 0
        || hasVal(a.injuries)
        || (a.pain_areas?.length ?? 0) > 0;
    case "history":
      return hasVal(a.years_training) || hasVal(a.previous_program_style) || hasVal(a.max_lifts);
    case "goal":
      return hasVal(a.smart_specific) && hasVal(a.smart_measurable);
    case "meds":
      // Explicit "I take nothing" toggle persisted on `no_meds` lets a
      // healthy client complete the section without inventing a flag.
      return a.no_meds === true
        || hasVal(a.medications)
        || (a.med_flags?.length ?? 0) > 0;
    case "readiness":
      return hasVal(a.readiness_stage);
    case "lifestyle":
      return hasVal(a.sleep_quality) || hasVal(a.stress_level) || hasVal(a.ext_hours_seated)
        || hasVal(a.ext_daily_steps) || hasVal(a.ext_job_type);
    case "nutrition":
      return hasVal(a.ext_meals_per_day) || hasVal(a.ext_water_l_per_day)
        || hasVal(a.ext_alcohol_units_week) || hasVal(a.nutrition_habits);
    case "anthro":
      return hasVal(a.waist_cm) || hasVal(a.hip_cm) || hasVal(a.body_fat_pct) || hasVal(a.body_fat_method);
    case "mobility":
      return ["ext_mob_shoulder", "ext_mob_hip", "ext_mob_ankle", "ext_mob_thoracic", "ext_mob_wrist", "ext_mob_knee"]
        .every((k) => hasVal(a[k]));
    case "posture":
      return hasVal(a.standing_posture_notes) || hasVal(a.known_imbalances) || hasVal(a.dominant_side);
    case "screen":
      return PATTERN_IDS.every((p) => isPatternHandled(p, a));
    case "performance":
      return hasVal(a.resting_heart_rate) || (a.ext_cardio_test && a.ext_cardio_test !== "untested");
    default:
      return false;
  }
}

/**
 * Required Self Intake sections. The 9 ids the client must finish before
 * the Assessment Session is opened. Mirrors current product copy: PAR-Q,
 * risk strat, training setup, history, SMART goal, medications, readiness,
 * lifestyle and nutrition.
 */
export function isSelfIntakeComplete(a: any, ctx: CompletionContext = {}): boolean {
  if (!a) return false;
  return SELF_INTAKE_SECTION_IDS.every((id) => isSectionCompleteForPhase(id, a, ctx));
}

/**
 * Required Assessment Session sections. The 5 ids that need a PT, a mirror,
 * a tape, or guided instruction: anthropometry, mobility, posture, movement
 * screen and cardio/performance.
 */
export function isAssessmentSessionComplete(a: any, ctx: CompletionContext = {}): boolean {
  if (!a) return false;
  return ASSESSMENT_SESSION_SECTION_IDS.every((id) => isSectionCompleteForPhase(id, a, ctx));
}

export function assessmentPhase(a: any, ctx: CompletionContext = {}): AssessmentPhase {
  if (!isSelfIntakeComplete(a, ctx)) return "self_intake_pending";
  if (!isAssessmentSessionComplete(a, ctx)) return "session_pending";
  return "complete";
}

/** Convenience: counts of completed sections per group. */
export function assessmentGroupCounts(a: any, ctx: CompletionContext = {}): {
  selfIntake: { done: number; total: number };
  session: { done: number; total: number };
} {
  const si = SELF_INTAKE_SECTION_IDS.filter((id) => isSectionCompleteForPhase(id, a, ctx)).length;
  const ss = ASSESSMENT_SESSION_SECTION_IDS.filter((id) => isSectionCompleteForPhase(id, a, ctx)).length;
  return {
    selfIntake: { done: si, total: SELF_INTAKE_SECTION_IDS.length },
    session: { done: ss, total: ASSESSMENT_SESSION_SECTION_IDS.length },
  };
}