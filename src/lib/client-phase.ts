// Derived client phase logic. NEVER stored — always computed from latest data.

import {
  SELF_INTAKE_SECTION_IDS,
  ASSESSMENT_SESSION_SECTION_IDS,
  isSectionCompleteForPhase,
  isSelfIntakeComplete,
  isAssessmentSessionComplete,
} from "./assessment-phase";

export type ClientPhase =
  | { kind: "onboarding"; label: string }
  | { kind: "intake_sent"; label: string }
  | { kind: "assessment"; label: string }
  | { kind: "ready"; label: string }
  | { kind: "active"; label: string; block: number }
  | { kind: "idle"; label: string; daysSince: number }
  | { kind: "ended"; label: string };

export type PhaseKind = ClientPhase["kind"];

/**
 * Required sections for "ready for plan" — mirrors the new MVP grouping
 * (Round 1): Self Intake + Assessment Session must both be complete.
 * Source of truth lives in `src/lib/assessment-phase.ts`.
 */
const REQUIRED_SECTIONS = [
  ...SELF_INTAKE_SECTION_IDS,
  ...ASSESSMENT_SESSION_SECTION_IDS,
] as const;

function hasVal(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function isAssessmentTouched(a: any | null): boolean {
  if (!a) return false;
  // Any non-empty meaningful field
  const keys = [
    "primary_goal", "experience_level", "training_days_per_week", "session_duration_minutes",
    "training_location", "available_equipment", "smart_specific", "smart_measurable",
    "readiness_stage", "sleep_quality", "stress_level", "nutrition_habits",
    "squat_depth_score", "overhead_reach_score", "hip_hinge_score", "single_leg_balance_score",
    "waist_cm", "hip_cm", "body_fat_pct", "resting_heart_rate", "medications",
    "known_imbalances", "standing_posture_notes", "dominant_side", "years_training",
  ];
  if (keys.some((k) => hasVal(a[k]))) return true;
  if (a.med_flags?.length) return true;
  if (a.parq && Object.values(a.parq).some((v) => v === true || v === false)) return true;
  if (a.extended && Object.keys(a.extended).length > 0) return true;
  return false;
}

export function isRequiredComplete(a: any | null): boolean {
  if (!a) return false;
  return isSelfIntakeComplete(a) && isAssessmentSessionComplete(a);
}

/** Re-export so callers can read the canonical id lists from one module. */
export { SELF_INTAKE_SECTION_IDS, ASSESSMENT_SESSION_SECTION_IDS, isSectionCompleteForPhase };

export type PhaseInputs = {
  assessment: any | null;
  latestPlan: { id: string; status: string; duration_weeks: number | null; updated_at: string } | null;
  latestSessionDate: string | null; // ISO date string
  currentWeek: number | null;       // max(week_number) across sessions of latest plan
  intakeStatus?: "not_sent" | "sent" | "opened" | "submitted" | "reviewed" | null;
};

export function derivePhase(input: PhaseInputs): ClientPhase {
  const { assessment, latestPlan, latestSessionDate, currentWeek } = input;

  if (latestPlan) {
    const block = currentWeek ?? 1;
    const duration = latestPlan.duration_weeks ?? 0;
    const ended = latestPlan.status === "finalized" && duration > 0 && (currentWeek ?? 0) >= duration && daysSince(latestSessionDate) > 14;
    if (ended) return { kind: "ended", label: "Plan ended" };
    const idleDays = daysSince(latestSessionDate);
    if (latestSessionDate && idleDays > 14) {
      return { kind: "idle", label: "Idle", daysSince: idleDays };
    }
    return { kind: "active", label: `Active · Block ${block}`, block };
  }

  if (isRequiredComplete(assessment)) {
    return { kind: "ready", label: "Ready for plan" };
  }
  if (isAssessmentTouched(assessment)) {
    return { kind: "assessment", label: "Assessment in progress" };
  }
  if (input.intakeStatus === "sent" || input.intakeStatus === "opened") {
    return { kind: "intake_sent", label: "Intake sent — awaiting client" };
  }
  return { kind: "onboarding", label: "Onboarding" };
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86400000);
}

// Pill style classes per phase kind. Tailwind only; uses semantic tokens.
export function phasePillClasses(kind: PhaseKind): string {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest max-w-full break-words";
  switch (kind) {
    case "onboarding":
      return `${base} bg-secondary text-muted-foreground`;
    case "intake_sent":
      return `${base} bg-accent/10 text-accent/90 border border-accent/30`;
    case "assessment":
      return `${base} bg-accent/15 text-accent/90`;
    case "ready":
      return `${base} bg-accent text-accent-foreground`;
    case "active":
      return `${base} bg-accent/90 text-accent-foreground`;
    case "idle":
      return `${base} bg-secondary text-muted-foreground`;
    case "ended":
      return `${base} bg-muted text-muted-foreground`;
  }
}