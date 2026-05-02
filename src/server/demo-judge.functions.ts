import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * judgeDemoRun — uses Lovable AI Gateway to grade a finalized demo plan
 * against the persona's expected_red_flags rubric. Persists the verdict on
 * workout_plans.demo_critique so reopening the dialog is free.
 */

const GradeEnum = z.enum(["A", "B", "C", "D", "F"]);

export const DemoCritiqueSchema = z.object({
  overall_grade: GradeEnum,
  safety_violations: z.array(z.string()).default([]),
  progression_realism: z.object({
    grade: GradeEnum,
    note: z.string(),
  }),
  equipment_adherence: z.object({
    grade: GradeEnum,
    note: z.string(),
  }),
  volume_balance: z.object({
    grade: GradeEnum,
    note: z.string(),
  }),
  red_flag_coverage: z.array(
    z.object({
      flag: z.string(),
      respected: z.boolean(),
      evidence: z.string(),
    })
  ).default([]),
  top_friction_points: z.array(z.string()).max(3).default([]),
  client_summary: z.string(),
  generated_at: z.string(),
  archetype: z.string().nullable(),
});
export type DemoCritique = z.infer<typeof DemoCritiqueSchema>;

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    overall_grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
    safety_violations: { type: "array", items: { type: "string" } },
    progression_realism: {
      type: "object",
      properties: {
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        note: { type: "string" },
      },
      required: ["grade", "note"],
      additionalProperties: false,
    },
    equipment_adherence: {
      type: "object",
      properties: {
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        note: { type: "string" },
      },
      required: ["grade", "note"],
      additionalProperties: false,
    },
    volume_balance: {
      type: "object",
      properties: {
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        note: { type: "string" },
      },
      required: ["grade", "note"],
      additionalProperties: false,
    },
    red_flag_coverage: {
      type: "array",
      items: {
        type: "object",
        properties: {
          flag: { type: "string" },
          respected: { type: "boolean" },
          evidence: { type: "string" },
        },
        required: ["flag", "respected", "evidence"],
        additionalProperties: false,
      },
    },
    top_friction_points: { type: "array", items: { type: "string" } },
    client_summary: { type: "string" },
  },
  required: [
    "overall_grade",
    "safety_violations",
    "progression_realism",
    "equipment_adherence",
    "volume_balance",
    "red_flag_coverage",
    "top_friction_points",
    "client_summary",
  ],
  additionalProperties: false,
} as const;

export const judgeDemoRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        force: z.boolean().optional().default(false),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: plan } = await supabaseAdmin
      .from("workout_plans")
      .select(
        "id, trainer_id, client_id, brief, blueprint, progression_plan, programming_variables, red_flag_accommodations, demo_critique, duration_weeks"
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    if (!data.force && (plan as any).demo_critique) {
      const cached = DemoCritiqueSchema.safeParse((plan as any).demo_critique);
      if (cached.success) return { ok: true as const, critique: cached.data, cached: true };
    }

    // Pull the assessment to find the demo persona + expected red flags.
    const { data: assessment } = await supabaseAdmin
      .from("assessments")
      .select("extended, available_equipment, injuries, medical_conditions, primary_goal, experience_level, training_days_per_week, session_duration_minutes")
      .eq("client_id", (plan as any).client_id)
      .order("performed_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    const demoMeta = (assessment as any)?.extended?.demo_meta ?? null;
    const expectedFlags: string[] = demoMeta?.expected_red_flags ?? [];
    const archetype: string | null = demoMeta?.archetype ?? null;

    // Pull all microcycle days so the judge sees the actual exercise list.
    const { data: days } = await supabaseAdmin
      .from("workout_plan_days")
      .select("week_number, day_number, day_label, focus, content")
      .eq("plan_id", data.planId)
      .order("week_number", { ascending: true })
      .order("day_number", { ascending: true });

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, error: "LOVABLE_API_KEY not configured" };

    const systemPrompt = `You are an expert strength & conditioning coach reviewing an AI-generated training plan for a known persona. Be direct, evidence-based, and specific.

Grade the plan A–F across:
- Safety: did it respect the persona's red-flag constraints (no_axial_loading, bp_monitor, no_valsalva, avoid_overhead, rpe_cap_X, etc.)?
- Progression realism: are RPE/load/volume increases sane week to week? Are weeks 1 and 2 distinguishable?
- Equipment adherence: do all prescribed exercises fit the available_equipment list?
- Volume balance: agonist/antagonist balance, push/pull ratio, leg/hinge balance, exercises per session.

For each expected_red_flag list whether the plan respected it with concrete evidence (exercise name + week/day).
List the 3 highest-friction issues a developer should fix in the prompt/pipeline.
Write a 2-sentence client_summary in plain language a non-technical client could read.`;

    const userContent = JSON.stringify({
      archetype,
      expected_red_flags: expectedFlags,
      assessment_summary: {
        primary_goal: (assessment as any)?.primary_goal,
        experience_level: (assessment as any)?.experience_level,
        training_days_per_week: (assessment as any)?.training_days_per_week,
        session_duration_minutes: (assessment as any)?.session_duration_minutes,
        available_equipment: (assessment as any)?.available_equipment,
        injuries: (assessment as any)?.injuries,
        medical_conditions: (assessment as any)?.medical_conditions,
      },
      brief: (plan as any).brief,
      blueprint: (plan as any).blueprint,
      programming_variables: (plan as any).programming_variables,
      red_flag_accommodations: (plan as any).red_flag_accommodations,
      progression_plan: (plan as any).progression_plan,
      duration_weeks: (plan as any).duration_weeks,
      microcycle: (days ?? []).map((d: any) => ({
        week: d.week_number,
        day: d.day_number,
        label: d.day_label,
        focus: d.focus,
        exercises: (d.content?.exercises ?? []).map((ex: any) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rpe: ex.rpe,
          rest: ex.rest,
          notes: ex.notes,
        })),
      })),
    });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_critique",
              description: "Return the structured critique of the training plan.",
              parameters: TOOL_SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_critique" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text().catch(() => "");
      if (aiRes.status === 429)
        return { ok: false as const, error: "AI rate-limited; try again in a minute." };
      if (aiRes.status === 402)
        return { ok: false as const, error: "AI credits exhausted." };
      console.error("[demo-judge] gateway error", aiRes.status, text.slice(0, 400));
      return { ok: false as const, error: `AI gateway error ${aiRes.status}` };
    }

    const json: any = await aiRes.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) {
      console.error("[demo-judge] no tool call returned", JSON.stringify(json).slice(0, 600));
      return { ok: false as const, error: "AI did not return a structured critique." };
    }
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(argsRaw);
    } catch (e: any) {
      return { ok: false as const, error: "Failed to parse AI critique JSON." };
    }

    const critiqueRes = DemoCritiqueSchema.safeParse({
      ...(parsedArgs as object),
      generated_at: new Date().toISOString(),
      archetype,
    });
    if (!critiqueRes.success) {
      console.error("[demo-judge] schema parse failed", critiqueRes.error.issues);
      return { ok: false as const, error: "AI critique failed schema validation." };
    }

    await supabaseAdmin
      .from("workout_plans")
      .update({ demo_critique: critiqueRes.data as any })
      .eq("id", data.planId);

    return { ok: true as const, critique: critiqueRes.data, cached: false };
  });