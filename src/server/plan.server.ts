// Server-only helpers for plan generation. Lives outside *.functions.ts so the
// tss-serverfn-split transformer doesn't drop these on imported handlers.

export type PlanClient = {
  full_name: string;
  age?: number | null;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
};

export type PlanAssessment = Record<string, any>;

export type PreviousPlan = {
  title?: string | null;
  summary?: string | null;
  weeks?: Array<{
    week_number: number;
    focus?: string | null;
    rationale?: string | null;
    days?: Array<{
      day_label: string;
      focus?: string | null;
      rationale?: string | null;
    }>;
  }>;
} | null | undefined;

export function buildSafetyBlock(assessment: PlanAssessment): string {
  const parqYes = assessment?.parq_passed === false;
  const risk = String(assessment?.acsm_risk_category ?? "low").toLowerCase();
  const isHighRisk = risk === "high";
  const isModerateRisk = risk === "moderate";
  const medFlags: string[] = assessment?.med_flags ?? [];
  const onBetaBlockers = medFlags.some((m) => /beta.?blocker/i.test(m));
  const onBPMeds = medFlags.some((m) => /blood pressure|hyperten/i.test(m));
  const onAnticoag = medFlags.some((m) => /anticoag/i.test(m));
  const onDiabetesMeds = medFlags.some((m) => /diabet|insulin/i.test(m));

  const c: string[] = [];
  if (isHighRisk || parqYes) {
    c.push(
      "ATTENTION: Client is HIGH RISK or has PAR-Q+ flags. Cap intensity at RPE 6 across all sessions for the first 2 weeks. Avoid Valsalva, max-effort lifts, plyometrics, sprints, and unsupported overhead loading. Prefer machine-based or supported variations. Begin every session with a longer (8–10 min) warm-up. The plan summary MUST start with: 'Conservative starting prescription due to clinical risk markers — review with the client's physician before progressing intensity.'"
    );
  } else if (isModerateRisk) {
    c.push("Client is MODERATE RISK. Cap intensity at RPE 7–8 in the first week and progress conservatively. Avoid max-effort 1RM testing in the first 4 weeks.");
  }
  if (onBetaBlockers) c.push("Client is on beta-blockers — heart-rate response is BLUNTED and unreliable. Do NOT use HR-based zones for cardio. Use Borg RPE (6–20) or category RPE (1–10). Recommend RPE 11–13 steady-state, RPE 14–16 for intervals.");
  if (onBPMeds && !onBetaBlockers) c.push("Client is on blood-pressure medication. Avoid rapid postural changes and prolonged isometric / Valsalva loading. Add a 2-min seated cool-down after each session.");
  if (onAnticoag) c.push("Client is on anticoagulants. Avoid contact, ballistic, or fall-risk drills. Bias to controlled, low-impact patterns.");
  if (onDiabetesMeds) c.push("Client is on diabetes medication / insulin. Schedule sessions 1–2h after a meal, include a brief carbohydrate cue in the summary, avoid very long fasted sessions.");

  return c.length ? `\n\nCLINICAL SAFETY CONSTRAINTS — these OVERRIDE every other instruction below:\n- ${c.join("\n- ")}` : "";
}

export function buildClientContextBlock(client: PlanClient, a: PlanAssessment, durationWeeks: number): string {
  return `Client demographics: ${JSON.stringify(client)}

Training assessment:
- Primary goal: ${a.primary_goal ?? "—"}
- Experience: ${a.experience_level ?? "—"}
- Days/week: ${a.training_days_per_week ?? "—"}
- Session length: ${a.session_duration_minutes ?? "—"} min
- Location: ${a.training_location ?? "—"}
- Equipment: ${(a.available_equipment ?? []).join(", ") || "—"}
- Injuries: ${a.injuries ?? "—"}
- Medical conditions: ${a.medical_conditions ?? "—"}
- Preferences/dislikes: ${a.preferences ?? "—"}

Lifestyle & recovery:
- Sleep (1-10): ${a.sleep_quality ?? "—"}
- Stress (1-10): ${a.stress_level ?? "—"}
- Hydration glasses/day: ${a.hydration_glasses_per_day ?? "—"}
- Nutrition: ${a.nutrition_habits ?? "—"}
- Mobility limitations: ${a.mobility_limitations ?? "—"}
- Energy through day: ${a.energy_levels ?? "—"}
- Recovery capacity: ${a.recovery_capacity ?? "—"}
- Lifestyle: ${a.lifestyle ?? "—"}

Posture & alignment:
- Standing posture notes: ${a.standing_posture_notes ?? "—"}
- Known imbalances: ${a.known_imbalances ?? "—"}
- Dominant side: ${a.dominant_side ?? "—"}

Movement screen (1=restricted, 5=full):
- Squat depth: ${a.squat_depth_score ?? "—"}${a.squat_depth_note ? ` (${a.squat_depth_note})` : ""}
- Overhead reach: ${a.overhead_reach_score ?? "—"}${a.overhead_reach_note ? ` (${a.overhead_reach_note})` : ""}
- Hip hinge: ${a.hip_hinge_score ?? "—"}${a.hip_hinge_note ? ` (${a.hip_hinge_note})` : ""}
- Single-leg balance: ${a.single_leg_balance_score ?? "—"}${a.single_leg_balance_note ? ` (${a.single_leg_balance_note})` : ""}

Training history:
- Years training: ${a.years_training ?? "—"}
- Previous program style: ${a.previous_program_style ?? "—"}
- Max lifts: ${a.max_lifts ?? "—"}

Performance markers:
- Resting HR (bpm): ${a.resting_heart_rate ?? "—"}
- Cardio capacity: ${a.cardio_capacity ?? "—"}

Clinical safety:
- PAR-Q+ passed: ${a.parq_passed === null || a.parq_passed === undefined ? "—" : a.parq_passed ? "yes" : "NO (one or more flags)"}
- ACSM risk category: ${a.acsm_risk_category ?? "—"}
- Medications: ${a.medications ?? "—"}
- Med flags: ${(a.med_flags ?? []).join(", ") || "—"}

Plan length: ${durationWeeks} weeks total.`;
}

export function buildFeedbackBlock(trainerFeedback: string | null | undefined, prev: PreviousPlan): string {
  const feedback = (trainerFeedback ?? "").trim();
  if (!feedback && !prev) return "";
  const prevSkeleton = prev
    ? [
        `Previous title: ${prev.title ?? "—"}`,
        `Previous summary: ${prev.summary ?? "—"}`,
        "Previous structure:",
        ...(prev.weeks ?? []).map(
          (w) =>
            `  • Week ${w.week_number} — ${w.focus ?? "—"}${w.rationale ? ` (rationale: ${w.rationale})` : ""}\n` +
            (w.days ?? [])
              .map((d) => `      - ${d.day_label}: ${d.focus ?? "—"}${d.rationale ? ` (rationale: ${d.rationale})` : ""}`)
              .join("\n")
        ),
      ].join("\n")
    : "";

  return `\n\nTRAINER FEEDBACK ON PREVIOUS DRAFT — most important input. Apply corrections precisely. Reflect changes explicitly in week/day rationales.\n\nTrainer's feedback (verbatim):\n${feedback || "(no free-text feedback — use the previous plan as anchor and improve clarity / rationale specificity)"}\n\n${prevSkeleton}`;
}

export const SHARED_PROGRAM_RULES = `HARD RULES
- Use ONLY equipment listed in available_equipment. If a piece is missing, substitute.
- Avoid all contraindications: injuries, medical conditions, mobility limitations, and any movement screen item scoring 1–2 (severely restricted).
- Match the requested training_days_per_week and session_duration_minutes — total session time across all sections must fit.
- Return ONLY structured JSON via the emit_workout_week tool.

SESSION STRUCTURE — every day MUST include in this exact order:
  1. warmup (5–10 min pulse raiser + joint mobility)
  2. activation (2–4 short drills)
  3. dynamic_stretches (movement-prep)
  4. exercises (main work)
  5. cardio (per-day prescription; empty array [] only on a true rest/mobility day; SectionItem shape)
  6. cooldown (3–6 min static)
  7. finisher (always provide; finisher_enabled=false only if sleep ≤4 OR stress ≥8 OR recovery low)

SECTION ITEM SHAPE — { name, duration, notes }. Use empty strings ("") for unused fields. Keep notes short.

EXERCISE SHAPE — every exercise MUST populate: name, sets, reps, rest, primary_muscles[], secondary_muscles[], rpe (calibrated to experience: beginner 6–7, intermediate 7–8, advanced 8–9), tempo (4-digit e.g. "3-1-1-0"), technique_cues (1–2 cues on JOINT CENTRALIZATION, PAUSE AT PEAK STRETCH, BREATHING), equipment[] (subset of available_equipment), notes (programming context, "" if none).

PERSONALIZATION — calibrate to sleep, stress, hydration, nutrition, mobility limits, energy, recovery capacity, lifestyle, posture, imbalances, dominant side, movement screen scores (≤2 → regress/substitute), training history, RHR, cardio_capacity.

RATIONALE — every week and every day MUST include a 'rationale' (1–2 sentences, max 240 chars) referencing concrete client data fields. Avoid generic phrasing.`;