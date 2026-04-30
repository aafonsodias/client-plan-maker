import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  }),
  duration_weeks: z.number().min(1).max(16).default(4),
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
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day_label: { type: "string" },
                focus: { type: "string" },
                warmup: { type: "array", items: SectionItemSchema },
                activation: { type: "array", items: SectionItemSchema },
                dynamic_stretches: { type: "array", items: SectionItemSchema },
                cooldown: { type: "array", items: SectionItemSchema },
                finisher: { type: "array", items: SectionItemSchema },
                finisher_enabled: { type: "boolean" },
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
                "day_label", "focus", "exercises",
                "warmup", "activation", "dynamic_stretches",
                "cooldown", "finisher", "finisher_enabled",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["week_number", "focus", "days"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "summary", "weeks"],
  additionalProperties: false,
} as const;

export const generatePlanDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI is not configured." };
    }

    const sys = `You are an expert strength coach and movement specialist designing PROFESSIONAL-GRADE, periodized programs for serious trainers and their clients. Every program must be HOLISTIC (training + recovery + lifestyle) and STRUCTURED (every session has a complete arc, not just a list of lifts).

HARD RULES
- Use ONLY equipment listed in available_equipment. If a piece is missing, substitute.
- Avoid all contraindications: injuries, medical conditions, mobility limitations, and any movement screen item scoring 1–2 (severely restricted).
- Match the requested training_days_per_week and session_duration_minutes — total session time across all sections must fit.
- Return ONLY structured JSON via the emit_workout_plan tool.

SESSION STRUCTURE — every day MUST include these sections in this exact order:
  1. warmup            — 5–10 min: pulse raiser + general joint mobility (e.g. row 3 min, world's greatest stretch x5/side, shoulder CARs).
  2. activation        — 2–4 short drills specific to the day's primary movement patterns (e.g. glute bridge, band pull-apart, dead bug).
  3. dynamic_stretches — movement-prep dynamic stretches that mirror the day's lifts (e.g. leg swings, Spider-Man with reach).
  4. exercises         — main work (the lifts/conditioning that drive adaptation).
  5. cooldown          — 3–6 min static stretches targeting the muscles trained.
  6. finisher          — ALWAYS provide an optional finisher (vibroplate work / agility ladder / cognitive-motor drill / short conditioning piece). Set finisher_enabled = true by default unless the client's recovery profile is very poor (sleep ≤4 OR stress ≥8 OR recovery_capacity describes "low/poor"), in which case set finisher_enabled = false.

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

SUMMARY (2–4 sentences) — must explain WHY this program: the holistic reasoning, what was modulated for the client's recovery/lifestyle, what was substituted for movement screen / mobility limits, and any nutrition or recovery cue worth flagging up front.`;

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

Plan length: ${data.duration_weeks} weeks.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
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

      if (res.status === 429) return { ok: false as const, error: "AI rate limit reached. Try again in a moment." };
      if (res.status === 402) return { ok: false as const, error: "AI credits exhausted. Add credits in Lovable Cloud." };
      if (!res.ok) {
        const t = await res.text();
        console.error("AI gateway error", res.status, t);
        return { ok: false as const, error: `AI request failed (${res.status}).` };
      }

      const json = await res.json();
      const call = json?.choices?.[0]?.message?.tool_calls?.[0];
      const args = call?.function?.arguments;
      if (!args) return { ok: false as const, error: "AI returned no plan." };
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      return { ok: true as const, plan: parsed };
    } catch (err) {
      console.error("Plan draft failed", err);
      return { ok: false as const, error: "Failed to generate plan." };
    }
  });