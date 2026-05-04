/**
 * Missions — the bite-sized quest path the client walks to reach
 * assessment_completion = 100 before a workout plan can be generated.
 * Schema lives in the `missions` table; this module is the client-side
 * helper for labels + completion math.
 */
export type MissionKind =
  | "parq"
  | "rockport"
  | "blood_pressure"
  | "gym_class"
  | "photos"
  | "custom";

export type MissionStatus = "pending" | "in_progress" | "done" | "skipped";

export type Mission = {
  id: string;
  client_id: string;
  trainer_id: string;
  kind: MissionKind;
  status: MissionStatus;
  evidence_required: boolean;
  evidence_url: string | null;
  completed_at: string | null;
  created_at: string;
};

/** Weight per mission kind toward assessment_completion (sums to 100). */
export const MISSION_WEIGHTS: Record<MissionKind, number> = {
  parq: 30,
  rockport: 20,
  blood_pressure: 20,
  photos: 10,
  gym_class: 10,
  custom: 10,
};

/** i18n keys (under `missions.*`) — labels resolved via t() in components. */
export const MISSION_KIND_I18N: Record<MissionKind, string> = {
  parq: "missions.parq",
  rockport: "missions.rockport",
  blood_pressure: "missions.blood_pressure",
  photos: "missions.photos",
  gym_class: "missions.gym_class",
  custom: "missions.custom",
};

export function computeAssessmentCompletion(missions: Mission[]): number {
  let total = 0;
  for (const m of missions) {
    if (m.status === "done") total += MISSION_WEIGHTS[m.kind] ?? 0;
  }
  return Math.min(100, Math.round(total));
}
