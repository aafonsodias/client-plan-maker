import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BlueprintSchema,
  BriefSchema,
  GenerationStateSchema,
  type GenerationStage,
  DOWNSTREAM_OF,
} from "./schemas";
import { callAnthropicWithSchema, logGeneration, resolveModel } from "./ai.server";

const BLUEPRINT_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "mesocycle_length_weeks",
    "sessions_per_week",
    "session_archetypes",
    "week_to_session_map",
    "progression_model_proposal",
  ],
  properties: {
    mesocycle_length_weeks: { type: "integer", minimum: 2, maximum: 12 },
    sessions_per_week: { type: "integer", minimum: 1, maximum: 7 },
    session_archetypes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "focus", "primary_movements"],
        properties: {
          id: { type: "string" },
          focus: { type: "string" },
          primary_movements: { type: "array", items: { type: "string" } },
        },
      },
    },
    week_to_session_map: {
      type: "object",
      additionalProperties: { type: "array", items: { type: "string" } },
    },
    progression_model_proposal: {
      type: "object",
      additionalProperties: false,
      required: ["model", "rationale"],
      properties: {
        model: { type: "string", enum: ["linear", "undulating", "block"] },
        rationale: { type: "string" },
      },
    },
  },
};

function clearDownstream(stage: GenerationStage) {
  const downstream = DOWNSTREAM_OF[stage];
  const out: Record<string, null> = {};
  if (downstream.includes("progressions")) out.progression_plan = null;
  return out;
}

export const generateBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("id, trainer_id, brief, duration_weeks")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }
    const briefParsed = BriefSchema.safeParse((plan as any).brief);
    if (!briefParsed.success) {
      return { ok: false as const, error: "Brief is missing or invalid. Approve brief first." };
    }
    const brief = briefParsed.data;
    const weeks = (plan as any).duration_weeks ?? brief.mesocycle_length_weeks ?? 4;

    const system = `You are a senior strength coach designing a MESOCYCLE BLUEPRINT.

OUTPUT ONLY THE SKELETON — no exercises, no sets/reps. The blueprint defines:
- session_archetypes: 2–5 distinct session templates (e.g. {id:"lower_squat", focus:"Lower — Squat focus", primary_movements:["back squat","hinge"]}).
- week_to_session_map: keys are week numbers ("1".."${weeks}"), values are arrays of archetype ids, length = sessions_per_week. Same map across weeks unless variation is justified.
- progression_model_proposal: pick "linear" (novice/strength), "undulating" (intermediate/hypertrophy), or "block" (advanced).

RULES:
- sessions_per_week MUST equal brief.sessions_per_week.recommended (${brief.sessions_per_week.recommended}).
- mesocycle_length_weeks MUST equal ${weeks}.
- archetype ids: lowercase snake_case, unique.
- Respect red_flags and equipment_constraints when naming archetypes.

Call record_blueprint with valid input.`;

    const user = `Brief:\n${JSON.stringify(brief, null, 2)}\n\nMesocycle length: ${weeks} weeks.`;

    const model = resolveModel("FORGE_MODEL_STAGE_2", "claude-haiku-4-5-20251001");
    const result = await callAnthropicWithSchema({
      model,
      system,
      userMessage: user,
      toolName: "record_blueprint",
      toolDescription: "Record the mesocycle blueprint skeleton.",
      toolJsonSchema: BLUEPRINT_TOOL_SCHEMA,
      schema: BlueprintSchema,
      maxTokens: 1500,
    });

    await logGeneration(supabase, {
      trainer_id: userId,
      plan_id: data.planId,
      stage: "stage2:blueprint",
      model_used: model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      zod_passed: result.ok,
      retry_count: result.retryCount,
      duration_ms: result.durationMs,
      error: result.ok ? null : result.error,
      output_snapshot: result.ok ? result.data : (result as any).zodError ?? null,
    });

    if (!result.ok) {
      return { ok: false as const, error: result.error, zodError: (result as any).zodError };
    }

    const newState = GenerationStateSchema.parse({
      stage: "blueprint",
      approved_stages: ["brief"],
      last_updated_at: new Date().toISOString(),
    });

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update({
        blueprint: result.data as any,
        generation_state: newState as any,
        ...clearDownstream("blueprint"),
      })
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };
    return { ok: true as const, blueprint: result.data };
  });

export const approveBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid(), blueprint: BlueprintSchema }).parse(d)
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
    const approved = new Set(prev.success ? prev.data.approved_stages : ["brief"]);
    approved.add("brief");
    approved.add("blueprint");
    const newState = GenerationStateSchema.parse({
      stage: "microcycle",
      approved_stages: Array.from(approved),
      last_updated_at: new Date().toISOString(),
    });
    const { error } = await supabase
      .from("workout_plans")
      .update({ blueprint: data.blueprint as any, generation_state: newState as any })
      .eq("id", data.planId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });