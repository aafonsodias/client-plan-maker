import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildSafetyBlock,
  buildClientContextBlock,
  buildFeedbackBlock,
  SHARED_PROGRAM_RULES,
} from "./plan.server";

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
    training_location: z.string().nullable().optional(),
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
                      equipment: { type: "array", items: { type: "string" } },
                    },
                    required: [
                      "name", "sets", "reps", "rest", "notes",
                      "primary_muscles", "secondary_muscles",
                      "rpe", "tempo", "technique_cues", "equipment",
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
          equipment: { type: "array", items: { type: "string" } },
        },
        required: [
          "name", "sets", "reps", "rest", "notes",
          "primary_muscles", "secondary_muscles",
          "rpe", "tempo", "technique_cues", "equipment",
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
        error: "Your free trial has ended. Upgrade to Forge Pro to keep generating plans.",
        billingRequired: true as const,
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI gateway is not configured." };
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
- name
- sets, reps, rest (concrete: "3", "8-10", "90s")
- primary_muscles      — array of primary movers (e.g. ["quadriceps", "glutes"])
- secondary_muscles    — array of synergists/stabilizers (e.g. ["hamstrings", "core"])
- rpe                  — target RPE on the 1–10 scale, calibrated to experience:
    * beginner → 6–7
    * intermediate → 7–8
    * advanced → 8–9 (with deload weeks at 6)
- tempo                — 4-digit tempo notation eccentric-pause-concentric-pause, e.g. "3-1-1-0", "2-0-X-0", "4-2-1-0"
- technique_cues       — 1–2 short technique cues focused on JOINT CENTRALIZATION, PAUSE AT PEAK STRETCH, and BREATHING PATTERN. Examples: "Brace and exhale on press; ribs stacked over pelvis." or "Pause 1s in the deepest stretch; drive knees out, big toe planted."
- equipment            — array listing only the equipment used (must be a subset of available_equipment)
- notes                — programming/substitution context only (e.g. "Drop 10% on week 3 if bar speed slows"). Empty string if nothing to add.

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
- Location: ${data.assessment.training_location ?? "—"}
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

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user + feedbackBlock },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "emit_workout_plan",
                description: "Emit the structured workout plan",
                parameters: PlanSchema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "emit_workout_plan" } },
        }),
      });

      if (res.status === 429) {
        return { ok: false as const, error: "AI rate limit reached. Try again in a moment." };
      }
      if (res.status === 402) {
        return { ok: false as const, error: "AI credits exhausted. Add credits in workspace settings." };
      }
      if (!res.ok) {
        const t = await res.text();
        console.error("AI gateway error", res.status, t);
        return { ok: false as const, error: `AI request failed (${res.status}).` };
      }

      const json = await res.json();
      const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
      const argsRaw = toolCall?.function?.arguments;
      if (!argsRaw) {
        console.error("AI returned no tool call", JSON.stringify(json).slice(0, 1000));
        return { ok: false as const, error: "AI returned no plan." };
      }
      let args: any;
      try {
        args = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
      } catch (e) {
        console.error("Failed to parse plan JSON", e);
        return { ok: false as const, error: "AI returned malformed plan." };
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
        error: "Your free trial has ended. Upgrade to Forge Pro to keep generating plans.",
        billingRequired: true as const,
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI gateway is not configured." };

    const { week_number, duration_weeks } = data;
    const isFirstWeek = week_number === 1;

    const safetyBlock = buildSafetyBlock(data.assessment);
    const sys = `You are an expert strength coach designing PROFESSIONAL-GRADE, periodized programs. You are generating ONE WEEK (week ${week_number} of ${duration_weeks}) of a larger periodized block. Be HOLISTIC and STRUCTURED.${safetyBlock}

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
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "emit_workout_week",
                description: "Emit one week of the workout plan",
                parameters: SingleWeekPlanSchema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "emit_workout_week" } },
        }),
      });

      if (res.status === 429) return { ok: false as const, error: "AI rate limit reached. Try again in a moment." };
      if (res.status === 402) return { ok: false as const, error: "AI credits exhausted. Add credits in workspace settings." };
      if (!res.ok) {
        const t = await res.text();
        console.error("AI gateway error (week)", week_number, res.status, t);
        return { ok: false as const, error: `AI request failed (${res.status}).` };
      }

      const json = await res.json();
      const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
      const argsRaw = toolCall?.function?.arguments;
      if (!argsRaw) {
        console.error("AI returned no tool call (week)", week_number, JSON.stringify(json).slice(0, 1000));
        return { ok: false as const, error: `AI returned no week ${week_number}.` };
      }
      let args: any;
      try {
        args = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
      } catch (e) {
        console.error("Failed to parse week JSON", week_number, e);
        return { ok: false as const, error: `AI returned malformed week ${week_number}.` };
      }
      // Defensive: force the requested week_number.
      if (args?.week) args.week.week_number = week_number;
      return {
        ok: true as const,
        week: args.week,
        title: isFirstWeek ? (args.title ?? "") : "",
        summary: isFirstWeek ? (args.summary ?? "") : "",
      };
    } catch (err) {
      console.error("Plan week failed", week_number, err);
      return { ok: false as const, error: `Failed to generate week ${week_number}.` };
    }
  });
