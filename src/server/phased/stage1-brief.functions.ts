import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BriefSchema,
  GenerationStateSchema,
  DOWNSTREAM_OF,
  ProgrammingVariablesSchema,
  RedFlagAccommodationsSchema,
  type GenerationStage,
} from "./schemas";
import { callAnthropicWithSchema, logGeneration, resolveModel } from "./ai.server";
import { checkPlanQuota } from "@/server/quota.server";
import { PATTERN_IDS, buildPatternSentence, type PatternId } from "@/lib/movement-criteria";

const BRIEF_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "primary_goal",
    "secondary_goals",
    "red_flags",
    "movement_competency_summary",
    "training_age_band",
    "sessions_per_week",
    "mesocycle_length_weeks",
    "emphasis_split",
    "equipment_constraints",
    "notes_for_next_stage",
  ],
  properties: {
    primary_goal: {
      type: "string",
      enum: ["hypertrophy", "strength", "conditioning", "mixed", "fat_loss", "general"],
    },
    secondary_goals: { type: "array", items: { type: "string" } },
    red_flags: { type: "array", items: { type: "string" } },
    movement_competency_summary: {
      type: "object",
      additionalProperties: false,
      required: ["squat", "hinge", "push", "pull", "carry", "lunge"],
      properties: {
        squat: { type: "string" },
        hinge: { type: "string" },
        push: { type: "string" },
        pull: { type: "string" },
        carry: { type: "string" },
        lunge: { type: "string" },
      },
    },
    training_age_band: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    sessions_per_week: {
      type: "object",
      additionalProperties: false,
      required: ["recommended", "min", "max"],
      properties: {
        recommended: { type: "integer", minimum: 1, maximum: 7 },
        min: { type: "integer", minimum: 1, maximum: 7 },
        max: { type: "integer", minimum: 1, maximum: 7 },
      },
    },
    mesocycle_length_weeks: { type: "integer", minimum: 2, maximum: 12 },
    emphasis_split: {
      type: "object",
      additionalProperties: false,
      required: ["upper", "lower", "conditioning"],
      properties: {
        upper: { type: "number", minimum: 0, maximum: 1 },
        lower: { type: "number", minimum: 0, maximum: 1 },
        conditioning: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    equipment_constraints: { type: "array", items: { type: "string" } },
    notes_for_next_stage: { type: "string" },
    current_capacity_vs_pb: { type: ["integer", "null"], minimum: 1, maximum: 10 },
  },
};

function clearDownstream(stage: GenerationStage) {
  const downstream = DOWNSTREAM_OF[stage];
  const out: Record<string, null> = {};
  if (downstream.includes("blueprint")) out.blueprint = null;
  if (downstream.includes("progressions")) out.progression_plan = null;
  return out;
}

/**
 * The Stage-1 Haiku call sometimes emits literal "<UNKNOWN>" placeholders
 * for the per-pattern movement summary when its inputs are sparse (e.g.
 * Pre-Stage 0 hasn't run for the assessment yet). Replace any empty /
 * placeholder string with a deterministic sentence built from the raw
 * `*_form_criteria` + `*_capacity` columns so trainers always see real
 * Portuguese text in the brief rail.
 */
const PLACEHOLDER_RE = /^\s*(<?\s*unknown\s*>?|—|-|n\/?a|null|undefined)\s*$/i;

export function sanitizeMovementCompetencySummary(
  brief: any,
  assessmentRow: Record<string, any> | null | undefined,
): any {
  if (!brief || typeof brief !== "object") return brief;
  const summary = { ...(brief.movement_competency_summary ?? {}) };
  const notAssessed = (assessmentRow?.screen_not_assessed ?? {}) as Record<string, boolean>;
  for (const p of PATTERN_IDS) {
    const cur = summary[p];
    const isPlaceholder = !cur || (typeof cur === "string" && PLACEHOLDER_RE.test(cur));
    if (!isPlaceholder) continue;
    if (assessmentRow) {
      summary[p] = buildPatternSentence(
        p,
        assessmentRow[`${p}_form_criteria`],
        assessmentRow[`${p}_capacity`],
        Boolean(notAssessed[p]),
      );
    } else {
      summary[p] = `${p} sem dados registados.`;
    }
  }
  return { ...brief, movement_competency_summary: summary };
}

/**
 * Loads the relevant assessment columns needed for the movement-summary
 * fallback. Single round-trip; safe to call from any stage-1 path.
 */
async function loadAssessmentForFallback(
  supabase: any,
  assessmentId: string | null | undefined,
): Promise<Record<string, any> | null> {
  if (!assessmentId) return null;
  const { data } = await supabase
    .from("assessments")
    .select(
      "squat_form_criteria, hinge_form_criteria, push_form_criteria, pull_form_criteria, carry_form_criteria, lunge_form_criteria, squat_capacity, hinge_capacity, push_capacity, pull_capacity, carry_capacity, lunge_capacity, screen_not_assessed",
    )
    .eq("id", assessmentId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Stage 1: synthesize the training brief from the cached section_analyses
 * map + any coach notes already on the plan. Never reads raw assessment data.
 */
export const synthesizeBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan, error } = await supabase
      .from("workout_plans")
      .select("id, trainer_id, client_id, assessment_id, brief, generation_state, duration_weeks")
      .eq("id", data.planId)
      .maybeSingle();
    if (error || !plan) return { ok: false as const, error: error?.message ?? "plan not found" };
    if ((plan as any).trainer_id !== userId) return { ok: false as const, error: "forbidden" };

    let sectionAnalyses: Record<string, unknown> = {};
    if ((plan as any).assessment_id) {
      const { data: assessment } = await supabase
        .from("assessments")
        .select("section_analyses")
        .eq("id", (plan as any).assessment_id)
        .maybeSingle();
      sectionAnalyses = ((assessment as any)?.section_analyses ?? {}) as Record<string, unknown>;
    }

    const system = `You are a senior strength coach. Synthesize a TRAINING BRIEF from the per-section analyses below.

Your job is SYNTHESIS and CONFLICT RESOLUTION — not extraction. The hard work has already been done per section. You must:
- Merge red_flags from all sections (dedupe).
- Pick a single primary_goal grounded in the goal section.
- Reconcile training_age_band across sections (history > anthro > performance).
- Use the training section's sessions_per_week and equipment_constraints verbatim unless they conflict with red flags.
- Build movement_competency_summary by merging mobility, posture, and screen sections (later sections override earlier with concrete scores).
- Produce notes_for_next_stage as a SHORT (≤ 400 char) free-text summary the next stage will use.
- emphasis_split must sum to 1.0 (±0.05).
- mesocycle_length_weeks should default to ${(plan as any).duration_weeks ?? 4}.
- All free-text fields (notes_for_next_stage, equipment_constraints labels, movement_competency_summary entries) must be written in European Portuguese (pt-PT), formal address (você / o seu / a sua). Never use tu/teu/tua. Use European Portuguese spelling — não use formas brasileiras.
- Read current_capacity_vs_pb from the goal/training section's notes_for_next_stage when present (1–10 self-rated "where I am vs my best ever"). Echo it back in the brief's current_capacity_vs_pb field. Then use it to calibrate notes_for_next_stage:
  • If current_capacity_vs_pb ≤ 4, the client is in REBUILD mode: prioritize accumulation phase, sub-maximal loads (RPE ≤ 7.5), pattern reinforcement over intensification. Do NOT prescribe heavy compound work in week 1; phase it in by week 3+.
  • If 5–7, MODERATE progression — start at ~70% of suspected capacity, build to 85%.
  • If 8–10, NORMAL progression cadence applies.
  If current_capacity_vs_pb is missing/unknown, set the brief field to null and proceed with normal cadence.

Output ONLY by calling the record_brief tool.`;

    const userMessage = `Per-section analyses (JSON map):\n${JSON.stringify(sectionAnalyses, null, 2)}\n\nDefault mesocycle length (weeks): ${(plan as any).duration_weeks ?? 4}`;

    const model = resolveModel("FORGE_MODEL_STAGE_1", "claude-haiku-4-5-20251001");
    const result = await callAnthropicWithSchema({
      model,
      system,
      userMessage,
      toolName: "record_brief",
      toolDescription: "Record the consolidated training brief.",
      toolJsonSchema: BRIEF_TOOL_SCHEMA,
      schema: BriefSchema,
      maxTokens: 1500,
    });

    await logGeneration(supabase, {
      trainer_id: userId,
      plan_id: data.planId,
      assessment_id: (plan as any).assessment_id ?? null,
      stage: "stage1:brief",
      model_used: model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      zod_passed: result.ok,
      retry_count: result.retryCount,
      duration_ms: result.durationMs,
      error: result.ok ? null : result.error,
      input_snapshot: { section_analyses_keys: Object.keys(sectionAnalyses) },
      output_snapshot: result.ok ? result.data : (result as any).zodError ?? null,
    });

    if (!result.ok) {
      return { ok: false as const, error: result.error, zodError: (result as any).zodError };
    }

    const newState = GenerationStateSchema.parse({
      stage: "brief",
      approved_stages: [],
      last_updated_at: new Date().toISOString(),
    });

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update({
        brief: result.data as any,
        generation_state: newState as any,
        ...clearDownstream("brief"),
      })
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };

    return { ok: true as const, brief: result.data };
  });

/**
 * Approve (and optionally edit) the brief. Marks Stage 1 complete and
 * advances generation_state.stage to "blueprint".
 */
export const approveBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        brief: BriefSchema,
        programmingVariables: ProgrammingVariablesSchema.optional(),
        redFlagAccommodations: RedFlagAccommodationsSchema.optional(),
      })
      .parse(d)
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

    const prevState = GenerationStateSchema.safeParse((plan as any).generation_state ?? {});
    const approved = new Set(prevState.success ? prevState.data.approved_stages : []);
    approved.add("brief");

    const newState = GenerationStateSchema.parse({
      stage: "blueprint",
      approved_stages: Array.from(approved),
      last_updated_at: new Date().toISOString(),
    });

    const update: Record<string, unknown> = {
      brief: data.brief as any,
      generation_state: newState as any,
    };
    if (data.programmingVariables) {
      update.programming_variables = data.programmingVariables as any;
    }
    if (data.redFlagAccommodations) {
      update.red_flag_accommodations = data.redFlagAccommodations as any;
    }

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update(update as any)
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };
    return { ok: true as const };
  });

/**
 * Create a new plan row in "brief" stage and return its id. Used by
 * /plans/new to start the phased flow from the client detail page.
 */
export const createPhasedPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), title: z.string().optional() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify client belongs to trainer + grab latest assessment.
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, trainer_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!client || (client as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    // Bug 2a: if there's already an in-progress phased plan for this client,
    // reuse it instead of creating a new ghost row.
    const { data: existing } = await supabase
      .from("workout_plans")
      .select("id, generation_status, brief")
      .eq("trainer_id", userId)
      .eq("client_id", data.clientId)
      .neq("generation_status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && (existing as any).id) {
      return { ok: true as const, planId: (existing as any).id, reused: true as const };
    }

    // Quota gate: only enforced when we'd actually insert a NEW plan row.
    const quota = await checkPlanQuota(supabase as any, userId);
    if (!quota.ok) {
      return { ok: false as const, error: "quota_exceeded", used: quota.used, limit: quota.limit };
    }

    const { data: assessment } = await supabase
      .from("assessments")
      .select("id, updated_at")
      .eq("client_id", data.clientId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const initialState = GenerationStateSchema.parse({
      stage: "brief",
      approved_stages: [],
      last_updated_at: new Date().toISOString(),
    });

    const { data: inserted, error: insErr } = await supabase
      .from("workout_plans")
      .insert({
        trainer_id: userId,
        client_id: data.clientId,
        assessment_id: (assessment as any)?.id ?? null,
        title: data.title ?? `${(client as any).full_name} — Plano de treino`,
        status: "draft",
        generation_status: "pending",
        generation_state: initialState as any,
        plan_data: { weeks: [] } as any,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return { ok: false as const, error: insErr?.message ?? "insert failed" };
    }

    return { ok: true as const, planId: (inserted as any).id, reused: false as const };
  });

/**
 * One-shot: find-or-create a phased plan for the client AND synthesize the
 * brief. If brief synthesis fails on a freshly-created plan, delete the
 * orphan row so we never accumulate empty drafts (Bug 2b).
 *
 * Returns { planId, reused, briefReady } so the client can show a toast
 * with a "Review" link without auto-navigating.
 */
export const startPhasedPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clientId: z.string().uuid(), title: z.string().optional() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership.
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, trainer_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (!client || (client as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    // Bug 2a: reuse any in-progress phased plan for this client.
    const { data: existing } = await supabase
      .from("workout_plans")
      .select("id, brief, generation_status")
      .eq("trainer_id", userId)
      .eq("client_id", data.clientId)
      .neq("generation_status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let planId: string;
    let createdNow = false;
    if (existing && (existing as any).id) {
      planId = (existing as any).id;
      // If the existing plan already has a brief, we're done — no need to re-synth.
      if ((existing as any).brief) {
        return {
          ok: true as const,
          planId,
          reused: true as const,
          briefReady: true as const,
        };
      }
    } else {
      // Quota gate: only enforced when we'd actually insert a NEW plan row.
      const quota = await checkPlanQuota(supabase as any, userId);
      if (!quota.ok) {
        return { ok: false as const, error: "quota_exceeded", used: quota.used, limit: quota.limit };
      }

      const { data: assessment } = await supabase
        .from("assessments")
        .select("id, updated_at")
        .eq("client_id", data.clientId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const initialState = GenerationStateSchema.parse({
        stage: "brief",
        approved_stages: [],
        last_updated_at: new Date().toISOString(),
      });

      const { data: inserted, error: insErr } = await supabase
        .from("workout_plans")
        .insert({
          trainer_id: userId,
          client_id: data.clientId,
          assessment_id: (assessment as any)?.id ?? null,
          title: data.title ?? `${(client as any).full_name} — Plano de treino`,
          status: "draft",
          generation_status: "pending",
          generation_state: initialState as any,
          plan_data: { weeks: [] } as any,
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        return { ok: false as const, error: insErr?.message ?? "insert failed" };
      }
      planId = (inserted as any).id;
      createdNow = true;
    }

    // Run synthesis inline. We need to load the (possibly just-created) plan row
    // to pass to the same synthesis logic.
    const { data: plan } = await supabase
      .from("workout_plans")
      .select("id, trainer_id, assessment_id, duration_weeks")
      .eq("id", planId)
      .maybeSingle();
    if (!plan) {
      // Shouldn't happen, but clean up if it does.
      if (createdNow) await supabase.from("workout_plans").delete().eq("id", planId);
      return { ok: false as const, error: "plan vanished after insert" };
    }

    let sectionAnalyses: Record<string, unknown> = {};
    if ((plan as any).assessment_id) {
      const { data: assessment } = await supabase
        .from("assessments")
        .select("section_analyses")
        .eq("id", (plan as any).assessment_id)
        .maybeSingle();
      sectionAnalyses = ((assessment as any)?.section_analyses ?? {}) as Record<string, unknown>;
    }

    const system = `You are a senior strength coach. Synthesize a TRAINING BRIEF from the per-section analyses below.

Your job is SYNTHESIS and CONFLICT RESOLUTION — not extraction. The hard work has already been done per section. You must:
- Merge red_flags from all sections (dedupe).
- Pick a single primary_goal grounded in the goal section.
- Reconcile training_age_band across sections (history > anthro > performance).
- Use the training section's sessions_per_week and equipment_constraints verbatim unless they conflict with red flags.
- Build movement_competency_summary by merging mobility, posture, and screen sections (later sections override earlier with concrete scores).
- Produce notes_for_next_stage as a SHORT (≤ 400 char) free-text summary the next stage will use.
- emphasis_split must sum to 1.0 (±0.05).
- mesocycle_length_weeks should default to ${(plan as any).duration_weeks ?? 4}.
- All free-text fields (notes_for_next_stage, equipment_constraints labels, movement_competency_summary entries) must be written in European Portuguese (pt-PT), formal address (você / o seu / a sua). Never use tu/teu/tua. Use European Portuguese spelling — não use formas brasileiras.
- Read current_capacity_vs_pb from the goal/training section's notes_for_next_stage when present (1–10 self-rated "where I am vs my best ever"). Echo it back in the brief's current_capacity_vs_pb field. Then use it to calibrate notes_for_next_stage:
  • If current_capacity_vs_pb ≤ 4, the client is in REBUILD mode: prioritize accumulation phase, sub-maximal loads (RPE ≤ 7.5), pattern reinforcement over intensification. Do NOT prescribe heavy compound work in week 1; phase it in by week 3+.
  • If 5–7, MODERATE progression — start at ~70% of suspected capacity, build to 85%.
  • If 8–10, NORMAL progression cadence applies.
  If current_capacity_vs_pb is missing/unknown, set the brief field to null and proceed with normal cadence.

Output ONLY by calling the record_brief tool.`;

    const userMessage = `Per-section analyses (JSON map):\n${JSON.stringify(sectionAnalyses, null, 2)}\n\nDefault mesocycle length (weeks): ${(plan as any).duration_weeks ?? 4}`;

    const model = resolveModel("FORGE_MODEL_STAGE_1", "claude-haiku-4-5-20251001");
    const result = await callAnthropicWithSchema({
      model,
      system,
      userMessage,
      toolName: "record_brief",
      toolDescription: "Record the consolidated training brief.",
      toolJsonSchema: BRIEF_TOOL_SCHEMA,
      schema: BriefSchema,
      maxTokens: 1500,
    });

    await logGeneration(supabase, {
      trainer_id: userId,
      plan_id: planId,
      assessment_id: (plan as any).assessment_id ?? null,
      stage: "stage1:brief",
      model_used: model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      zod_passed: result.ok,
      retry_count: result.retryCount,
      duration_ms: result.durationMs,
      error: result.ok ? null : result.error,
      input_snapshot: { section_analyses_keys: Object.keys(sectionAnalyses) },
      output_snapshot: result.ok ? result.data : (result as any).zodError ?? null,
    });

    if (!result.ok) {
      // Bug 2b: never leave an empty draft behind.
      if (createdNow) {
        await supabase.from("workout_plans").delete().eq("id", planId);
      }
      return {
        ok: false as const,
        error: result.error,
        zodError: (result as any).zodError,
      };
    }

    const newState = GenerationStateSchema.parse({
      stage: "brief",
      approved_stages: [],
      last_updated_at: new Date().toISOString(),
    });

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update({
        brief: result.data as any,
        generation_state: newState as any,
        blueprint: null,
        progression_plan: null,
      })
      .eq("id", planId);
    if (updErr) {
      if (createdNow) {
        await supabase.from("workout_plans").delete().eq("id", planId);
      }
      return { ok: false as const, error: updErr.message };
    }

    return {
      ok: true as const,
      planId,
      reused: !createdNow,
      briefReady: true as const,
    };
  });