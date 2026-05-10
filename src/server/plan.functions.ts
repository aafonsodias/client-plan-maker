import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildSafetyBlock,
  buildClientContextBlock,
  buildFeedbackBlock,
  SHARED_PROGRAM_RULES,
  buildCockpitConstraintBlock,
} from "./plan.server";
import { criticDay, shouldRepair } from "./plan-critic.server";
import { repairDay } from "./plan-repair.server";
import { computeCallCostUsd, type AnthropicModelId, type CallTelemetry, makeTelemetry } from "./plan-cost.server";
import { anthropicCompatFetch } from "./anthropic-compat.server";
import { buildDeterministicSummary, summaryLooksLeaked } from "./phased/summary.server";
import { pickWaveTier, buildWavePlan } from "./phased/programming-defaults";

// ============================================================================
// Output validation — Zod + structural rules.
// validateExercises returns warnings (non-blocking). Callers persist warnings
// in generation_meta so the trainer/UI can surface them without blocking
// generation on a soft drift from the AI.
// ============================================================================
const ExerciseOutputSchema = z.object({
  name: z.string().min(1),
  sets: z.string(),
  reps: z.string(),
  rest: z.string(),
  notes: z.string(),
  primary_muscles: z.array(z.string()),
  secondary_muscles: z.array(z.string()),
  rpe: z.string(),
  tempo: z.string(),
  technique_cues: z.string(),
  cue: z.string(),
  rationale: z.string(),
  superset_id: z.string().nullable(),
  variant: z.string().nullable(),
  optional: z.boolean(),
  equipment: z.array(z.string()),
});

const BANNED_RATIONALE_PHRASES = [
  "build strength",
  "great for hypertrophy",
  "compound movement",
  "works the whole body",
  "balanced exercise",
  "core lift",
  "fundamental movement",
  "improves overall fitness",
  "good warmup",
  "targets multiple muscles",
];

// Concrete-anchor keywords. A rationale must include either a digit or one of
// these tokens (case-insensitive, word-boundary) to be considered grounded in
// real client data instead of a generic motivational sentence.
const ANCHOR_KEYWORDS = [
  "injury",
  "limitation",
  "history",
  "recovery",
  "equipment",
  "screen",
  "score",
  "rom",
  "mobility",
  "pain",
  "previous",
  "client",
];
const ANCHOR_REGEX = new RegExp(`\\b(${ANCHOR_KEYWORDS.join("|")})\\b`, "i");

function parseRpe(rpe: string): number | null {
  const m = String(rpe ?? "").match(/(\d+(?:\.\d+)?)/g);
  if (!m || m.length === 0) return null;
  // Use the highest number in the range (e.g. "7-8" → 8) as the RPE ceiling.
  return Math.max(...m.map((n) => parseFloat(n)));
}

function detectPhase(focus: string | undefined | null): "hypertrophy" | "strength" | "endurance" | "unknown" {
  const f = String(focus ?? "").toLowerCase();
  if (/(hypertroph|volume|accumul|growth|size)/.test(f)) return "hypertrophy";
  if (/(strength|force|max|peak|intens|power)/.test(f)) return "strength";
  if (/(endur|condition|capacit|aerobic|metcon|stamina)/.test(f)) return "endurance";
  return "unknown";
}

/**
 * Validate the exercises array of a single day. Returns a list of warning
 * strings (empty when clean). Non-blocking by design — caller decides what
 * to do with the warnings (log, persist, surface in UI).
 */
export function validateExercises(
  exercises: unknown,
  context: { day_label?: string | null; focus?: string | null } = {}
): string[] {
  const warnings: string[] = [];
  if (!Array.isArray(exercises)) {
    warnings.push("exercises is not an array");
    return warnings;
  }

  // 1. Per-exercise shape via Zod.
  const parsed: Array<z.infer<typeof ExerciseOutputSchema>> = [];
  exercises.forEach((ex, i) => {
    const r = ExerciseOutputSchema.safeParse(ex);
    if (!r.success) {
      warnings.push(`exercise[${i}] (${(ex as any)?.name ?? "?"}): shape invalid — ${r.error.issues.map((iss) => iss.path.join(".") + ": " + iss.message).join("; ")}`);
    } else {
      parsed.push(r.data);
    }
  });
  if (parsed.length === 0) return warnings;

  const phase = detectPhase(context.focus);

  // 2. Rationale: non-empty, length, banned phrasings.
  parsed.forEach((ex, i) => {
    const r = (ex.rationale ?? "").trim();
    if (!r) {
      warnings.push(`exercise[${i}] (${ex.name}): rationale is empty`);
    } else {
      if (r.length > 200) warnings.push(`exercise[${i}] (${ex.name}): rationale too long (${r.length} chars > 200)`);
      const lower = r.toLowerCase();
      const hits = BANNED_RATIONALE_PHRASES.filter((p) => lower.includes(p));
      if (hits.length) {
        warnings.push(`exercise[${i}] (${ex.name}): rationale uses banned generic phrasing: ${hits.join(", ")}`);
      }
      // Concrete client anchor: at least one digit OR one anchor keyword.
      const hasNumber = /\d/.test(r);
      const hasKeyword = ANCHOR_REGEX.test(r);
      if (!hasNumber && !hasKeyword) {
        warnings.push(`exercise[${i}] (${ex.name}): Rationale must include a concrete client anchor (number or specific constraint)`);
      }
    }
    if (!ex.cue || !ex.cue.trim()) {
      warnings.push(`exercise[${i}] (${ex.name}): cue is empty`);
    }
  });

  // 3. Superset rules.
  const groups = new Map<string, number[]>(); // superset_id → indices
  parsed.forEach((ex, i) => {
    if (ex.superset_id) {
      const arr = groups.get(ex.superset_id) ?? [];
      arr.push(i);
      groups.set(ex.superset_id, arr);
    }
  });
  if (groups.size > 3) {
    warnings.push(`supersets: ${groups.size} groups in this session (max allowed: 3)`);
  }
  for (const [tag, idxs] of groups.entries()) {
    if (idxs.length !== 2) {
      warnings.push(`superset "${tag}": ${idxs.length} exercises share this tag (must be exactly 2)`);
    } else if (idxs[1] !== idxs[0] + 1) {
      warnings.push(`superset "${tag}": exercises at positions ${idxs[0]} and ${idxs[1]} are not consecutive`);
    }
  }
  // No superset_id on a strength-phase main lift (assume index 0 is the main).
  if (phase === "strength" && parsed[0]?.superset_id) {
    warnings.push(`strength-phase main lift "${parsed[0].name}" must not be in a superset (superset_id="${parsed[0].superset_id}")`);
  }

  // 4. Optional rules.
  const optionalIdxs = parsed
    .map((ex, i) => (ex.optional ? i : -1))
    .filter((i) => i >= 0);
  if (optionalIdxs.length > 2) {
    warnings.push(`optional=true count is ${optionalIdxs.length} (max allowed: 2)`);
  }
  if (parsed.length < 4 && optionalIdxs.length > 0) {
    warnings.push(`session has only ${parsed.length} exercises — none should be optional`);
  }
  for (const i of optionalIdxs) {
    const ex = parsed[i];
    // Must be in the last 2 slots.
    if (i < parsed.length - 2) {
      warnings.push(`exercise[${i}] (${ex.name}): optional=true but not in last 2 slots`);
    }
    // Main lift (index 0) can never be optional.
    if (i === 0) {
      warnings.push(`exercise[${i}] (${ex.name}): main lift cannot be optional`);
    }
    // RPE ≤ 7.
    const rpe = parseRpe(ex.rpe);
    if (rpe !== null && rpe > 7) {
      warnings.push(`exercise[${i}] (${ex.name}): optional=true but RPE ${ex.rpe} > 7`);
    }
    // Not in a superset.
    if (ex.superset_id) {
      warnings.push(`exercise[${i}] (${ex.name}): optional=true but is in superset "${ex.superset_id}"`);
    }
  }

  // Tag warnings with day context for easier debugging downstream.
  const label = context.day_label ?? context.focus ?? "day";
  return warnings.map((w) => `[${label}] ${w}`);
}

const WeekInputSchema = z.object({
  client: z.object({
    full_name: z.string(),
    age: z.number().nullable().optional(),
    sex: z.string().nullable().optional(),
    height_cm: z.number().nullable().optional(),
    weight_kg: z.number().nullable().optional(),
  }),
  assessment: z.any(),
  duration_weeks: z.number().min(1).max(16),
  week_number: z.number().min(1).max(16),
  trainer_feedback: z.string().max(4000).nullable().optional(),
  previous_plan: z.any().nullable().optional(),
  // R70 Fase B — Cockpit overrides resolved client-side (stored pv merged
  // with parseRpeOverrideFromFeedback). Optional + permissive so legacy
  // callers (initial draft fan-out) keep working unchanged.
  programming_variables: z
    .object({
      rpe_ceiling: z.number().min(5).max(10).nullable().optional(),
      rpe_floor: z.number().min(5).max(10).nullable().optional(),
      wave_model: z.string().nullable().optional(),
      deload_frequency: z.string().nullable().optional(),
      autoreg_strictness: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const DayInputSchema = z.object({
  plan_id: z.string().uuid(),
  client: z.object({
    full_name: z.string(),
    age: z.number().nullable().optional(),
    sex: z.string().nullable().optional(),
    height_cm: z.number().nullable().optional(),
    weight_kg: z.number().nullable().optional(),
  }),
  assessment: z.any(),
  duration_weeks: z.number().min(1).max(16),
  week_number: z.number().min(1).max(16),
  day_number: z.number().min(1).max(7),
  days_per_week: z.number().min(1).max(7),
  trainer_feedback: z.string().max(4000).nullable().optional(),
  previous_plan: z.any().nullable().optional(),
});

const InputSchema = z.object({
  client: z.object({
    full_name: z.string(),
    age: z.number().nullable().optional(),
    sex: z.string().nullable().optional(),
    height_cm: z.number().nullable().optional(),
    weight_kg: z.number().nullable().optional(),
  }),
  assessment: z.object({
    primary_goal: z.string().nullable().optional(),
    secondary_goals: z.array(z.string()).nullable().optional(),
    experience_level: z.string().nullable().optional(),
    training_days_per_week: z.number().nullable().optional(),
    session_duration_minutes: z.number().nullable().optional(),
    available_equipment: z.array(z.string()).nullable().optional(),
    // Accept legacy string OR canonical array; normalise downstream consumers
    // (PDF, prompt) handle both shapes via Array.isArray checks.
    training_location: z
      .union([z.string(), z.array(z.string())])
      .nullable()
      .optional(),
    injuries: z.string().nullable().optional(),
    medical_conditions: z.string().nullable().optional(),
    preferences: z.string().nullable().optional(),
    sleep_quality: z.number().min(1).max(10).nullable().optional(),
    stress_level: z.number().min(1).max(10).nullable().optional(),
    nutrition_habits: z.string().nullable().optional(),
    hydration_glasses_per_day: z.number().min(0).max(50).nullable().optional(),
    mobility_limitations: z.string().nullable().optional(),
    energy_levels: z.string().nullable().optional(),
    recovery_capacity: z.string().nullable().optional(),
    lifestyle: z.string().nullable().optional(),
    // Posture & alignment
    standing_posture_notes: z.string().nullable().optional(),
    known_imbalances: z.string().nullable().optional(),
    dominant_side: z.string().nullable().optional(),
    // Movement screen
    squat_depth_score: z.number().min(1).max(5).nullable().optional(),
    squat_depth_note: z.string().nullable().optional(),
    overhead_reach_score: z.number().min(1).max(5).nullable().optional(),
    overhead_reach_note: z.string().nullable().optional(),
    hip_hinge_score: z.number().min(1).max(5).nullable().optional(),
    hip_hinge_note: z.string().nullable().optional(),
    single_leg_balance_score: z.number().min(1).max(5).nullable().optional(),
    single_leg_balance_note: z.string().nullable().optional(),
    // Training history
    years_training: z.number().min(0).max(80).nullable().optional(),
    previous_program_style: z.string().nullable().optional(),
    max_lifts: z.string().nullable().optional(),
    // Performance markers
    resting_heart_rate: z.number().min(20).max(220).nullable().optional(),
    cardio_capacity: z.string().nullable().optional(),
    // Clinical safety
    parq_passed: z.boolean().nullable().optional(),
    acsm_risk_category: z.string().nullable().optional(),
    medications: z.string().nullable().optional(),
    med_flags: z.array(z.string()).nullable().optional(),
    safety_override: z.boolean().nullable().optional(),
  }),
  duration_weeks: z.number().min(1).max(16).default(4),
  trainer_feedback: z.string().max(4000).nullable().optional(),
  previous_plan: z
    .object({
      title: z.string().nullable().optional(),
      summary: z.string().nullable().optional(),
      weeks: z
        .array(
          z.object({
            week_number: z.number(),
            focus: z.string().nullable().optional(),
            rationale: z.string().nullable().optional(),
            days: z
              .array(
                z.object({
                  day_label: z.string(),
                  focus: z.string().nullable().optional(),
                  rationale: z.string().nullable().optional(),
                })
              )
              .optional(),
          })
        )
        .optional(),
    })
    .nullable()
    .optional(),
});

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

const PlanSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    weeks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          week_number: { type: "number" },
          focus: { type: "string" },
          rationale: { type: "string" },
          days: {
            type: "array",
            items: {
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
            },
          },
        },
        required: ["week_number", "focus", "rationale", "days"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "summary", "weeks"],
  additionalProperties: false,
} as const;

// Schema for a SINGLE-WEEK generation call. title/summary are emitted on week 1 only.
const WeekDaySchema = {
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

const SingleWeekPlanSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    week: {
      type: "object",
      properties: {
        week_number: { type: "number" },
        focus: { type: "string" },
        rationale: { type: "string" },
        days: { type: "array", items: WeekDaySchema },
      },
      required: ["week_number", "focus", "rationale", "days"],
      additionalProperties: false,
    },
  },
  required: ["title", "summary", "week"],
  additionalProperties: false,
} as const;

export const generatePlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Billing gate: trial OR paid subscription required to generate plans.
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscribers")
      .select("subscribed, current_period_end, trial_end")
      .eq("user_id", userId)
      .maybeSingle();
    const now = Date.now();
    const trialActive = !!(sub?.trial_end && new Date(sub.trial_end).getTime() > now);
    const subActive =
      !!sub?.subscribed &&
      (!sub?.current_period_end || new Date(sub.current_period_end).getTime() > now);
    if (!trialActive && !subActive) {
      return {
        ok: false as const,
        error: "Your free trial has ended. Upgrade to Protocol Pro to keep generating plans.",
        billingRequired: true as const,
      };
    }

    const parqYes = data.assessment.parq_passed === false;
    const risk = (data.assessment.acsm_risk_category ?? "low").toLowerCase();
    const isHighRisk = risk === "high";
    const isModerateRisk = risk === "moderate";
    const medFlags = data.assessment.med_flags ?? [];
    const onBetaBlockers = medFlags.some((m) => /beta.?blocker/i.test(m));
    const onBPMeds = medFlags.some((m) => /blood pressure|hyperten/i.test(m));
    const onAnticoag = medFlags.some((m) => /anticoag/i.test(m));
    const onDiabetesMeds = medFlags.some((m) => /diabet|insulin/i.test(m));

    const safetyConstraints: string[] = [];
    if (isHighRisk || parqYes) {
      safetyConstraints.push(
        "ATTENTION: Client is HIGH RISK or has PAR-Q+ flags. Cap intensity at RPE 6 across all sessions for the first 2 weeks. Avoid Valsalva, max-effort lifts, plyometrics, sprints, and unsupported overhead loading. Prefer machine-based or supported variations. Begin every session with a longer (8–10 min) warm-up. The plan summary MUST start with: 'Conservative starting prescription due to clinical risk markers — review with the client's physician before progressing intensity.'"
      );
    } else if (isModerateRisk) {
      safetyConstraints.push(
        "Client is MODERATE RISK. Cap intensity at RPE 7–8 in the first week and progress conservatively. Avoid max-effort 1RM testing in the first 4 weeks."
      );
    }
    if (onBetaBlockers) {
      safetyConstraints.push(
        "Client is on beta-blockers — heart-rate response is BLUNTED and unreliable. Do NOT use HR-based zones for cardio prescription. Use Borg RPE (6–20) or category RPE (1–10) only. Recommend RPE 11–13 for steady-state and RPE 14–16 for harder intervals."
      );
    }
    if (onBPMeds && !onBetaBlockers) {
      safetyConstraints.push(
        "Client is on blood-pressure medication. Avoid rapid postural changes and prolonged isometric / Valsalva loading. Add a 2-min seated cool-down after each session to prevent post-exercise hypotension."
      );
    }
    if (onAnticoag) {
      safetyConstraints.push(
        "Client is on anticoagulants. Avoid contact, ballistic, or fall-risk drills. Bias to controlled, low-impact, low-risk movement patterns."
      );
    }
    if (onDiabetesMeds) {
      safetyConstraints.push(
        "Client is on diabetes medication / insulin. Schedule sessions 1–2 h after a meal, include a brief carbohydrate cue in the summary, and avoid very long fasted sessions."
      );
    }

    const safetyBlock = safetyConstraints.length
      ? `\n\nCLINICAL SAFETY CONSTRAINTS — these OVERRIDE every other instruction below:\n- ${safetyConstraints.join("\n- ")}`
      : "";

    const sys = `You are an expert strength coach and movement specialist designing PROFESSIONAL-GRADE, periodized programs for serious trainers and their clients. Every program must be HOLISTIC (training + recovery + lifestyle) and STRUCTURED (every session has a complete arc, not just a list of lifts).${safetyBlock}

HARD RULES
- Use ONLY equipment listed in available_equipment. If a piece is missing, substitute.
- Avoid all contraindications: injuries, medical conditions, mobility limitations, and any movement screen item scoring 1–2 (severely restricted).
- Match the requested training_days_per_week and session_duration_minutes — total session time across all sections must fit.
- Return ONLY structured JSON via the emit_workout_plan tool.

SESSION STRUCTURE — every day MUST include these sections in this exact order:
  1. warmup            — 5–10 min: pulse raiser + general joint mobility (e.g. row 3 min, world's greatest stretch x5/side, shoulder CARs).
  2. activation        — 2–4 short drills specific to the day's primary movement patterns (e.g. glute bridge, band pull-apart, dead bug).
  3. dynamic_stretches — movement-prep dynamic stretches that mirror the day's lifts (e.g. leg swings, Spider-Man with reach).
  4. exercises         — main work (the lifts that drive adaptation).
  5. cardio            — per-day cardio prescription calibrated to RHR / cardio_capacity / goal. Use SectionItem shape: name = modality (e.g. "Zone 2 row", "Bike intervals 30/30"), duration = time (e.g. "20 min", "8 rounds"), notes = zone/intensity cue (e.g. "HR 130–140", "RPE 7"). Provide an empty array [] only on a true rest/mobility day.
  6. cooldown          — 3–6 min static stretches targeting the muscles trained.
  7. finisher          — ALWAYS provide an optional finisher (vibroplate / agility ladder / cognitive-motor drill / short conditioning). Set finisher_enabled = true by default unless recovery is very poor (sleep ≤4 OR stress ≥8 OR recovery_capacity "low/poor"), then false.

SECTION ITEM SHAPE — every item in warmup / activation / dynamic_stretches / cooldown / finisher uses { name, duration, notes }. Use empty strings ("") for fields you don't need (never omit the keys). Keep notes short and concrete (a single cue or rep target).

EXERCISE SHAPE — every exercise in the main work MUST populate ALL of these:
- name, sets, reps, rest (concrete: "3", "8-10", "90s")
- primary_muscles[]    — array of primary movers (e.g. ["quadriceps", "glutes"])
- secondary_muscles[]  — array of synergists/stabilizers
- rpe — beginner 6–7, intermediate 7–8, advanced 8–9 (deload at 6)
- tempo — 4-digit eccentric-pause-concentric-pause (e.g. "3-1-1-0", "2-0-X-0")
- technique_cues — legacy field; repeat the same value as 'cue' for backward compat
- cue — ONE short technical cue (≤80 chars) on joint centralization, peak-stretch pause, or breathing.
- rationale — ONE sentence (≤140 chars). MUST be PHASE-CONSISTENT and tie BOTH the day's focus AND a concrete client data point.
    * Hypertrophy phase → TENSION / VOLUME / STIMULUS / time-under-tension / stretch-mediated growth.
    * Strength phase    → FORCE PRODUCTION / LOAD / NEURAL DEMAND / intent / bar speed.
    * Endurance phase   → FATIGUE RESISTANCE / work capacity / repeat-effort tolerance.
    Mixing vocabularies across phases is a HARD FAIL.
    BANNED phrasings: "build strength", "great for hypertrophy", "compound movement", "works the whole body", "balanced exercise", "core lift", "fundamental movement", "improves overall fitness", "good warmup", "targets multiple muscles".
- superset_id — null OR a short tag ("A1"/"A2", "B1"/"B2") when paired. STRICT:
    * EXACTLY 2 exercises share the same tag (never 1, never 3+).
    * Paired exercises MUST be consecutive in the array.
    * Max 2–3 supersets per session.
    * NEVER on a main lift in a STRENGTH-phase day (main = heaviest compound at session start). Hypertrophy/endurance may pair main lifts.
- variant — null OR short modifier ("incline", "deficit", "paused", "tempo", "1.25-rep", "pin"). Plain bench → null.
- optional — boolean. true ONLY for the LAST 1–2 exercises AND RPE ≤ 7 AND a low-priority accessory the client may skip on a hard day. NEVER true for: main lifts, anything in a superset, RPE ≥ 8, primers, or correctives tied to a flagged screen item. <4 working exercises → all false.
- equipment[] — subset of available_equipment.
- notes — programming/substitution context only. Empty string if none.

SELF-CHECK BEFORE EMITTING THE TOOL CALL:
  1. Every rationale uses phase-consistent vocabulary AND cites a concrete client data point. No banned phrasings.
  2. Every superset_id tag appears EXACTLY twice and consecutively. No tag on a strength-phase main lift.
  3. optional=true count ≤ 2, only in the last 2 slots, all RPE ≤ 7, none in supersets, none main lifts.
  Fix violations BEFORE calling emit_workout_plan.

HOLISTIC PERSONALIZATION — you MUST use ALL of the following to calibrate the program (do not just use goal + equipment):
- Sleep quality (1–10): low → reduce volume, easier sessions early in the week, fewer CNS-demanding lifts, lower RPE caps.
- Stress level (1–10): high → moderate intensities, avoid frequent failure work, add at least one parasympathetic / mobility day.
- Hydration & nutrition habits: poor → keep session length realistic, mention a brief fuel/hydration cue in the summary, no extreme prescriptions.
- Mobility limitations: substitute compromised patterns (e.g. swap back squat → goblet or split squat; overhead press → landmine press).
- Energy throughout day: schedule heavier sessions in the client's high-energy window.
- Recovery capacity: low → fewer hard sessions per week, more spacing between same-muscle days, earlier deload.
- Lifestyle: sedentary → add NEAT/step cues; active → standard; very_active → reduce accessory volume so weekly load stays sustainable.
- Posture & alignment + known imbalances + dominant side: bias unilateral work to the weaker side, prioritize correctives that address the imbalance.
- Movement screen scores (1–5 per item): regress or substitute any pattern scoring ≤2; choose progressions that build capacity for items scoring 3.
- Training history (years_training, previous_program_style, max_lifts): set realistic starting loads and progression rates; reference prior style if helpful.
- Performance markers (resting_heart_rate, cardio_capacity): use to set conditioning prescriptions (zones, intervals, durations).

SUMMARY (2–4 sentences) — must explain WHY this program: the holistic reasoning, what was modulated for the client's recovery/lifestyle, what was substituted for movement screen / mobility limits, and any nutrition or recovery cue worth flagging up front.

RATIONALE — every week and every day MUST include a 'rationale' field (1–2 sentences, max 240 chars). It is NOT a summary of the work — it is the CLINICAL DECISION that justifies it. Reference concrete client data (assessment field name + value).
- Week rationale: why THIS block now (e.g. "Volume-accumulation block at RPE 7. Client reports sleep 8/10 and stress 4/10, so capacity to absorb work is high. No deload yet — first 4 weeks of return to training.").
- Day rationale: why THIS session shape (e.g. "Hinge-dominant after 48h CNS recovery from Mon squats. Hip hinge screen scored 3/5, so RDL chosen over conventional deadlift to keep ribcage stacked.").
Avoid generic phrasing like "great workout" or "balanced session" — name the data point that drove the call.`;

    const user = `Client demographics: ${JSON.stringify(data.client)}

Training assessment:
- Primary goal: ${data.assessment.primary_goal ?? "—"}
- Experience: ${data.assessment.experience_level ?? "—"}
- Days/week: ${data.assessment.training_days_per_week ?? "—"}
- Session length: ${data.assessment.session_duration_minutes ?? "—"} min
- Location: ${
      Array.isArray(data.assessment.training_location)
        ? data.assessment.training_location.join(", ")
        : (data.assessment.training_location ?? "—")
    }
- Equipment: ${(data.assessment.available_equipment ?? []).join(", ") || "—"}
- Injuries: ${data.assessment.injuries ?? "—"}
- Medical conditions: ${data.assessment.medical_conditions ?? "—"}
- Preferences/dislikes: ${data.assessment.preferences ?? "—"}

Lifestyle & recovery profile (use these to calibrate the program):
- Sleep quality (1-10): ${data.assessment.sleep_quality ?? "—"}
- Stress level (1-10): ${data.assessment.stress_level ?? "—"}
- Hydration (glasses/day): ${data.assessment.hydration_glasses_per_day ?? "—"}
- Nutrition habits: ${data.assessment.nutrition_habits ?? "—"}
- Mobility limitations: ${data.assessment.mobility_limitations ?? "—"}
- Energy levels through day: ${data.assessment.energy_levels ?? "—"}
- Recovery capacity: ${data.assessment.recovery_capacity ?? "—"}
- Lifestyle: ${data.assessment.lifestyle ?? "—"}

Posture & alignment:
- Standing posture notes: ${data.assessment.standing_posture_notes ?? "—"}
- Known imbalances: ${data.assessment.known_imbalances ?? "—"}
- Dominant side: ${data.assessment.dominant_side ?? "—"}

Movement screen (1 = severely restricted, 5 = full controlled range):
- Squat depth: ${data.assessment.squat_depth_score ?? "—"}${data.assessment.squat_depth_note ? ` (${data.assessment.squat_depth_note})` : ""}
- Overhead reach: ${data.assessment.overhead_reach_score ?? "—"}${data.assessment.overhead_reach_note ? ` (${data.assessment.overhead_reach_note})` : ""}
- Hip hinge: ${data.assessment.hip_hinge_score ?? "—"}${data.assessment.hip_hinge_note ? ` (${data.assessment.hip_hinge_note})` : ""}
- Single-leg balance: ${data.assessment.single_leg_balance_score ?? "—"}${data.assessment.single_leg_balance_note ? ` (${data.assessment.single_leg_balance_note})` : ""}

Training history:
- Years training: ${data.assessment.years_training ?? "—"}
- Previous program style: ${data.assessment.previous_program_style ?? "—"}
- Max lifts: ${data.assessment.max_lifts ?? "—"}

Performance markers:
- Resting heart rate (bpm): ${data.assessment.resting_heart_rate ?? "—"}
- Cardio capacity: ${data.assessment.cardio_capacity ?? "—"}

Clinical safety:
- PAR-Q+ passed: ${data.assessment.parq_passed === null || data.assessment.parq_passed === undefined ? "—" : data.assessment.parq_passed ? "yes" : "NO (one or more flags)"}
- ACSM risk category: ${data.assessment.acsm_risk_category ?? "—"}
- Medications: ${data.assessment.medications ?? "—"}
- Med flags: ${(data.assessment.med_flags ?? []).join(", ") || "—"}

Plan length: ${data.duration_weeks} weeks.`;

    // ---- Feedback loop: trainer corrections from a prior generated plan ----
    const feedback = (data.trainer_feedback ?? "").trim();
    const prev = data.previous_plan;
    let feedbackBlock = "";
    if (feedback || prev) {
      const prevSkeleton = prev
        ? [
            `Previous title: ${prev.title ?? "—"}`,
            `Previous summary: ${prev.summary ?? "—"}`,
            "Previous structure:",
            ...(prev.weeks ?? []).map(
              (w) =>
                `  • Week ${w.week_number} — ${w.focus ?? "—"}${
                  w.rationale ? ` (rationale: ${w.rationale})` : ""
                }\n` +
                (w.days ?? [])
                  .map(
                    (d) =>
                      `      - ${d.day_label}: ${d.focus ?? "—"}${
                        d.rationale ? ` (rationale: ${d.rationale})` : ""
                      }`
                  )
                  .join("\n")
            ),
          ].join("\n")
        : "";

      feedbackBlock = `

TRAINER FEEDBACK ON PREVIOUS DRAFT — this is the most important input for THIS regeneration. The trainer reviewed the previous plan and wants specific changes. Apply these corrections precisely. Keep what worked, change what they flagged. Reflect the changes explicitly in the new week/day rationales (e.g. "Replaced back squat with goblet squat per trainer feedback — knee discomfort flagged.").

Trainer's feedback (verbatim):
${feedback || "(no free-text feedback — use the previous plan as anchor and improve clarity / rationale specificity)"}

${prevSkeleton}`;
    }

    // ---- Wave RPE periodisation (Bompa & Buzzichelli 6e §7.3-7.5) ----
    // The single-shot model collapses to RPE 7 across all weeks unless we
    // explicitly hand it the wave. We always inject it; trainer feedback can
    // shift the anchor but cannot flatten the wave.
    const waveTier = pickWaveTier({
      trainingAgeBand:
        (data.assessment.experience_level ?? "").toLowerCase() === "beginner"
          ? "beginner"
          : (data.assessment.experience_level ?? "").toLowerCase() === "advanced"
          ? "advanced"
          : "intermediate",
      redFlagsCount: (data.assessment.med_flags ?? []).length + (parqYes ? 1 : 0),
      injuryActive: !!(data.assessment.injuries ?? "").trim(),
    });
    const wave = buildWavePlan(waveTier, data.duration_weeks);
    const waveBlock = `

WAVE-LOADING PERIODISATION — apply these RPE caps and volume multipliers EXACTLY (Bompa & Buzzichelli 6e §7.3-7.5). Do NOT flatten — the wave is the program:
${wave
  .map(
    (w) =>
      `  • Week ${w.week} (${w.tag}): RPE ${w.rpe_low}-${w.rpe_high}, volume ×${w.volume_multiplier} (relative to W1 base).`
  )
  .join("\n")}

SET COUNTS — calibrate by training age (NSCA Essentials 3e Cap. 17 + ACSM 12e Cap. 7):
- beginner: 2-3 working sets per main exercise, 1-2 for accessories.
- intermediate: 3-4 sets main, 2-3 accessories.
- advanced: 3-5 sets main, 2-4 accessories.

EXERCISE COUNT PER DAY — at least 5 working exercises in the main 'exercises' section (4 minimum only on a true mobility/recovery day). NEVER collapse below 4 — that is a structural failure, not a creative choice.
`;

    try {
      const res = await anthropicCompatFetch({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 12000,
        system: sys,
        messages: [{ role: "user", content: user + waveBlock + feedbackBlock }],
        tools: [
          {
            name: "emit_workout_plan",
            description: "Emit the structured workout plan",
            input_schema: PlanSchema as unknown as Record<string, unknown>,
          },
        ],
        tool_choice: { type: "tool", name: "emit_workout_plan" },
      });

      if (res.status === 429) {
        return { ok: false as const, error: "AI rate limit reached. Try again in a moment." };
      }
      if (res.status === 529) {
        return { ok: false as const, error: "AI provider overloaded. Try again in a moment." };
      }
      if (!res.ok) {
        const t = await res.text();
        console.error("AI gateway error", res.status, t);
        return { ok: false as const, error: `AI request failed (${res.status}).` };
      }

      const json = await res.json();
      const toolUse = json?.content?.find((b: any) => b.type === "tool_use");
      const args: any = toolUse?.input;
      if (!args) {
        console.error("AI returned no tool call", JSON.stringify(json).slice(0, 1000));
        return { ok: false as const, error: "AI returned no plan." };
      }
      return { ok: true as const, plan: args };
    } catch (err) {
      console.error("Plan draft failed", err);
      return { ok: false as const, error: "Failed to generate plan." };
    }
  });
// =============================================================================
// generatePlanWeek — generates a SINGLE WEEK to dodge upstream timeouts.
// Client fans out one call per week in parallel and merges results.
// Week 1 also returns title + summary; later weeks only return the week object.
// =============================================================================
export const generatePlanWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WeekInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscribers")
      .select("subscribed, current_period_end, trial_end")
      .eq("user_id", userId)
      .maybeSingle();
    const now = Date.now();
    const trialActive = !!(sub?.trial_end && new Date(sub.trial_end).getTime() > now);
    const subActive =
      !!sub?.subscribed &&
      (!sub?.current_period_end || new Date(sub.current_period_end).getTime() > now);
    if (!trialActive && !subActive) {
      return {
        ok: false as const,
        error: "Your free trial has ended. Upgrade to Protocol Pro to keep generating plans.",
        billingRequired: true as const,
      };
    }

    const { week_number, duration_weeks } = data;
    const isFirstWeek = week_number === 1;

    const safetyBlock = buildSafetyBlock(data.assessment);
    const cockpitBlock = buildCockpitConstraintBlock(data.programming_variables ?? null);
    const sys = `You are an expert strength coach designing PROFESSIONAL-GRADE, periodized programs. You are generating ONE WEEK (week ${week_number} of ${duration_weeks}) of a larger periodized block. Be HOLISTIC and STRUCTURED.${safetyBlock}${cockpitBlock}

${SHARED_PROGRAM_RULES}

WEEK FOCUS — this is week ${week_number} of ${duration_weeks}. Calibrate volume/intensity for this week's place in the block:
- Early weeks: introduce patterns, slightly lower RPE, build technique.
- Middle weeks: accumulation, higher volume.
- Final week of a 4-week block: deload OR peak (choose based on goal).
The week's 'focus' and 'rationale' MUST reference its position in the ${duration_weeks}-week block.

${isFirstWeek
  ? "BECAUSE THIS IS WEEK 1, also emit a 'title' (concise, e.g. 'Hypertrophy Foundation – 4 Weeks') and a 'summary' (2–4 sentences explaining WHY this program: holistic reasoning, what was modulated for recovery/lifestyle, what was substituted for movement screen / mobility limits, any nutrition/recovery cue worth flagging)."
  : "Emit a placeholder empty string for 'title' and 'summary' — the orchestrator only uses them from week 1."}

Return ONLY structured JSON via the emit_workout_week tool — emit exactly one 'week' object with week_number = ${week_number}.`;

    const userMsg =
      buildClientContextBlock(data.client, data.assessment, duration_weeks) +
      `\n\nGENERATE: week ${week_number} of ${duration_weeks}.` +
      buildFeedbackBlock(data.trainer_feedback, data.previous_plan);

    try {
      const res = await anthropicCompatFetch({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8000,
        system: sys,
        messages: [{ role: "user", content: userMsg }],
        tools: [
          {
            name: "emit_workout_week",
            description: "Emit one week of the workout plan",
            input_schema: SingleWeekPlanSchema as unknown as Record<string, unknown>,
          },
        ],
        tool_choice: { type: "tool", name: "emit_workout_week" },
      });

      if (res.status === 429) return { ok: false as const, error: "AI rate limit reached. Try again in a moment." };
      if (res.status === 529) return { ok: false as const, error: "AI provider overloaded. Try again in a moment." };
      if (!res.ok) {
        const t = await res.text();
        console.error("AI gateway error (week)", week_number, res.status, t);
        let upstream = t;
        try {
          const parsed = JSON.parse(t);
          upstream = parsed?.error?.message ?? parsed?.message ?? t;
        } catch {}
        return { ok: false as const, error: `AI request failed (${res.status}): ${String(upstream).slice(0, 400)}` };
      }

      const json = await res.json();
      const toolUse = json?.content?.find((b: any) => b.type === "tool_use");
      const args: any = toolUse?.input;
      if (!args) {
        console.error("AI returned no tool call (week)", week_number, JSON.stringify(json).slice(0, 1000));
        return { ok: false as const, error: `AI returned no week ${week_number}.` };
      }
      // Defensive: force the requested week_number.
      if (args?.week) args.week.week_number = week_number;

      // Validate every day's exercises (non-blocking).
      const validationWarnings: string[] = [];
      const days = Array.isArray(args?.week?.days) ? args.week.days : [];
      for (const d of days) {
        validationWarnings.push(
          ...validateExercises(d?.exercises, { day_label: d?.day_label, focus: d?.focus })
        );
      }
      if (validationWarnings.length) {
        console.warn(`[plan-validation] week ${week_number}:`, validationWarnings);
      }

      return {
        ok: true as const,
        week: args.week,
        title: isFirstWeek ? (args.title ?? "") : "",
        summary: isFirstWeek ? (args.summary ?? "") : "",
        validationWarnings,
      };
    } catch (err) {
      console.error("Plan week failed", week_number, err);
      return { ok: false as const, error: `Failed to generate week ${week_number}.` };
    }
  });

// =============================================================================
// generatePlanDay — generates ONE day at a time and persists it immediately to
// workout_plan_days so the flow is fully resumable.
// =============================================================================
const SingleDayPlanSchema = {
  type: "object",
  properties: {
    day: WeekDaySchema,
  },
  required: ["day"],
  additionalProperties: false,
} as const;

export const generatePlanDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DayInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Billing gate.
    const { data: sub } = await supabaseAdmin
      .from("subscribers")
      .select("subscribed, current_period_end, trial_end")
      .eq("user_id", userId)
      .maybeSingle();
    const now = Date.now();
    const trialActive = !!(sub?.trial_end && new Date(sub.trial_end).getTime() > now);
    const subActive =
      !!sub?.subscribed &&
      (!sub?.current_period_end || new Date(sub.current_period_end).getTime() > now);
    if (!trialActive && !subActive) {
      return {
        ok: false as const,
        error: "Your free trial has ended. Upgrade to Protocol Pro to keep generating plans.",
        billingRequired: true as const,
      };
    }

    // Verify the plan belongs to this trainer.
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (planErr || !planRow || planRow.trainer_id !== userId) {
      return { ok: false as const, error: "Plan not found." };
    }

    const { week_number, day_number, days_per_week, duration_weeks } = data;
    const safetyBlock = buildSafetyBlock(data.assessment);

    const sys = `You are an expert strength coach generating ONE TRAINING DAY (day ${day_number} of ${days_per_week}, in week ${week_number} of ${duration_weeks}) of a larger periodized block. Be HOLISTIC and STRUCTURED.${safetyBlock}

${SHARED_PROGRAM_RULES}

DAY CONTEXT — calibrate the day for its slot:
- Day position in the week determines focus split (e.g. push/pull/legs, upper/lower, full-body — choose what fits training_days_per_week=${days_per_week} and the goal).
- Week ${week_number} of ${duration_weeks}: early weeks introduce patterns at slightly lower RPE; middle weeks accumulate volume; final week of a 4-week block is deload OR peak.
- The day's 'rationale' MUST reference both its week position and the client's data (sleep / stress / movement screen / etc.).

Return ONLY structured JSON via the emit_workout_day tool — emit exactly one 'day' object.`;

    const userMsg =
      buildClientContextBlock(data.client, data.assessment, duration_weeks) +
      `\n\nGENERATE: week ${week_number} of ${duration_weeks}, day ${day_number} of ${days_per_week}.` +
      buildFeedbackBlock(data.trainer_feedback, data.previous_plan);

    try {
      const res = await anthropicCompatFetch({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8000,
        system: sys,
        messages: [{ role: "user", content: userMsg }],
        tools: [
          {
            name: "emit_workout_day",
            description: "Emit one training day",
            input_schema: SingleDayPlanSchema as unknown as Record<string, unknown>,
          },
        ],
        tool_choice: { type: "tool", name: "emit_workout_day" },
      });

      if (res.status === 429) return { ok: false as const, error: "AI rate limit reached. Try again in a moment." };
      if (res.status === 529) return { ok: false as const, error: "AI provider overloaded. Try again in a moment." };
      if (!res.ok) {
        const t = await res.text();
        console.error("AI gateway error (day)", week_number, day_number, res.status, t);
        let upstream = t;
        try {
          const parsed = JSON.parse(t);
          upstream = parsed?.error?.message ?? parsed?.message ?? t;
        } catch {}
        return { ok: false as const, error: `AI request failed (${res.status}): ${String(upstream).slice(0, 300)}` };
      }

      const json = await res.json();
      const toolUse = json?.content?.find((b: any) => b.type === "tool_use");
      const args: any = toolUse?.input;
      if (!args) {
        console.error("AI returned no tool call (day)", week_number, day_number);
        return { ok: false as const, error: `AI returned no day ${week_number}/${day_number}.` };
      }

      const day = args?.day;
      if (!day) return { ok: false as const, error: "AI returned empty day." };

      // ---- Generator telemetry from this initial pass ------------------------
      const generateTelemetry: CallTelemetry = makeTelemetry(
        "claude-haiku-4-5-20251001",
        "generate",
        json?.usage,
        0, // duration not tracked here yet — leave 0 for the generator pass
        true
      );

      // ---- CRITIC-REPAIR LOOP -----------------------------------------------
      // Pass 1 (critic) → if blocker/major issues → repair → critic-2.
      // Everything is logged to validation_meta so the trainer can audit it.
      // Failures in critic/repair never block the user — we save the best
      // available draft and surface the unresolved issues in the UI.
      const callLog: CallTelemetry[] = [generateTelemetry];
      let workingDay = day;
      let unresolvedIssues: any[] = [];
      let finalVerdict: "pass" | "needs_repair" | "fail" | "skipped" | "unknown" = "unknown";
      let criticSummary = "";
      let repairAttempted = false;

      const programmaticWarnings = validateExercises(workingDay?.exercises, {
        day_label: workingDay?.day_label,
        focus: workingDay?.focus,
      });
      if (programmaticWarnings.length) {
        console.warn(`[plan-validation] day ${week_number}/${day_number}:`, programmaticWarnings);
      }

      const critic1 = await criticDay({
        model: "claude-haiku-4-5-20251001",
        pass: "critic-1",
        client: data.client,
        assessment: data.assessment,
        duration_weeks,
        week_number,
        day_number,
        days_per_week,
        day: workingDay,
        programmatic_warnings: programmaticWarnings,
      });
      callLog.push(critic1.telemetry);

      if (critic1.ok) {
        criticSummary = critic1.verdict.summary;
        if (shouldRepair(critic1.verdict)) {
          repairAttempted = true;
          const repaired = await repairDay({
            model: "claude-haiku-4-5-20251001",
            client: data.client,
            assessment: data.assessment,
            duration_weeks,
            week_number,
            day_number,
            days_per_week,
            day: workingDay,
            verdict: critic1.verdict,
          });
          callLog.push(repaired.telemetry);
          if (repaired.ok) {
            workingDay = repaired.day;
            // Re-critic the repaired day.
            const programmaticWarnings2 = validateExercises(workingDay?.exercises, {
              day_label: workingDay?.day_label,
              focus: workingDay?.focus,
            });
            const critic2 = await criticDay({
              model: "claude-haiku-4-5-20251001",
              pass: "critic-2",
              client: data.client,
              assessment: data.assessment,
              duration_weeks,
              week_number,
              day_number,
              days_per_week,
              day: workingDay,
              programmatic_warnings: programmaticWarnings2,
            });
            callLog.push(critic2.telemetry);
            if (critic2.ok) {
              finalVerdict = critic2.verdict.verdict;
              criticSummary = critic2.verdict.summary;
              unresolvedIssues = critic2.verdict.issues.filter(
                (i) => i.severity === "blocker" || i.severity === "major"
              );
            } else {
              // Repair worked but critic-2 failed → trust the repair.
              finalVerdict = "unknown";
              unresolvedIssues = [];
            }
          } else {
            // Repair call failed → keep the original day with the original issues.
            finalVerdict = critic1.verdict.verdict;
            unresolvedIssues = critic1.verdict.issues.filter(
              (i) => i.severity === "blocker" || i.severity === "major"
            );
          }
        } else {
          finalVerdict = critic1.verdict.verdict;
          unresolvedIssues = critic1.verdict.issues.filter(
            (i) => i.severity === "blocker" || i.severity === "major"
          );
        }
      } else {
        // Critic-1 failed → save the day, mark verdict skipped.
        finalVerdict = "skipped";
      }

      const totalCostUsd = callLog.reduce((s, c) => s + (c.cost_usd || 0), 0);

      const validation_meta = {
        version: 1,
        final_verdict: finalVerdict,
        critic_summary: criticSummary,
        unresolved_issues: unresolvedIssues,
        programmatic_warnings: programmaticWarnings,
        repair_attempted: repairAttempted,
        total_cost_usd: Number(totalCostUsd.toFixed(6)),
        call_log: callLog,
        completed_at: new Date().toISOString(),
      };

      // Persist final day + meta.
      const { error: upsertErr } = await supabaseAdmin
        .from("workout_plan_days")
        .upsert(
          {
            plan_id: data.plan_id,
            trainer_id: userId,
            week_number,
            day_number,
            day_label: workingDay.day_label ?? `Day ${day_number}`,
            focus: workingDay.focus ?? null,
            rationale: workingDay.rationale ?? null,
            content: workingDay,
            status: "done",
            validation_meta,
          },
          { onConflict: "plan_id,week_number,day_number" }
        );
      if (upsertErr) {
        console.error("Failed to persist day", upsertErr);
        return { ok: false as const, error: `Saved generation but failed to store day ${week_number}/${day_number}.` };
      }

      return {
        ok: true as const,
        day: workingDay,
        week_number,
        day_number,
        validationWarnings: programmaticWarnings,
        validation_meta,
      };
    } catch (err) {
      console.error("Plan day failed", week_number, day_number, err);
      return { ok: false as const, error: `Failed to generate day ${week_number}/${day_number}.` };
    }
  });

// =============================================================================
// getPlanProgress — list which (week, day) pairs already exist for a plan.
// =============================================================================
export const getPlanProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("workout_plan_days")
      .select("week_number, day_number, day_label, focus, rationale, content, validation_meta, updated_at")
      .eq("plan_id", data.plan_id)
      .eq("trainer_id", userId)
      .order("week_number", { ascending: true })
      .order("day_number", { ascending: true });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, days: rows ?? [] };
  });

// =============================================================================
// finalizePlanGeneration — assemble all stored days into plan_data and mark
// the plan complete.
// =============================================================================
export const finalizePlanGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      plan_id: z.string().uuid(),
      title: z.string().optional(),
      summary: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: planRow } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id, duration_weeks, generation_meta, title, summary")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!planRow || planRow.trainer_id !== userId) {
      return { ok: false as const, error: "Plan not found." };
    }

    const { data: dayRows, error } = await supabaseAdmin
      .from("workout_plan_days")
      .select("week_number, day_number, content, validation_meta")
      .eq("plan_id", data.plan_id)
      .order("week_number", { ascending: true })
      .order("day_number", { ascending: true });
    if (error) return { ok: false as const, error: error.message };

    const meta: any = planRow.generation_meta ?? {};
    const weekFocus: Record<string, { focus?: string; rationale?: string }> = meta.week_focus ?? {};

    // Group into weeks.
    const weekMap = new Map<number, any[]>();
    for (const r of dayRows ?? []) {
      const arr = weekMap.get(r.week_number) ?? [];
      arr.push(r.content);
      weekMap.set(r.week_number, arr);
    }
    const weeks = Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([week_number, days]) => ({
        week_number,
        focus: weekFocus[String(week_number)]?.focus ?? `Week ${week_number}`,
        rationale: weekFocus[String(week_number)]?.rationale ?? "",
        days,
      }));

    // Aggregate per-day validation telemetry into a plan-level summary.
    let totalCostUsd = 0;
    const verdictCounts: Record<string, number> = {};
    const allUnresolved: any[] = [];
    let escalations = 0;
    for (const r of dayRows ?? []) {
      const vm: any = r.validation_meta ?? {};
      totalCostUsd += Number(vm.total_cost_usd ?? 0);
      const v = String(vm.final_verdict ?? "unknown");
      verdictCounts[v] = (verdictCounts[v] ?? 0) + 1;
      if (Array.isArray(vm.unresolved_issues) && vm.unresolved_issues.length) {
        for (const i of vm.unresolved_issues) {
          allUnresolved.push({ week: r.week_number, day: r.day_number, ...i });
        }
      }
      if (Array.isArray(vm.call_log) && vm.call_log.some((c: any) => String(c.pass).startsWith("escalate"))) {
        escalations += 1;
      }
    }
    const newGenMeta = {
      ...meta,
      validation: {
        version: 1,
        total_cost_usd: Number(totalCostUsd.toFixed(6)),
        verdict_counts: verdictCounts,
        unresolved_issues: allUnresolved,
        escalated_days: escalations,
        finalized_at: new Date().toISOString(),
      },
    };

    const { error: updErr } = await supabaseAdmin
      .from("workout_plans")
      .update({
        plan_data: { weeks },
        title: data.title || planRow.title,
        summary: data.summary || planRow.summary,
        generation_status: "complete",
        // Flip to "finalized" so dashboards/cards show the plan as live
        // instead of stuck on "Draft" after a successful end-to-end generation.
        // The trainer can still unlock it back to draft from the plan page.
        // TODO: if any day failed, set status to "failed" instead — currently
        // the orchestrator surfaces per-day errors before reaching finalize,
        // so reaching this branch implies all days succeeded.
        status: "finalized",
        generation_meta: newGenMeta,
      })
      .eq("id", data.plan_id);
    if (updErr) return { ok: false as const, error: updErr.message };

    return { ok: true as const };
  });

// =============================================================================
// escalatePlanDay — re-run a single day with the smartest model (Sonnet 4.5)
// when the trainer is unhappy with the Haiku output. Re-uses the critic so we
// can record an escalation verdict alongside the original generator pass.
// Telemetry rolls up into validation_meta with pass tags "escalate-*".
// =============================================================================
const EscalateInputSchema = z.object({
  plan_id: z.string().uuid(),
  client: z.object({
    full_name: z.string(),
    age: z.number().nullable().optional(),
    sex: z.string().nullable().optional(),
    height_cm: z.number().nullable().optional(),
    weight_kg: z.number().nullable().optional(),
  }),
  assessment: z.any(),
  duration_weeks: z.number().min(1).max(16),
  week_number: z.number().min(1).max(16),
  day_number: z.number().min(1).max(7),
  days_per_week: z.number().min(1).max(7),
});

export const escalatePlanDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EscalateInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Billing gate (same as generatePlanDay).
    const { data: sub } = await supabaseAdmin
      .from("subscribers")
      .select("subscribed, current_period_end, trial_end")
      .eq("user_id", userId)
      .maybeSingle();
    const now = Date.now();
    const trialActive = !!(sub?.trial_end && new Date(sub.trial_end).getTime() > now);
    const subActive =
      !!sub?.subscribed &&
      (!sub?.current_period_end || new Date(sub.current_period_end).getTime() > now);
    if (!trialActive && !subActive) {
      return {
        ok: false as const,
        error: "Your free trial has ended. Upgrade to Protocol Pro to keep generating plans.",
        billingRequired: true as const,
      };
    }

    // Verify plan ownership + load existing day for telemetry continuity.
    const { data: planRow } = await supabaseAdmin
      .from("workout_plans")
      .select("id, trainer_id")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!planRow || planRow.trainer_id !== userId) {
      return { ok: false as const, error: "Plan not found." };
    }
    const { data: existingRow } = await supabaseAdmin
      .from("workout_plan_days")
      .select("validation_meta")
      .eq("plan_id", data.plan_id)
      .eq("week_number", data.week_number)
      .eq("day_number", data.day_number)
      .maybeSingle();
    const previousMeta: any = existingRow?.validation_meta ?? {};

    const { week_number, day_number, days_per_week, duration_weeks } = data;
    const ESCALATE_MODEL: AnthropicModelId = "claude-sonnet-4-5-20250929";
    const safetyBlock = buildSafetyBlock(data.assessment);
    const sys = `You are an expert strength coach generating ONE TRAINING DAY (day ${day_number} of ${days_per_week}, in week ${week_number} of ${duration_weeks}). A previous draft was unsatisfactory — produce a clean, professional-grade replacement. Be HOLISTIC and STRUCTURED.${safetyBlock}

${SHARED_PROGRAM_RULES}

Return ONLY structured JSON via the emit_workout_day tool — emit exactly one 'day' object.`;

    const userMsg =
      buildClientContextBlock(data.client, data.assessment, duration_weeks) +
      `\n\nGENERATE: week ${week_number} of ${duration_weeks}, day ${day_number} of ${days_per_week}.`;

    const t0 = Date.now();
    const res = await anthropicCompatFetch({
      model: ESCALATE_MODEL,
      max_tokens: 8000,
      system: sys,
      messages: [{ role: "user", content: userMsg }],
      tools: [
        {
          name: "emit_workout_day",
          description: "Emit one training day",
          input_schema: SingleDayPlanSchema as unknown as Record<string, unknown>,
        },
      ],
      tool_choice: { type: "tool", name: "emit_workout_day" },
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("[escalate] anthropic error", res.status, t.slice(0, 400));
      return { ok: false as const, error: `Escalation failed (${res.status}).` };
    }
    const json = await res.json();
    const usage = json?.usage;
    const elapsed = Date.now() - t0;
    const toolUse = json?.content?.find((b: any) => b.type === "tool_use");
    const day = toolUse?.input?.day;
    if (!day) {
      return { ok: false as const, error: "Escalation returned no day." };
    }
    const generateTel: CallTelemetry = makeTelemetry(ESCALATE_MODEL, "escalate-generate", usage, elapsed, true);

    const programmaticWarnings = validateExercises(day?.exercises, {
      day_label: day?.day_label,
      focus: day?.focus,
    });
    const critic = await criticDay({
      model: ESCALATE_MODEL,
      pass: "escalate-critic",
      client: data.client,
      assessment: data.assessment,
      duration_weeks,
      week_number,
      day_number,
      days_per_week,
      day,
      programmatic_warnings: programmaticWarnings,
    });

    const callLog: CallTelemetry[] = [
      ...(Array.isArray(previousMeta.call_log) ? (previousMeta.call_log as CallTelemetry[]) : []),
      generateTel,
      critic.telemetry,
    ];
    const totalCostUsd = callLog.reduce((s, c) => s + (c.cost_usd || 0), 0);

    const finalVerdict = critic.ok ? critic.verdict.verdict : "skipped";
    const unresolvedIssues = critic.ok
      ? critic.verdict.issues.filter((i) => i.severity === "blocker" || i.severity === "major")
      : [];

    const validation_meta = {
      ...previousMeta,
      version: 1,
      final_verdict: finalVerdict,
      critic_summary: critic.ok ? critic.verdict.summary : previousMeta.critic_summary ?? "",
      unresolved_issues: unresolvedIssues,
      programmatic_warnings: programmaticWarnings,
      repair_attempted: previousMeta.repair_attempted ?? false,
      escalated: true,
      escalated_at: new Date().toISOString(),
      total_cost_usd: Number(totalCostUsd.toFixed(6)),
      call_log: callLog,
      completed_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabaseAdmin
      .from("workout_plan_days")
      .upsert(
        {
          plan_id: data.plan_id,
          trainer_id: userId,
          week_number,
          day_number,
          day_label: day.day_label ?? `Day ${day_number}`,
          focus: day.focus ?? null,
          rationale: day.rationale ?? null,
          content: day,
          status: "done",
          validation_meta,
        },
        { onConflict: "plan_id,week_number,day_number" }
      );
    if (upsertErr) return { ok: false as const, error: `Saved escalation but failed to store day.` };

    return {
      ok: true as const,
      day,
      week_number,
      day_number,
      validationWarnings: programmaticWarnings,
      validation_meta,
    };
  });

/**
 * regeneratePlanSummary — one-shot, deterministic rewrite of a plan's
 * `summary` from the brief. Used to fix legacy plans whose summary leaked
 * AI meta-commentary (e.g. "Sem análises por secção fornecidas…") because
 * they were generated before the deterministic summary builder landed.
 *
 * No AI call. Pure function of `brief` + `duration_weeks`.
 */
export const regeneratePlanSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid(), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan, error } = await supabase
      .from("workout_plans")
      .select("id, trainer_id, brief, duration_weeks, summary")
      .eq("id", data.planId)
      .maybeSingle();
    if (error || !plan) return { ok: false as const, error: error?.message ?? "Not found" };
    if ((plan as any).trainer_id !== userId) return { ok: false as const, error: "forbidden" };

    const brief = (plan as any).brief ?? {};
    if (!brief || Object.keys(brief).length === 0) {
      return { ok: false as const, error: "Sem brief — não dá para gerar resumo determinístico." };
    }
    const weeks = (plan as any).duration_weeks ?? 4;
    const newSummary = buildDeterministicSummary(brief, weeks);

    if (!data.force && !summaryLooksLeaked((plan as any).summary)) {
      // Existing summary looks clean — refuse silently to avoid clobbering.
      return { ok: true as const, summary: (plan as any).summary, changed: false as const };
    }

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update({ summary: newSummary })
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };
    return { ok: true as const, summary: newSummary, changed: true as const };
  });

/**
 * R71 / Phase C1 — single canonical writer for a regenerated phased plan.
 *
 * Why this exists:
 *   The legacy regenerate flow only wrote `workout_plans.plan_data` (JSON
 *   blob). For phased-complete plans the SOURCE OF TRUTH is per-day rows in
 *   `workout_plan_days` — `PlanEditorSurface` rebuilds the view from those
 *   rows on every load and `MicrocyclePanel` keeps a realtime subscription on
 *   them. Result: a fresh regen would render for a heartbeat, then snap back
 *   to the stale day rows ("the workout suddenly reverted"). This fn fixes
 *   the root cause by atomically rewriting day rows AND mirroring a snapshot
 *   into `plan_data` + bumping `plan_data_version`.
 *
 * Behaviour:
 *   - Deletes every existing `workout_plan_days` row for the plan.
 *   - Inserts the supplied weeks/days as fresh rows (status="done").
 *   - Updates `workout_plans.plan_data` (snapshot for legacy/PDF readers),
 *     `title`, `summary`, and bumps `plan_data_version`.
 *   - Optionally writes `programming_variables` overrides + a regen audit
 *     entry into `generation_meta.regeneration_log[]`.
 */
const RegenWeekDayZ = z.object({
  day_label: z.string().nullable().optional(),
  focus: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
  exercises: z.array(z.any()).optional(),
  warmup: z.array(z.any()).optional(),
  activation: z.array(z.any()).optional(),
  dynamic_stretches: z.array(z.any()).optional(),
  cooldown: z.array(z.any()).optional(),
  finisher: z.array(z.any()).optional(),
  finisher_enabled: z.boolean().optional(),
  cardio: z.array(z.any()).optional(),
}).passthrough();

const RegenWeekZ = z.object({
  week_number: z.number().int().min(1),
  focus: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
  days: z.array(RegenWeekDayZ),
}).passthrough();

export const persistRegeneratedPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      planId: z.string().uuid(),
      title: z.string().nullable().optional(),
      summary: z.string().nullable().optional(),
      weeks: z.array(RegenWeekZ).min(1),
      programming_variables: z.record(z.any()).nullable().optional(),
      trainer_feedback: z.string().nullable().optional(),
      override_summary: z.record(z.any()).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan, error } = await supabase
      .from("workout_plans")
      .select("id, trainer_id, plan_data_version, generation_meta")
      .eq("id", data.planId)
      .maybeSingle();
    if (error || !plan) return { ok: false as const, error: error?.message ?? "Not found" };
    if ((plan as any).trainer_id !== userId) return { ok: false as const, error: "forbidden" };

    const trainerId = (plan as any).trainer_id as string;

    // 1. Wipe existing day rows for this plan — single source of truth reset.
    const { error: delErr } = await supabase
      .from("workout_plan_days")
      .delete()
      .eq("plan_id", data.planId);
    if (delErr) return { ok: false as const, error: `delete days: ${delErr.message}` };

    // 2. Insert fresh rows — one per (week, day).
    const rows: any[] = [];
    for (const w of data.weeks) {
      const days = Array.isArray(w.days) ? w.days : [];
      days.forEach((d, idx) => {
        const dayNumber = idx + 1;
        const content: Record<string, any> = {};
        for (const k of [
          "exercises", "warmup", "activation", "dynamic_stretches",
          "cooldown", "finisher", "finisher_enabled", "cardio",
        ] as const) {
          if ((d as any)[k] !== undefined) content[k] = (d as any)[k];
        }
        rows.push({
          plan_id: data.planId,
          trainer_id: trainerId,
          week_number: w.week_number,
          day_number: dayNumber,
          day_label: d.day_label ?? `Day ${dayNumber}`,
          focus: d.focus ?? "",
          rationale: d.rationale ?? "",
          status: "done",
          content,
          validation_meta: {},
        });
      });
    }
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("workout_plan_days").insert(rows);
      if (insErr) return { ok: false as const, error: `insert days: ${insErr.message}` };
    }

    // 3. Update plan: snapshot + bump version + audit log.
    const nextVersion = (((plan as any).plan_data_version as number | null) ?? 1) + 1;
    const meta = ((plan as any).generation_meta ?? {}) as Record<string, any>;
    const log = Array.isArray(meta.regeneration_log) ? meta.regeneration_log : [];
    log.unshift({
      at: new Date().toISOString(),
      version: nextVersion,
      trainer_feedback: data.trainer_feedback ?? null,
      programming_variables: data.programming_variables ?? null,
      summary: data.override_summary ?? null,
      weeks: data.weeks.length,
      total_days: rows.length,
    });
    const nextMeta = { ...meta, regeneration_log: log.slice(0, 20) };

    const update: Record<string, any> = {
      plan_data: { weeks: data.weeks },
      plan_data_version: nextVersion,
      generation_meta: nextMeta,
    };
    if (data.title) update.title = data.title;
    if (data.summary) update.summary = data.summary;
    if (data.programming_variables) update.programming_variables = data.programming_variables;

    const { error: upErr } = await supabase
      .from("workout_plans")
      .update(update)
      .eq("id", data.planId);
    if (upErr) return { ok: false as const, error: `update plan: ${upErr.message}` };

    return {
      ok: true as const,
      plan_data_version: nextVersion,
      days_written: rows.length,
    };
  });
