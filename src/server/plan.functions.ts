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

    const sys = `You are an expert personal trainer designing safe, effective, periodized programs.
Generate a structured workout plan tailored to the client.
- Use only equipment listed.
- Avoid contraindications (injuries / medical conditions).
- Match number of training days and session duration.
- Provide concrete sets/reps/rest. Keep notes short (form cues).
- Include a brief summary (2-3 sentences).
Return ONLY structured JSON via the tool.`;

    const user = `Client: ${JSON.stringify(data.client)}
Assessment: ${JSON.stringify(data.assessment)}
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