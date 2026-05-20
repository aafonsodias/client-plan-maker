import test from "node:test";
import assert from "node:assert/strict";

import { runPreparticipationAlgorithm } from "../src/server/screening/preparticipation.server.ts";
import { assessmentPhase } from "../src/lib/assessment-phase.ts";
import { buildCompletionReport } from "../src/lib/assessment-completion.ts";
import { derivePhase } from "../src/lib/client-phase.ts";
import { planStatusInfo } from "../src/lib/plan-status.ts";
import { deriveInjuryBans } from "../src/server/phased/exercise-filters.server.ts";
import { prescribeWeek } from "../src/lib/prescribe-volume.ts";

const completeParq = {
  q1: false,
  q2: false,
  q3: false,
  q4: false,
  q5: false,
  q6: false,
  q7: false,
};

function completeAssessment(overrides: Record<string, unknown> = {}) {
  return {
    parq: completeParq,
    risk: { bmi_category: "normal" },
    experience_level: "intermediate",
    training_days_per_week: 3,
    session_duration_minutes: 60,
    available_equipment: ["dumbbells"],
    no_injuries: true,
    years_training: 2,
    smart_specific: "Build strength",
    smart_measurable: "Add 10 kg to squat",
    no_meds: true,
    readiness_stage: "action",
    sleep_quality: 7,
    ext_meals_per_day: 3,
    waist_cm: 82,
    ext_mob_shoulder: 3,
    ext_mob_hip: 3,
    ext_mob_ankle: 3,
    ext_mob_thoracic: 3,
    ext_mob_wrist: 3,
    ext_mob_knee: 3,
    standing_posture_notes: "Neutral",
    screen_not_assessed: {
      squat: true,
      hinge: true,
      push: true,
      pull: true,
      carry: true,
      lunge: true,
    },
    resting_heart_rate: 62,
    ...overrides,
  };
}

test("screening remains provisional when BP is missing but no clearance trigger exists", () => {
  const result = runPreparticipationAlgorithm({
    assessment: {
      sex: "male",
      age: 30,
      training_days_per_week: 3,
      years_training: 1,
    },
    desired_intensity: "moderate",
  });

  assert.equal(result.clearance_required, false);
  assert.equal(result.cardiac_rehab_bp_exclusion, false);
  assert.equal(result.cvd_risk_factors.hypertension, false);
  assert.equal(result.exerciser_status, "current");
});

test("screening requires clearance when PAR-Q/sign/symptom flags are present", () => {
  const result = runPreparticipationAlgorithm({
    assessment: {
      training_days_per_week: 3,
      years_training: 1,
    },
    signs: { chest_discomfort: true, dizziness_syncope: true },
    desired_intensity: "moderate",
  });

  assert.equal(result.clearance_required, true);
  assert.equal(result.signs_symptoms_present, true);
  assert.deepEqual(result.signs_symptoms_list, ["chest_discomfort", "dizziness_syncope"]);
});

test("screening detects known disease from flags and free text", () => {
  const result = runPreparticipationAlgorithm({
    assessment: {
      med_flags: ["diabetes"],
      medical_conditions: "History of AFib.",
      training_days_per_week: 1,
      years_training: 0,
    },
    desired_intensity: "moderate",
  });

  assert.equal(result.known_disease, true);
  assert.ok(result.known_disease_list.includes("diabetes"));
  assert.ok(result.known_disease_list.includes("arrhythmia"));
  assert.equal(result.clearance_required, true);
});

test("assessmentPhase and completion report expose incomplete assessment state", () => {
  const partial = completeAssessment({
    parq: { q1: false, q2: false },
  });

  assert.equal(assessmentPhase(partial), "self_intake_pending");

  const report = buildCompletionReport(partial);
  assert.equal(report.overall, "self_intake_pending");
  assert.ok(report.selfIntakeMissing.some((item) => item.sectionId === "parq"));
  assert.equal(report.perSection.parq, false);
});

test("derivePhase reports assessment, ready, active, idle, and ended states from current rows", () => {
  assert.equal(
    derivePhase({
      assessment: { smart_specific: "Start training" },
      latestPlan: null,
      latestSessionDate: null,
      currentWeek: null,
    }).kind,
    "assessment",
  );

  assert.equal(
    derivePhase({
      assessment: completeAssessment(),
      latestPlan: null,
      latestSessionDate: null,
      currentWeek: null,
    }).kind,
    "ready",
  );

  assert.deepEqual(
    derivePhase({
      assessment: completeAssessment(),
      latestPlan: { id: "plan-1", status: "draft", duration_weeks: 4, updated_at: "2026-05-01" },
      latestSessionDate: new Date().toISOString(),
      currentWeek: 2,
    }),
    { kind: "active", label: "Active · Block 2", block: 2 },
  );

  const staleDate = new Date(Date.now() - 16 * 86_400_000).toISOString();
  assert.equal(
    derivePhase({
      assessment: completeAssessment(),
      latestPlan: { id: "plan-1", status: "draft", duration_weeks: 4, updated_at: "2026-05-01" },
      latestSessionDate: staleDate,
      currentWeek: 2,
    }).kind,
    "idle",
  );

  assert.equal(
    derivePhase({
      assessment: completeAssessment(),
      latestPlan: { id: "plan-1", status: "finalized", duration_weeks: 4, updated_at: "2026-05-01" },
      latestSessionDate: staleDate,
      currentWeek: 4,
    }).kind,
    "ended",
  );
});

test("planStatusInfo preserves phased stage and complete-plan status behavior", () => {
  assert.deepEqual(
    pickStatus(planStatusInfo({ status: "draft", generation_state: { stage: "brief" } })),
    { key: "brief", label: "Brief" },
  );
  assert.deepEqual(
    pickStatus(planStatusInfo({ status: "draft", generation_state: { stage: "complete" } })),
    { key: "ready", label: "Ready" },
  );
  assert.deepEqual(
    pickStatus(planStatusInfo({ status: "finalized", generation_state: { stage: "complete" } })),
    { key: "finalized", label: "Finalised" },
  );
});

test("deriveInjuryBans escalates low-back restrictions by severity", () => {
  const mild = deriveInjuryBans([{ body_zone: "lumbar", severity: 1 }], []);
  assert.equal(mild.length, 0);

  const moderate = deriveInjuryBans([{ body_zone: "lumbar", severity: 3 }], []);
  assert.ok(moderate.some((ban) => ban.exercise === "conventional deadlift"));
  assert.equal(moderate.some((ban) => ban.exercise === "barbell back squat"), false);

  const severe = deriveInjuryBans([{ body_zone: "lumbar", severity: 4 }], []);
  assert.ok(severe.some((ban) => ban.exercise === "conventional deadlift"));
  assert.ok(severe.some((ban) => ban.exercise === "barbell back squat"));
});

test("prescribeWeek follows entry, peak, adaptation, and deload volume contracts", () => {
  const week1Chest = rowFor(prescribeWeek(1, 4), "chest");
  assert.equal(week1Chest.target, 8);
  assert.equal(week1Chest.min, 8);
  assert.equal(week1Chest.max, 10);

  const week3Chest = rowFor(prescribeWeek(3, 4), "chest");
  assert.equal(week3Chest.target, 14);
  assert.equal(week3Chest.min, 12);
  assert.equal(week3Chest.max, 16);

  const deloadChest = rowFor(prescribeWeek(4, 4), "chest");
  assert.equal(deloadChest.target, 5);
  assert.equal(deloadChest.min, 4);
  assert.equal(deloadChest.max, 6);

  const adaptedBack = rowFor(
    prescribeWeek(1, 4, {
      priorSummary: {
        adherencePct: 95,
        perMuscle: [{ muscle: "back", verdict: "under_loaded", meanRpe: 5, totalSets: 8 }],
      },
    }),
    "back",
  );
  assert.equal(adaptedBack.target, 12);
});

function pickStatus(info: ReturnType<typeof planStatusInfo>) {
  return { key: info.key, label: info.label };
}

function rowFor(week: ReturnType<typeof prescribeWeek>, muscle: string) {
  const row = week.rows.find((candidate) => candidate.muscle === muscle);
  assert.ok(row, `Missing prescription row for ${muscle}`);
  return row;
}
