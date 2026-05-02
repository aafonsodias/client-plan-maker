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
    // Tier-derived RPE ceiling — falls back to 8 if not present on the blueprint.
    const tierRaw = String(
      (plan as any).blueprint?.programming_tier ??
        (plan as any).generation_meta?.tier_override ??
        "conservative"
    ).toLowerCase();
    const appetite = String(
      (plan as any).brief?.intensity_appetite ?? "padrao",
    ).toLowerCase();
    const tierCeiling =
      tierRaw === "remedial" ? 7 : tierRaw === "advanced" ? 9 : 8;
    const appetiteShift =
      appetite === "conservador" ? -0.5 : appetite === "agressivo" ? +0.5 : 0;
    const rpeCeiling = Math.min(9.5, Math.max(6, tierCeiling + appetiteShift));
    const ramp =
      appetite === "conservador"
        ? `RPE W1→W2→W3 = 5 → 6 → 6.5; W${weeks} deload (RPE 4).`
        : appetite === "agressivo"
        ? `RPE W1→W2→W3 = 7 → 8 → 8.5; W${weeks} deload (RPE 6).`
        : `RPE W1→W2→W3 = 6 → 7 → 7.5; W${weeks} deload (RPE 5).`;
    const loadStep =
      appetite === "conservador"
        ? "+2.5kg every other week on free-weight compounds; +1 rep/wk on accessories."
        : appetite === "agressivo"
        ? "+5kg/wk on free-weight compounds (or +5%); +2 reps/wk on accessories."
        : "+2.5kg/wk on free-weight compounds (or +2.5–5%); +1–2 reps/wk on accessories.";

    const system = `You are a senior strength coach writing PROGRESSION DELTAS for weeks 2..${weeks} of a ${tierRaw.toUpperCase()} tier mesocycle.
Coach intensity appetite: ${appetite.toUpperCase()}.
Target RPE wave: ${ramp}
Target load step: ${loadStep}

Delta DSL (use empty string "" only for the deload week or when truly nothing should change):
- load: "+2.5kg" / "+5lb" / "-5%"
- reps: "+1rep" / "+2reps" / "-1rep"
- sets: "+1set"
- intensity_rpe: "+0.5rpe"
- tempo: explicit "3-1-1-0"
- complexity_variant: text describing variant swap

HARD RULES — apply to EVERY exercise:
1. Each exercise MUST have at least ONE non-empty delta across W2/W3/W4. No exceptions, including accessory work.
2. Bias by exercise type:
   - Machine / cable / bodyweight: prefer reps (+1-2/wk) and intensity_rpe waves. Load deltas optional (auto-regulated).
   - Free-weight compounds (DB press, goblet squat, RDL, trap-bar DL, row): prefer load (+2.5kg/wk small, +5kg/wk strong lifters), keep reps stable.
   - Isolation / arms / calves: prefer reps and sets. Load is secondary.
3. RPE ceiling for this tier+appetite: ${rpeCeiling}. Never propose intensity_rpe that would push an exercise above this number. Only main compounds may touch the ceiling. Match the RPE wave above — do NOT leave RPE flat across all 4 weeks.
4. Progression model: ${progModel}.
   - linear: each week +1 small step (reps OR load OR rpe). Steady climb.
   - undulating: alternate reps-up weeks with intensity-up weeks. W2 may differ from W3.
   - block: W2 accumulation (+reps), W3 intensification (+load / +rpe).
5. Week ${weeks} is a DELOAD: use "-1set" OR "-20%" load OR drop intensity_rpe by 1.0–1.5. Never empty across the board. The deload week MUST clearly read lower than W3.
6. Keep "rationale" ≤ 10 words.

Call record_progressions exactly once with one or more rows per exercise. Aim for 1-2 rows per exercise; return more only when both load AND reps need to move together.`;

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

    // Post-validation: ensure most exercises have at least one non-empty delta.
    // If ≥30% of exercises are flat across W2-W4, retry once with a stricter message.
    const evaluateCoverage = (rows: any[]) => {
      const covered = new Set<string>();
      for (const r of rows) {
        const hasAny =
          (r.week_2_delta && String(r.week_2_delta).trim() !== "") ||
          (r.week_3_delta && String(r.week_3_delta).trim() !== "") ||
          (r.week_4_delta && String(r.week_4_delta).trim() !== "");
        if (hasAny && r.exercise_id) covered.add(String(r.exercise_id));
      }
      const total = exerciseList.length || 1;
      const flat = exerciseList.filter((e) => !covered.has(e.id));
      return { coveredCount: covered.size, total, flatRatio: flat.length / total, flat };
    };

    let progressionData: any = result.data;
    let coverage = evaluateCoverage((progressionData as any).rows ?? []);
    if (coverage.flatRatio >= 0.3 && coverage.flat.length > 0) {
      const retrySystem = `${system}\n\nYour previous attempt left ${coverage.flat.length} exercises with ZERO non-empty deltas across W2-W${weeks}. That violates Hard Rule 1. Re-issue ALL exercises (not just the flat ones) with at least one non-empty delta each. Specifically these exercise_ids were flat: ${coverage.flat.map((e) => e.id).join(", ")}.`;
      const retry = await callAnthropicWithSchema({
        model,
        system: retrySystem,
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
        stage: "stage4:progressions:retry",
        model_used: model,
        input_tokens: retry.inputTokens,
        output_tokens: retry.outputTokens,
        cost_usd: retry.costUsd,
        zod_passed: retry.ok,
        retry_count: retry.retryCount,
        duration_ms: retry.durationMs,
        error: retry.ok ? null : retry.error,
        input_snapshot: { reason: "flat_coverage", flatCount: coverage.flat.length, flatRatio: coverage.flatRatio },
        output_snapshot: retry.ok ? { rowCount: (retry.data as any)?.rows?.length ?? 0 } : null,
      });
      if (retry.ok && retry.data) {
        const retryCoverage = evaluateCoverage((retry.data as any).rows ?? []);
        // Keep retry if it improved coverage; otherwise keep original.
        if (retryCoverage.flatRatio < coverage.flatRatio) {
          progressionData = retry.data;
          coverage = retryCoverage;
        }
      }
    }

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update({ progression_plan: progressionData as any })
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };
    return { ok: true as const, progressionPlan: progressionData, exerciseList };
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