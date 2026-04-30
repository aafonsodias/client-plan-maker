// Derived client phase logic. NEVER stored — always computed from latest data.

export type ClientPhase =
  | { kind: "onboarding"; label: string }
  | { kind: "assessment"; label: string }
  | { kind: "ready"; label: string }
  | { kind: "active"; label: string; block: number }
  | { kind: "idle"; label: string; daysSince: number }
  | { kind: "ended"; label: string };

export type PhaseKind = ClientPhase["kind"];

const REQUIRED_SECTIONS = ["parq", "risk", "smart", "training", "movement"] as const;

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

function isRequiredComplete(a: any | null): boolean {
  if (!a) return false;
  return REQUIRED_SECTIONS.every((id) => {
    switch (id) {
      case "parq":
        return a.parq && Object.values(a.parq).every((v) => v === true || v === false)
          && Object.keys(a.parq).length >= 7;
      case "risk":
        // Mirrors assessment page: BMI risk row computed from height/weight
        return hasVal(a.height_cm) && hasVal(a.weight_kg);
      case "smart":
        return hasVal(a.smart_specific) && hasVal(a.smart_measurable);
      case "training":
        return hasVal(a.experience_level) && hasVal(a.training_days_per_week)
          && hasVal(a.session_duration_minutes) && (a.available_equipment?.length ?? 0) > 0;
      case "movement":
        return hasVal(a.squat_depth_score) || hasVal(a.overhead_reach_score)
          || hasVal(a.hip_hinge_score) || hasVal(a.single_leg_balance_score);
    }
  });
}

export type PhaseInputs = {
  assessment: any | null;
  latestPlan: { id: string; status: string; duration_weeks: number | null; updated_at: string } | null;
  latestSessionDate: string | null; // ISO date string
  currentWeek: number | null;       // max(week_number) across sessions of latest plan
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
  const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap";
  switch (kind) {
    case "onboarding":
      return `${base} bg-secondary text-muted-foreground`;
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