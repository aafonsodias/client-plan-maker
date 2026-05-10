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

/**
 * Cockpit constraint block — injected into the system prompt as a HARD rule.
 * Called from buildClientContextBlock when programming_variables are passed
 * (regen path). The model must respect rpe_ceiling as a non-negotiable cap on
 * main-lift RPE; accessories sit one notch below; carries two notches.
 */
export function buildCockpitConstraintBlock(pv: {
  rpe_ceiling?: number | null;
  rpe_floor?: number | null;
  wave_model?: string | null;
  deload_frequency?: string | null;
  autoreg_strictness?: string | null;
} | null | undefined): string {
  if (!pv) return "";
  const lines: string[] = [];
  if (typeof pv.rpe_ceiling === "number") {
    const ceiling = pv.rpe_ceiling;
    const acc = Math.max(5.5, ceiling - 1);
    const car = Math.max(5, ceiling - 2);
    lines.push(
      `RPE CEILING (HARD): main-lift sets RPE ≤ ${ceiling}. Accessories RPE ≤ ${acc}. Carries / core / mobility RPE ≤ ${car}. Do NOT exceed under any circumstance, even if the trainer feedback below seems to ask for more intensity.`,
    );
  }
  if (typeof pv.rpe_floor === "number") {
    lines.push(`RPE FLOOR: do not prescribe main lifts below RPE ${pv.rpe_floor} (under-stimulus risk).`);
  }
  if (pv.wave_model) {
    lines.push(`Wave model: ${pv.wave_model} (the orchestrator handles week-to-week wave; you only design THIS week's anchor RPE).`);
  }
  if (pv.deload_frequency) {
    lines.push(`Deload frequency: ${pv.deload_frequency}.`);
  }
  if (!lines.length) return "";
  return `\n\nCOCKPIT CONSTRAINTS (trainer locked these via the Intensity Cockpit — apply BEFORE the trainer's free-text feedback):\n- ${lines.join("\n- ")}`;
}

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
- Location: ${Array.isArray((a as any).training_location) ? (a as any).training_location.join(", ") : (a.training_location ?? "—")}
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

EXERCISE SHAPE — every exercise MUST populate ALL of:
- name, sets, reps, rest
- primary_muscles[], secondary_muscles[]
- rpe (beginner 6–7, intermediate 7–8, advanced 8–9)
- tempo (4-digit eccentric-pause-concentric-pause, e.g. "3-1-1-0")
- cue — ONE short technical cue (≤80 chars).
  Focus: joint centralization, stability, breathing, or stretch control.
  Example: "Brace ribs over pelvis, exhale on press."
- technique_cues — legacy field. MUST be identical to \`cue\`.
- rationale — ONE sentence (≤140 chars). MUST:
    1) match the CURRENT PHASE (see below),
    2) reference the DAY focus,
    3) include a CONCRETE client anchor.
  HARD REQUIREMENT: rationale MUST include at least one of:
    - a number (e.g. "3/5", "low score")
    - OR a concrete constraint (injury, equipment, recovery, limitation).
  If not → rewrite.

  PHASE-CONSISTENT VOCABULARY (STRICT):
    Hypertrophy → tension, volume, stimulus, time-under-tension,
      stretch-mediated growth, lengthened position
    Strength → force production, load, neural demand,
      bar speed, intent, motor unit recruitment
    Endurance → fatigue resistance, work capacity,
      repeat-effort tolerance, aerobic/anaerobic demand
  HARD RULE: DO NOT mix vocabularies across phases.

  BANNED (auto-rewrite if used):
    "build strength", "great for hypertrophy", "compound movement",
    "works the whole body", "balanced exercise", "core lift",
    "fundamental movement", "improves overall fitness",
    "targets multiple muscles".

  GOOD examples:
    Hypertrophy: "Stretch-biased quad volume — 3/5 squat screen; deep ROM increases tension at length."
    Strength:    "High force output — strong hinge history supports heavy loading with intent."
    Endurance:   "Repeat-effort demand — low cardio score; builds local fatigue resistance safely."

- superset_id — null OR a short tag ("A", "B", "C"). RULES:
    * Each superset_id can appear ONLY twice in the entire session
    * MUST be consecutive in the list
    * Max 3 supersets per session (6 exercises total paired)
    * If unpaired → null
    * Strength phase: main lift MUST NOT be in a superset

- variant — null OR a short modifier
  ("incline", "paused", "tempo", "deficit", "1.25-rep", etc.).
  Do NOT include equipment here.

- optional — boolean. RULES:
    * true ONLY if: low-priority accessory or finisher AND RPE ≤ 7
    * Max 2 per session
    * SHOULD be near end of session
    * NEVER: main lift, inside supersets, corrective tied to a limitation

- equipment[] — MUST be subset of available_equipment
- notes — programming context or ""

----------------------------------------
STRUCTURAL LOGIC (IMPORTANT)

1. The session is ordered:
   primer → main lift → secondary → accessories → optional
2. The MAIN LIFT is:
   the FIRST exercise in the session with RPE ≥ 8.
   If none → the first exercise in the list.
3. Supersets are ONLY for:
   accessories or secondary work (except hypertrophy phases)
4. Do NOT force supersets or optional exercises if not needed.

----------------------------------------
QUALITY CONTROL — BEFORE EMITTING

Check ALL:
1. Rationale: phase-consistent vocabulary? references real client data?
   not generic? contains number or concrete constraint?
2. Supersets: each tag exactly twice; exercises consecutive;
   max 3 groups; no main lift in superset during strength phase.
3. Optional: ≤ 2 exercises; RPE ≤ 7; not main lift; not in superset.
4. Cue: short, technical, actionable.

If ANY rule fails → FIX before output.

----------------------------------------
OUTPUT FORMAT

Return structured JSON only via tool call. No explanations. No extra text.

PERSONALIZATION — calibrate to sleep, stress, hydration, nutrition, mobility limits, energy, recovery capacity, lifestyle, posture, imbalances, dominant side, movement screen scores (≤2 → regress/substitute), training history, RHR, cardio_capacity.

RATIONALE — every week and every day MUST include a 'rationale' (1–2 sentences, max 240 chars) referencing concrete client data fields. Avoid generic phrasing.`;

// =============================================================================
// JSON schemas — shared between generator, critic-repair, and escalation paths.
// Kept in plan.server.ts (not .functions.ts) so server-only modules can reuse
// them without being affected by the createServerFn build transform.
// =============================================================================
const SectionItemSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    duration: { type: "string" },
    notes: { type: "string" },
  },
  required: ["name", "duration", "notes"],
  additionalProperties: false,
} as const;

export const WeekDaySchema = {
  type: "object",
  properties: {
    day_label: { type: "string" },
    focus: { type: "string" },
    rationale: { type: "string" },
    warmup: { type: "array", items: SectionItemSchema },
    activation: { type: "array", items: SectionItemSchema },
    dynamic_stretches: { type: "array", items: SectionItemSchema },
    cooldown: { type: "array", items: SectionItemSchema },
    finisher: { type: "array", items: SectionItemSchema },
    finisher_enabled: { type: "boolean" },
    cardio: { type: "array", items: SectionItemSchema },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          sets: { type: "string" },
          reps: { type: "string" },
          rest: { type: "string" },
          notes: { type: "string" },
          primary_muscles: { type: "array", items: { type: "string" } },
          secondary_muscles: { type: "array", items: { type: "string" } },
          rpe: { type: "string" },
          tempo: { type: "string" },
          technique_cues: { type: "string" },
          cue: { type: "string" },
          rationale: { type: "string" },
          superset_id: { type: ["string", "null"] },
          variant: { type: ["string", "null"] },
          optional: { type: "boolean" },
          equipment: { type: "array", items: { type: "string" } },
        },
        required: [
          "name", "sets", "reps", "rest", "notes",
          "primary_muscles", "secondary_muscles",
          "rpe", "tempo", "technique_cues", "cue",
          "rationale", "superset_id", "variant", "optional", "equipment",
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    "day_label", "focus", "rationale", "exercises",
    "warmup", "activation", "dynamic_stretches",
    "cooldown", "finisher", "finisher_enabled", "cardio",
  ],
  additionalProperties: false,
} as const;

export const SingleDayPlanSchema = {
  type: "object",
  properties: {
    day: WeekDaySchema,
  },
  required: ["day"],
  additionalProperties: false,
} as const;