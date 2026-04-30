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
  }),
  duration_weeks: z.number().min(1).max(16).default(4),
});

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
                    },
                    required: ["name", "sets", "reps", "rest", "notes"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["day_label", "focus", "exercises"],
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

    const sys = `You are an expert personal trainer and strength coach designing safe, effective, periodized programs that are HOLISTIC — they account for training, recovery, nutrition, and lifestyle together.

Hard rules:
- Use ONLY equipment listed.
- Avoid all contraindications (injuries, medical conditions, mobility limitations).
- Match the requested number of training days/week and session duration.
- Provide concrete sets/reps/rest. Keep exercise notes short (form cues, RPE, tempo).

Holistic adjustments — you MUST modulate volume, intensity, and exercise selection based on the client's recovery and lifestyle profile:
- Sleep quality (1–10): low scores → reduce overall volume, prioritize easier sessions early in the week, lower CNS-demanding lifts.
- Stress level (1–10): high scores → favor moderate intensity, avoid frequent failure work, add at least one mobility/parasympathetic-focused day.
- Hydration / nutrition habits: poor habits → keep session duration realistic, add a brief "fuel & hydration" cue in the summary; do not prescribe extreme cuts.
- Mobility limitations: substitute compromised patterns (e.g. swap back squat for goblet/box squat or split squat).
- Energy levels through the day: schedule heavier sessions when the client reports highest energy; lighter / accessory work when energy dips.
- Recovery capacity: low recovery → fewer hard sessions, more spacing between same-muscle days, deload week earlier.
- Lifestyle (sedentary / active / very_active):
    * sedentary → include daily-step / NEAT cues and prioritize basic movement quality;
    * active → standard programming;
    * very_active → reduce accessory volume so total weekly load stays manageable.

Summary (2–4 sentences) MUST explicitly explain the holistic reasoning: why this volume/intensity, what was adjusted for sleep/stress/lifestyle, and any nutrition/recovery cues.

Return ONLY structured JSON via the tool.`;

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

Plan length: ${data.duration_weeks} weeks.`;

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