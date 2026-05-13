// Evidence-based 3-tier programming classifier.
// Pure functions only — no I/O. Used by Stage 2 (blueprint) and Stage 3 (microcycle).
//
// Triggers are derived from the assessment row + the synthesized brief, and
// only reference fields that actually exist in the schema (or in `extended`).

import type { Brief } from "./schemas";
import {
  runPreparticipationAlgorithm,
  classifyCvdRiskFactors,
  cardiacRehabBpExclusion,
  type PreparticipationResult,
  type DesiredIntensity,
} from "../screening/preparticipation.server";
import type { InjuryBan } from "./exercise-filters.server";

export type Tier = "remedial" | "conservative" | "advanced";

/** Engine version stamped into generation_log + audit_events.
 *  Bump on any change to tier triggers, RPE floor matrix, or sets-per-week defaults. */
export const ENGINE_VERSION = "programming-tier@1.0.0" as const;

const PATTERNS = ["squat", "hinge", "push", "pull", "carry", "lunge"] as const;

export interface TierGuidelines {
  tier: Tier;
  sessionsPerWeekMin: number;
  sessionsPerWeekMax: number;
  exercisesPerSessionMin: number;
  exercisesPerSessionMax: number;
  rpeRange: string;
  splitGuidance: string;
  exerciseTypes: string;
  forbiddenExercises: string[];
  requiredAlternatives: string;
  /** Soft total exercise band over a 4-week meso (sessions × 4 × ex/session) */
  totalExercisesMin: number;
  totalExercisesMax: number;
  /**
   * Hard cap on the number of working sets per exercise role in WEEK 1 only.
   * Stage 4 progressively bumps sets in later weeks via the Bompa wave.
   * Remedial Week 1 = introduction, low volume; advanced can start denser.
   */
  week1SetCap: { main: number; accessory: number; carry: number };
  /**
   * Optional injury-driven exercise bans, attached by
   * `resolveAndPersistGuidelines` after fetching `assessment_injuries`. Kept
   * separate from `forbiddenExercises` (tier-driven) so audit logs in
   * `generation_log.injury_filters_applied` can attribute the right source.
   */
  injuryBans?: InjuryBan[];
}

function countMovementScreenFailures(assessment: Record<string, any>): number {
  return PATTERNS.filter((p) => {
    const criteria = assessment?.[`${p}_form_criteria`];
    if (!criteria || typeof criteria !== "object") return false;
    const failed = Object.values(criteria as Record<string, unknown>).filter(
      (v) => v === false,
    ).length;
    return failed >= 3;
  }).length;
}

function isRecoveryCompromised(
  assessment: Record<string, any>,
  brief: Brief,
): boolean {
  // numeric 1-10 in our schema; "high stress" ≈ ≥ 7
  const stress = typeof assessment?.stress_level === "number" ? assessment.stress_level : null;
  const sleep = typeof assessment?.sleep_quality === "number" ? assessment.sleep_quality : null;
  const ext = (assessment?.extended ?? {}) as Record<string, any>;
  const sleepHours = typeof ext?.sleep_hours === "number" ? ext.sleep_hours : null;
  const cannabis = String(ext?.cannabis_use ?? "").toLowerCase();
  if (cannabis === "daily" || cannabis === "every_day") return true;
  if (sleepHours !== null && sleepHours < 6) return true;
  if (stress !== null && stress >= 7) return true;
  if (sleep !== null && sleep <= 4) return true;
  // brief.recovery_profile sometimes carries a free-text "low / poor" hint
  const recovery = String((brief as any)?.recovery_profile ?? "").toLowerCase();
  if (/poor|low|compromis|insuff/.test(recovery)) return true;
  return false;
}

/**
 * Legacy clearance heuristic — kept exported during R2.2 smoke window so the
 * smoke harness can compute `oldFlag` in parallel with the new ACSM 12e Ch.2
 * algorithm and surface a per-persona diff. Removed in a follow-up commit
 * after Smoke #1 is approved.
 */
export function hasMedicalClearanceFlag(assessment: Record<string, any>): boolean {
  if (assessment?.parq_passed === false) return true;
  const sys = assessment?.systolic_bp_mmhg;
  const dia = assessment?.diastolic_bp_mmhg;
  if (typeof sys === "number" && sys >= 160) return true;
  if (typeof dia === "number" && dia >= 100) return true;
  if (String(assessment?.acsm_risk_category ?? "").toLowerCase() === "high") return true;
  return false;
}

/** Map brief.intensity_appetite → DesiredIntensity for ACSM Ch.2 algorithm. */
function desiredIntensityFromBrief(brief: Brief): DesiredIntensity {
  const a = String((brief as any)?.intensity_appetite ?? "").toLowerCase();
  if (a === "agressivo" || a === "aggressive") return "vigorous";
  if (a === "conservador" || a === "conservative") return "light";
  return "moderate";
}

/** Classify the programming tier for a brief + assessment pair. */
export function classifyTier(brief: Brief, assessment: Record<string, any>): Tier {
  const prepart = runPreparticipationAlgorithm({
    assessment,
    desired_intensity: desiredIntensityFromBrief(brief),
  });
  const movementFailures = countMovementScreenFailures(assessment);
  if (movementFailures >= 5 || prepart.clearance_required) {
    return "remedial";
  }

  const redFlagCount = (brief.red_flags ?? []).length;
  const recoveryCompromised = isRecoveryCompromised(assessment, brief);
  const age = typeof (assessment?.extended as any)?.age === "number"
    ? (assessment.extended as any).age
    : 0;

  if (
    redFlagCount >= 2 ||
    movementFailures >= 2 ||
    recoveryCompromised ||
    prepart.cvd_risk_factors.count >= 2 ||
    prepart.known_disease ||
    (age > 50 && redFlagCount >= 1) ||
    brief.training_age_band === "beginner"
  ) {
    return "conservative";
  }
  return "advanced";
}

/**
 * Dual-mode classifier used by the R2.2 smoke harness. Returns the final
 * tier (driven by the new ACSM 12e algorithm) plus the legacy `oldFlag` and
 * the full preparticipation result so the smoke report can produce a clean
 * old-vs-new diff per persona.
 */
export interface DualTierResult {
  tier: Tier;
  oldFlag: boolean;
  prepart: PreparticipationResult;
  movement_failures: number;
}

export function classifyTierWithDual(
  brief: Brief,
  assessment: Record<string, any>,
): DualTierResult {
  const oldFlag = hasMedicalClearanceFlag(assessment);
  const prepart = runPreparticipationAlgorithm({
    assessment,
    desired_intensity: desiredIntensityFromBrief(brief),
  });
  const movement_failures = countMovementScreenFailures(assessment);
  const tier = classifyTier(brief, assessment);
  return { tier, oldFlag, prepart, movement_failures };
}

// Re-export ACSM helpers for callers/smoke harness convenience.
export { classifyCvdRiskFactors, cardiacRehabBpExclusion };

const REMEDIAL_FORBIDDEN = [
  "back squat", "front squat", "overhead squat",
  "conventional deadlift", "sumo deadlift",
  "barbell bench press", "barbell overhead press",
  "barbell row", "clean", "snatch", "jerk",
  "box jump", "depth jump", "kipping",
  "barbell lunge",
];
const CONSERVATIVE_FORBIDDEN = [
  "back squat", "front squat",
  "conventional deadlift",
  "barbell overhead press", "push press", "jerk",
  "kipping", "depth jump",
];

export function tierGuidelines(
  tier: Tier,
  briefSessions: number,
  primaryGoal?: string,
): TierGuidelines {
  if (tier === "remedial") {
    return {
      tier,
      sessionsPerWeekMin: 2,
      sessionsPerWeekMax: 2,
      exercisesPerSessionMin: 6,
      exercisesPerSessionMax: 8,
      rpeRange: "5-6",
      splitGuidance: "Full-body remedial sessions; no high-axial-load lower body.",
      exerciseTypes: "Machines, bands, bodyweight progressions. NO barbell work.",
      forbiddenExercises: REMEDIAL_FORBIDDEN,
      requiredAlternatives: [
        "Squat → bodyweight box squat, supported goblet squat, leg press",
        "Hinge → supported glute bridge, cable/band pull-through",
        "Push → machine chest press, band press, incline push-up",
        "Pull → lat pulldown (machine), seated cable row, band row",
        "Carry → light suitcase carry, light farmer carry",
      ].join("\n"),
      totalExercisesMin: 48,
      totalExercisesMax: 64,
      week1SetCap: { main: 2, accessory: 1, carry: 1 },
    };
  }
  if (tier === "conservative") {
    const sessions = primaryGoal === "strength" ? 4 : Math.min(Math.max(briefSessions, 3), 4);
    return {
      tier,
      sessionsPerWeekMin: 3,
      sessionsPerWeekMax: 4,
      exercisesPerSessionMin: 6,
      exercisesPerSessionMax: 7,
      rpeRange: "6-7 (RPE 8 only on primary compound lifts)",
      splitGuidance: "Full-body or Upper/Lower split. No 5-6 day body-part splits.",
      exerciseTypes:
        "Beginner-friendly progressions, neutral-grip variations to protect wrists/shoulders.",
      forbiddenExercises: CONSERVATIVE_FORBIDDEN,
      requiredAlternatives: [
        "Squat → goblet squat, box squat, leg press, safety-bar squat (NOT back squat)",
        "Hinge → trap-bar deadlift, RDL, single-leg RDL (NOT conventional DL)",
        "Push → DB neutral-grip press, landmine press, push-up variations",
        "Pull → chest-supported row, lat pulldown, face pulls (horizontal emphasis)",
      ].join("\n"),
      totalExercisesMin: sessions * 4 * 6,
      totalExercisesMax: sessions * 4 * 7,
      week1SetCap: { main: 3, accessory: 2, carry: 1 },
    };
  }
  // advanced
  return {
    tier,
    sessionsPerWeekMin: Math.min(Math.max(briefSessions, 5), 6),
    sessionsPerWeekMax: Math.min(Math.max(briefSessions, 5), 6),
    exercisesPerSessionMin: 7,
    exercisesPerSessionMax: 8,
    rpeRange: "7-9",
    splitGuidance: "Push/Pull/Legs or specialised body-part split.",
    exerciseTypes: "Full exercise library available, including barbell work.",
    forbiddenExercises: [],
    requiredAlternatives: "All movement patterns available based on competency.",
    totalExercisesMin: Math.min(Math.max(briefSessions, 5), 6) * 4 * 7,
    totalExercisesMax: Math.min(Math.max(briefSessions, 5), 6) * 4 * 8,
    week1SetCap: { main: 3, accessory: 3, carry: 2 },
  };
}

/**
 * Week-1 RPE FLOORS by tier × intensity_appetite, broken down by exercise role.
 *
 * Why this exists: Stage 3 used to anchor Week 1 RPE too low because the prompt
 * only carried a coarse "RPE range" and accessory work defaulted to RPE 5 — even
 * for a 38yo conservative-tier client on the "padrão" appetite. That dragged
 * the weekly average to ~5.4 across all 4 weeks (Marta's plan, real example).
 *
 * The floors below are honest, role-aware minimums — not ceilings. The main lift
 * sits at or near the upper number; accessories anchor at the middle; carries /
 * core stay where they belong (low-load, high-control).
 */
export type Appetite = "conservador" | "padrao" | "agressivo";

export interface RpeFloors {
  /** Main lift (first exercise in the main block). Hard floor. */
  main: number;
  /** Secondary / accessory exercises. Hard floor. */
  accessory: number;
  /** Carries, isolation core (Pallof, suitcase carry, etc.). Hard floor. */
  carry: number;
}

const FLOOR_MATRIX: Record<Tier, Record<Appetite, RpeFloors>> = {
  remedial: {
    conservador: { main: 4, accessory: 4, carry: 4 },
    padrao: { main: 5, accessory: 5, carry: 4 },
    agressivo: { main: 6, accessory: 5, carry: 4 },
  },
  conservative: {
    conservador: { main: 6.5, accessory: 5, carry: 5 },
    padrao: { main: 7, accessory: 6, carry: 5.5 },
    agressivo: { main: 7.5, accessory: 7, carry: 6 },
  },
  advanced: {
    conservador: { main: 7, accessory: 6, carry: 6 },
    padrao: { main: 8, accessory: 7, carry: 6.5 },
    agressivo: { main: 8.5, accessory: 8, carry: 7 },
  },
};

export function rpeFloors(tier: Tier, appetite: string | undefined | null): RpeFloors {
  const a = (String(appetite ?? "padrao").toLowerCase() as Appetite);
  const safeAppetite: Appetite =
    a === "conservador" || a === "padrao" || a === "agressivo" ? a : "padrao";
  return FLOOR_MATRIX[tier][safeAppetite];
}

/** Heuristic: is this exercise a "carry / core control" exercise? */
export function isCarryLike(name: string): boolean {
  const n = String(name ?? "").toLowerCase();
  return /(carry|pallof|dead\s*bug|bird\s*dog|plank|hollow|suitcase|farmer)/.test(n);
}

/**
 * Validate a Stage-2 blueprint against tier guidelines.
 * Stage-2 has no per-day exercises yet, so we only validate the SHAPE
 * (sessions/week + archetype count). The exercise-count bands are
 * re-validated again post-Stage-3 + post-Stage-4 if needed.
 */
export function validateBlueprintShape(
  blueprint: { sessions_per_week: number; session_archetypes: { id: string }[] },
  guidelines: TierGuidelines,
): { ok: true } | { ok: false; error: string } {
  const spw = blueprint.sessions_per_week;
  if (spw < guidelines.sessionsPerWeekMin || spw > guidelines.sessionsPerWeekMax) {
    return {
      ok: false,
      error: `${guidelines.tier} tier requires ${guidelines.sessionsPerWeekMin}-${guidelines.sessionsPerWeekMax} sessions/week, got ${spw}.`,
    };
  }
  return { ok: true };
}

export function tierPromptBlock(g: TierGuidelines): string {
  const sessionsLine =
    g.sessionsPerWeekMin === g.sessionsPerWeekMax
      ? `${g.sessionsPerWeekMin} sessions/week (mandatory — never more, never less)`
      : `${g.sessionsPerWeekMin}-${g.sessionsPerWeekMax} sessions/week (mandatory range)`;

  const exLine =
    g.exercisesPerSessionMin === g.exercisesPerSessionMax
      ? `${g.exercisesPerSessionMin} main-block exercises/session`
      : `${g.exercisesPerSessionMin}-${g.exercisesPerSessionMax} main-block exercises/session`;

  const forbidden =
    g.forbiddenExercises.length > 0
      ? `\nFORBIDDEN EXERCISES (do not program under any circumstances):\n${g.forbiddenExercises.join(", ")}\n\nREQUIRED ALTERNATIVES:\n${g.requiredAlternatives}`
      : "";

  return `PROGRAMMING TIER: ${g.tier.toUpperCase()}

FREQUENCY: ${sessionsLine}
VOLUME: ${exLine} (warm-up / cooldown / activation NOT counted)
INTENSITY: RPE ${g.rpeRange}
SPLIT: ${g.splitGuidance}

EXERCISE SELECTION:
${g.exerciseTypes}${forbidden}

CRITICAL RULES:
- Total main-block exercises across the mesocycle should fall in ${g.totalExercisesMin}-${g.totalExercisesMax}.
- Week 4 is ALWAYS a deload (-20% volume, intensity unchanged).
- Progression W1→W2→W3: +1-2 reps OR -10-15s rest OR +1 set.
- Never program more than 6 days/week for anyone.`;
}