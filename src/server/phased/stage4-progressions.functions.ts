import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GenerationStateSchema, ProgressionPlanSchema } from "./schemas";
import { callAnthropicWithSchema, logGeneration, resolveModel } from "./ai.server";

const PROG_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rows"],
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["exercise_id", "dimension", "week_2_delta", "week_3_delta", "week_4_delta"],
        properties: {
          exercise_id: { type: "string" },
          dimension: { type: "string", enum: ["load", "reps", "sets", "intensity_rpe", "tempo", "complexity_variant"] },
          week_2_delta: { type: "string" },
          week_3_delta: { type: "string" },
          week_4_delta: { type: "string" },
          rationale: { type: "string", maxLength: 120 },
        },
      },
    },
  },
};

export const proposeProgressions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("trainer_id, brief, blueprint, duration_weeks")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    const { data: days } = await supabase
      .from("workout_plan_days")
      .select("day_number, content")
      .eq("plan_id", data.planId)
      .eq("week_number", 1)
      .eq("status", "done")
      .order("day_number", { ascending: true });

    const exerciseList: { id: string; name: string; sets: string; reps: string; rpe: string }[] = [];
    for (const d of (days ?? []) as any[]) {
      const exs = d?.content?.exercises ?? [];
      for (const ex of exs) {
        exerciseList.push({
          id: `d${d.day_number}_${ex.name?.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}`,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rpe: ex.rpe,
        });
      }
    }

    const weeks = (plan as any).duration_weeks ?? 4;
    const model = resolveModel("FORGE_MODEL_STAGE_4", "claude-haiku-4-5-20251001");
    const progModel = (plan as any).blueprint?.progression_model_proposal?.model ?? "linear";

    const system = `You are a senior strength coach proposing PROGRESSION DELTAS for weeks 2..${weeks}.

Output ONE row per exercise per dimension that should change. Use the delta DSL:
- load: "+2.5kg" / "+5lb" / "-5%"
- reps: "+1rep" / "-2reps"
- sets: "+1set"
- intensity_rpe: "+0.5rpe"
- tempo: explicit string like "3-1-1-0"
- complexity_variant: text describing variant swap

RULES:
- Progression model: ${progModel}.
- Be conservative for beginners. Skip exercises that are already at target intensity.
- Output empty deltas ("") for weeks where nothing should change.
- Most exercises only need 1 row. Multi-row only when load AND rpe both shift.
- Keep "rationale" under 12 words. Be terse.
- You MUST output AT LEAST ONE row for the main compound lifts (squat/hinge/push/pull patterns) — never return an empty rows array.

Call record_progressions exactly once.`;

    const user = `Mesocycle length: ${weeks} weeks.\nWeek 1 exercise list:\n${JSON.stringify(exerciseList, null, 2)}`;

    const result = await callAnthropicWithSchema({
      model,
      system,
      userMessage: user,
      toolName: "record_progressions",
      toolDescription: "Record per-exercise progression deltas for weeks 2..N.",
      toolJsonSchema: PROG_TOOL_SCHEMA,
      schema: ProgressionPlanSchema,
      maxTokens: 8000,
    });

    await logGeneration(supabase, {
      trainer_id: userId,
      plan_id: data.planId,
      stage: "stage4:progressions",
      model_used: model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      zod_passed: result.ok,
      retry_count: result.retryCount,
      duration_ms: result.durationMs,
      error: result.ok ? null : result.error,
      input_snapshot: { exerciseCount: exerciseList.length, weeks },
      output_snapshot: result.ok ? { rowCount: (result.data as any)?.rows?.length ?? 0 } : { raw: (result as any).zodError ?? null },
    });

    if (!result.ok) return { ok: false as const, error: result.error };

    if (!result.data || !Array.isArray((result.data as any).rows) || (result.data as any).rows.length === 0) {
      return { ok: false as const, error: "AI returned no progression deltas. Try Regenerate." };
    }

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update({ progression_plan: result.data as any })
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };
    return { ok: true as const, progressionPlan: result.data, exerciseList };
  });

export const approveProgressions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid(), progressionPlan: ProgressionPlanSchema }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase
      .from("workout_plans")
      .select("trainer_id, generation_state")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }
    const prev = GenerationStateSchema.safeParse((plan as any).generation_state ?? {});
    const approved = new Set(prev.success ? prev.data.approved_stages : []);
    approved.add("brief");
    approved.add("blueprint");
    approved.add("microcycle");
    approved.add("progressions");
    const newState = GenerationStateSchema.parse({
      stage: "complete",
      approved_stages: Array.from(approved),
      last_updated_at: new Date().toISOString(),
    });
    const { error } = await supabase
      .from("workout_plans")
      .update({ progression_plan: data.progressionPlan as any, generation_state: newState as any })
      .eq("id", data.planId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });