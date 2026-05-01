import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SectionAnalysisSchema } from "./schemas";
import { PHASED_SECTIONS, SECTION_BRIEF_CONTRIBUTIONS, pickSectionPayload, type PhasedSectionId } from "./section-map";
import { callAnthropicWithSchema, logGeneration, resolveModel } from "./ai.server";

const InputSchema = z.object({
  assessmentId: z.string().uuid(),
  section: z.enum(PHASED_SECTIONS as unknown as [PhasedSectionId, ...PhasedSectionId[]]),
  // When true, force re-analysis even if cached.
  force: z.boolean().optional(),
});

const SECTION_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    red_flags: { type: "array", items: { type: "string" } },
    contraindication_notes: { type: "string" },
    primary_goal: {
      type: "string",
      enum: ["hypertrophy", "strength", "conditioning", "mixed", "fat_loss", "general"],
    },
    secondary_goals: { type: "array", items: { type: "string" } },
    training_age_band: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    sessions_per_week: {
      type: "object",
      additionalProperties: false,
      properties: {
        recommended: { type: "integer", minimum: 1, maximum: 7 },
        min: { type: "integer", minimum: 1, maximum: 7 },
        max: { type: "integer", minimum: 1, maximum: 7 },
      },
      required: ["recommended", "min", "max"],
    },
    equipment_constraints: { type: "array", items: { type: "string" } },
    movement_competency_summary: {
      type: "object",
      additionalProperties: false,
      properties: {
        squat: { type: "string" },
        hinge: { type: "string" },
        push: { type: "string" },
        pull: { type: "string" },
        carry: { type: "string" },
        lunge: { type: "string" },
      },
    },
    recovery_profile: { type: "string" },
    notes_for_next_stage: { type: "string" },
  },
};

/**
 * Pre-Stage 0: analyze a single assessment section and cache the result on
 * assessments.section_analyses[section]. Idempotent: skipped if the section's
 * source data hasn't changed since last analysis (unless `force` is true).
 *
 * Gated on profiles.phased_generation_enabled.
 * Always returns a result object — never throws — so the caller can fire-and-forget.
 */
export const analyzeAssessmentSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Feature flag check.
    const { data: profile } = await supabase
      .from("profiles")
      .select("phased_generation_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (!(profile as any)?.phased_generation_enabled) {
      return { ok: false as const, skipped: "flag_disabled" };
    }

    // Load assessment row.
    const { data: assessment, error } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", data.assessmentId)
      .maybeSingle();
    if (error || !assessment) {
      return { ok: false as const, error: error?.message ?? "assessment not found" };
    }
    if ((assessment as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    const sectionPayload = pickSectionPayload(data.section, assessment as Record<string, unknown>);
    const payloadHash = JSON.stringify(sectionPayload);

    const cachedAt = ((assessment as any).sections_analysed_at ?? {}) as Record<string, string>;
    const cachedAnalyses = ((assessment as any).section_analyses ?? {}) as Record<string, unknown>;
    const lastHash = (cachedAt[`${data.section}__hash`] ?? "") as string;
    if (!data.force && lastHash === payloadHash && cachedAnalyses[data.section]) {
      return { ok: true as const, cached: true, section: data.section };
    }

    const allowedFields = SECTION_BRIEF_CONTRIBUTIONS[data.section];
    const system = `You are a strength-coaching assistant doing a focused micro-analysis of ONE section of a client assessment.

Section: ${data.section}
Allowed output fields (omit any you cannot ground in the data): ${allowedFields.join(", ")}.

RULES:
- Be terse. Each string field ≤ 200 chars.
- NEVER invent data not present in the input. If a field cannot be answered, omit it.
- For red_flags, only include items grounded in the input (e.g. "PAR-Q+ Q1: heart condition").
- For movement_competency_summary, only fill the patterns this section actually informs.
- Output ONLY by calling the record_section_analysis tool.`;

    const userMessage = `Section data (JSON):\n${JSON.stringify(sectionPayload, null, 2)}`;

    const model = resolveModel("FORGE_MODEL_PRE_STAGE", "claude-haiku-4-5-20251001");
    const result = await callAnthropicWithSchema({
      model,
      system,
      userMessage,
      toolName: "record_section_analysis",
      toolDescription: `Record the partial brief contribution for the ${data.section} section.`,
      toolJsonSchema: SECTION_TOOL_SCHEMA,
      schema: SectionAnalysisSchema,
      maxTokens: 800,
    });

    await logGeneration(supabase, {
      trainer_id: userId,
      assessment_id: data.assessmentId,
      plan_id: null,
      stage: `pre0:${data.section}`,
      model_used: model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      zod_passed: result.ok,
      retry_count: result.retryCount,
      duration_ms: result.durationMs,
      error: result.ok ? null : result.error,
      input_snapshot: { section: data.section, payload: sectionPayload },
      output_snapshot: result.ok ? result.data : (result as any).zodError ?? null,
    });

    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    // Merge into JSONB columns.
    const newAnalyses = { ...cachedAnalyses, [data.section]: result.data };
    const newAt = {
      ...cachedAt,
      [data.section]: new Date().toISOString(),
      [`${data.section}__hash`]: payloadHash,
    };
    const { error: updErr } = await supabase
      .from("assessments")
      .update({
        section_analyses: newAnalyses as any,
        sections_analysed_at: newAt as any,
      })
      .eq("id", data.assessmentId);
    if (updErr) {
      return { ok: false as const, error: updErr.message };
    }

    return { ok: true as const, cached: false, section: data.section, analysis: result.data };
  });

/**
 * Read coverage of pre-stage analyses for an assessment — used by the
 * "Brief preview" panel in the assessment UI.
 */
export const getSectionAnalysisCoverage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assessmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("assessments")
      .select("trainer_id, section_analyses, sections_analysed_at")
      .eq("id", data.assessmentId)
      .maybeSingle();
    if (!row || (row as any).trainer_id !== userId) {
      return { ok: false as const, error: "not found" };
    }
    const analyses = ((row as any).section_analyses ?? {}) as Record<string, unknown>;
    const at = ((row as any).sections_analysed_at ?? {}) as Record<string, string>;
    const sections = PHASED_SECTIONS.map((s) => ({
      id: s,
      analysed: !!analyses[s],
      analysed_at: at[s] ?? null,
    }));
    return {
      ok: true as const,
      total: PHASED_SECTIONS.length,
      done: sections.filter((s) => s.analysed).length,
      sections,
      analyses: analyses as Record<string, any>,
    };
  });