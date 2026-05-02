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
import { computeCallCostUsd } from "@/server/plan-cost.server";
import {
  classifyTier,
  tierGuidelines,
  tierPromptBlock,
  validateBlueprintShape,
} from "./programming-tier.server";

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
      .select("id, trainer_id, brief, duration_weeks, assessment_id, client_id")
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

    // Load the assessment so we can classify a programming tier. We try the
    // explicit assessment_id first, then fall back to the latest assessment
    // for the client. If we can't find one, we still proceed (tier defaults
    // to "advanced" in classifyTier when nothing flags).
    let assessment: Record<string, any> | null = null;
    const aid = (plan as any).assessment_id as string | null;
    const cid = (plan as any).client_id as string | null;
    if (aid) {
      const { data: a } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", aid)
        .maybeSingle();
      assessment = (a as any) ?? null;
    }
    if (!assessment && cid) {
      const { data: a } = await supabase
        .from("assessments")
        .select("*")
        .eq("client_id", cid)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      assessment = (a as any) ?? null;
    }

    // Trainer override wins over the auto-classifier when present.
    const { data: planMeta } = await supabase
      .from("workout_plans")
      .select("generation_meta")
      .eq("id", data.planId)
      .maybeSingle();
    const overrideTier = (planMeta as any)?.generation_meta?.tier_override as
      | "remedial"
      | "conservative"
      | "advanced"
      | undefined;
    const autoTier = classifyTier(brief, assessment ?? {});
    const tier = overrideTier ?? autoTier;
    const guidelines = tierGuidelines(
      tier,
      brief.sessions_per_week.recommended,
      brief.primary_goal,
    );
    const tierBlock = tierPromptBlock(guidelines);

    const baseSystem = `You are a senior strength coach designing a MESOCYCLE BLUEPRINT.

OUTPUT ONLY THE SKELETON — no exercises, no sets/reps. The blueprint defines:
- session_archetypes: 2–5 distinct session templates (e.g. {id:"lower_squat", focus:"Lower — Squat focus", primary_movements:["back squat","hinge"]}).
- week_to_session_map: keys are week numbers ("1".."${weeks}"), values are arrays of archetype ids, length = sessions_per_week. Same map across weeks unless variation is justified.
- progression_model_proposal: pick "linear" (novice/strength), "undulating" (intermediate/hypertrophy), or "block" (advanced).

RULES:
- sessions_per_week MUST fall within the FREQUENCY range stated in the PROGRAMMING TIER block below (this OVERRIDES brief.sessions_per_week.recommended of ${brief.sessions_per_week.recommended} when they conflict).
- mesocycle_length_weeks MUST equal ${weeks}.
- archetype ids: lowercase snake_case, unique.
- Respect red_flags, equipment_constraints, and the FORBIDDEN EXERCISES list below when naming archetypes/movements.

Call record_blueprint with valid input.

${tierBlock}`;

    const user = `Brief:\n${JSON.stringify(brief, null, 2)}\n\nMesocycle length: ${weeks} weeks.`;

    const model = resolveModel("FORGE_MODEL_STAGE_2", "claude-haiku-4-5-20251001");

    // Up to 2 attempts: first run, then a stricter retry if the shape fails
    // the tier validator.
    let result = await callAnthropicWithSchema({
      model,
      system: baseSystem,
      userMessage: user,
      toolName: "record_blueprint",
      toolDescription: "Record the mesocycle blueprint skeleton.",
      toolJsonSchema: BLUEPRINT_TOOL_SCHEMA,
      schema: BlueprintSchema,
      maxTokens: 1500,
    });

    if (result.ok) {
      const shape = validateBlueprintShape(result.data as any, guidelines);
      if (!shape.ok) {
        const stricter = `${baseSystem}\n\nPREVIOUS ATTEMPT FAILED: ${shape.error}\nYou MUST emit sessions_per_week strictly inside the tier range above.`;
        result = await callAnthropicWithSchema({
          model,
          system: stricter,
          userMessage: user,
          toolName: "record_blueprint",
          toolDescription: "Record the mesocycle blueprint skeleton.",
          toolJsonSchema: BLUEPRINT_TOOL_SCHEMA,
          schema: BlueprintSchema,
          maxTokens: 1500,
        });
      }
    }

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
        // Persist tier so Stage 3 + 4 don't re-classify and so the UI can show it
        generation_meta: {
          tier,
          tier_auto: autoTier,
          tier_override: overrideTier ?? null,
          tier_guidelines: guidelines,
        } as any,
        ...clearDownstream("blueprint"),
      })
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };
    return { ok: true as const, blueprint: result.data, tier };
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

// ---- Conversational discussion of the current blueprint -------------------
// AI may either reply in plain text (advice) or propose a partial patch the
// user can apply locally before approving. No DB writes happen here.

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const PatchProposalSchema = z.object({
  session_archetypes: z.array(
    z.object({
      id: z.string().min(1),
      focus: z.string().min(1),
      primary_movements: z.array(z.string()).default([]),
    }),
  ).optional(),
  week_to_session_map: z.record(z.string(), z.array(z.string())).optional(),
  progression_model_proposal: z
    .object({
      model: z.enum(["linear", "undulating", "block"]),
      rationale: z.string().default(""),
    })
    .optional(),
});

export const discussBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        messages: z.array(ChatMessageSchema).min(1).max(10),
        currentBlueprint: BlueprintSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("trainer_id, brief")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }
    const briefParsed = BriefSchema.safeParse((plan as any).brief);
    if (!briefParsed.success) {
      return { ok: false as const, error: "Brief is missing or invalid." };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI key not configured." };

    const model = resolveModel("FORGE_MODEL_STAGE_2", "claude-haiku-4-5-20251001");

    const system = `You are a senior strength coach reviewing a MESOCYCLE BLUEPRINT with a trainer.
You can either:
 (a) reply in plain text with advice/explanation, OR
 (b) call the tool "propose_blueprint_patch" with a Partial<Blueprint> the trainer can apply.

Rules for patches:
- session_archetypes: if provided, REPLACES the whole list. Keep ids unique snake_case.
- week_to_session_map: keys "1".."N", each value length must equal sessions_per_week (${data.currentBlueprint.sessions_per_week}). All ids must exist in session_archetypes (current or new).
- progression_model_proposal: optional override.
- Respect brief.red_flags and equipment_constraints.
- Only propose a patch when the trainer asks for a change. For questions, reply in text.`;

    const userContent = `BRIEF:\n${JSON.stringify(briefParsed.data, null, 2)}\n\nCURRENT BLUEPRINT:\n${JSON.stringify(data.currentBlueprint, null, 2)}\n\nCONVERSATION:\n${data.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}`;

    const tool = {
      name: "propose_blueprint_patch",
      description: "Propose a partial blueprint patch the trainer can apply.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          session_archetypes: {
            type: "array",
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
      },
    };

    const t0 = Date.now();
    let resp: Response;
    try {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          system,
          tools: [tool],
          messages: [{ role: "user", content: userContent }],
        }),
      });
    } catch (e) {
      return {
        ok: false as const,
        error: `Network error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    const durationMs = Date.now() - t0;

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { ok: false as const, error: `Anthropic ${resp.status}: ${body.slice(0, 300)}` };
    }
    const json: any = await resp.json();
    const inputTokens = Number(json?.usage?.input_tokens ?? 0);
    const outputTokens = Number(json?.usage?.output_tokens ?? 0);
    const costUsd = computeCallCostUsd(model, {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });

    const blocks: any[] = json?.content ?? [];
    const textBlock = blocks.find((b) => b?.type === "text");
    const toolBlock = blocks.find((b) => b?.type === "tool_use" && b?.name === "propose_blueprint_patch");
    let patch: z.infer<typeof PatchProposalSchema> | null = null;
    if (toolBlock) {
      const parsed = PatchProposalSchema.safeParse(toolBlock.input);
      if (parsed.success) patch = parsed.data;
    }

    await logGeneration(supabase, {
      trainer_id: userId,
      plan_id: data.planId,
      stage: "stage2:blueprint:chat",
      model_used: model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      zod_passed: true,
      retry_count: 0,
      duration_ms: durationMs,
      output_snapshot: { reply: textBlock?.text ?? "", patch },
    });

    return {
      ok: true as const,
      reply: (textBlock?.text as string | undefined) ?? "",
      patch,
      costUsd,
    };
  });