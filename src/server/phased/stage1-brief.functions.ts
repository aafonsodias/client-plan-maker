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
import { checkPlanQuota, reservePlanQuota, acquireGenerationLock } from "@/server/quota.server";
import { PATTERN_IDS, buildPatternSentence, type PatternId } from "@/lib/movement-criteria";
import type { TrainingModality } from "./schemas";
import { resolveRules } from "@/server/knowledge/resolve.server";
import { logAuditEvent } from "@/server/audit/log-event.server";

// R2 — Capacity context shape passed to the Stage-1 LLM prompt. Built from
// the latest snapshot per capacity domain at synth time. Names resolve in
// English to keep the prompt deterministic — the brief output is translated
// downstream by the trainer-facing UI.
type CapacityContextEntry = {
  slug: string;
  name: string;
  tier: "health_related" | "skill_related" | "integrative";
  score: number;
  test: string | null;
  measuredAt: string;
  rawValue: number | null;
  rawUnit: string | null;
  notes: string | null;
};
type CapacityContext = {
  measured: CapacityContextEntry[];
  unmeasured: Array<{
    slug: string;
    name: string;
    tier: CapacityContextEntry["tier"];
  }>;
  totalDomains: number;
  measuredCount: number;
};

// English fallbacks so the prompt never sees a literal i18n key.
const CAPACITY_NAME_EN: Record<string, string> = {
  cardiorespiratory: "Cardiorespiratory endurance",
  muscular_strength: "Muscular strength",
  muscular_endurance: "Muscular endurance",
  flexibility: "Flexibility",
  body_composition: "Body composition",
  power: "Power",
  speed: "Speed",
  agility: "Agility",
  balance: "Balance",
  coordination: "Coordination",
  reaction_time: "Reaction time",
  movement_quality: "Movement quality",
  cognitive_motor: "Cognitive-motor integration",
};

function bandLabel(score: number): string {
  if (score < 25) return "gap";
  if (score < 40) return "below average";
  if (score < 60) return "average";
  if (score < 75) return "above average";
  return "strong";
}

async function loadCapacityContext(
  supabase: any,
  clientId: string,
): Promise<CapacityContext> {
  const { data: domains } = await supabase
    .from("capacity_domains")
    .select("slug, tier, display_order")
    .order("display_order", { ascending: true });
  const list = (domains ?? []) as Array<{
    slug: string;
    tier: CapacityContextEntry["tier"];
    display_order: number;
  }>;
  if (list.length === 0) {
    return { measured: [], unmeasured: [], totalDomains: 0, measuredCount: 0 };
  }
  const { data: snaps } = await supabase
    .from("client_capacity_snapshots")
    .select(
      "domain_slug, measured_at, raw_value, raw_unit, normalized_score, test_used, notes",
    )
    .eq("client_id", clientId)
    .order("measured_at", { ascending: false });
  const latest = new Map<string, any>();
  for (const s of snaps ?? []) {
    if (!latest.has(s.domain_slug)) latest.set(s.domain_slug, s);
  }
  const measured: CapacityContextEntry[] = [];
  const unmeasured: CapacityContext["unmeasured"] = [];
  for (const d of list) {
    const name = CAPACITY_NAME_EN[d.slug] ?? d.slug;
    const s = latest.get(d.slug);
    if (s && s.normalized_score != null) {
      measured.push({
        slug: d.slug,
        name,
        tier: d.tier,
        score: Math.round(Number(s.normalized_score)),
        test: s.test_used ?? null,
        measuredAt: String(s.measured_at).slice(0, 10),
        rawValue: s.raw_value != null ? Number(s.raw_value) : null,
        rawUnit: s.raw_unit ?? null,
        notes: s.notes ?? null,
      });
    } else {
      unmeasured.push({ slug: d.slug, name, tier: d.tier });
    }
  }
  measured.sort((a, b) => a.score - b.score); // gaps first
  return {
    measured,
    unmeasured,
    totalDomains: list.length,
    measuredCount: measured.length,
  };
}

function renderCapacityForPrompt(ctx: CapacityContext): string {
  const head = `MEASURED CAPACITIES (0-100 normalized vs population norms, ordered gaps→strengths):`;
  const measured =
    ctx.measured.length === 0
      ? "  (none measured yet)"
      : ctx.measured
          .map(
            (m) =>
              `  - ${m.name}: ${m.score} (${m.test ?? "n/a"}, ${m.measuredAt}) — ${bandLabel(m.score)}`,
          )
          .join("\n");
  const unmeasured =
    ctx.unmeasured.length === 0
      ? "  (all domains measured)"
      : "  " + ctx.unmeasured.map((u) => u.slug).join(", ");
  return `${head}\n${measured}\n\nUNMEASURED CAPACITIES:\n${unmeasured}`;
}

const CAPACITY_PROMPT_INSTRUCTIONS = `
CAPACITY PROFILE — this client has the following objectively-measured physical capacities (or lack thereof). Use these honestly:
- Read the measured capacities below. Reference them explicitly in capacity_profile.summary and notes_for_next_stage when they bear on programming intent.
- Treat unmeasured capacities honestly. Do NOT assume a level. Do NOT invent scores.
- The capacity_profile section of your output must be grounded ONLY in the measurements provided.
  • capacity_profile.strengths = capacities scoring ≥ 60. Each entry: { slug, note (≤200 chars) explaining why this strength matters for programming this client }.
  • capacity_profile.gaps = capacities scoring < 40. Each entry: { slug, note explaining the programming implication (what to introduce, what to delay, what to monitor) }.
  • capacity_profile.summary = 1–3 sentence narrative grounded in the measurements. If zero measured: "No capacities measured yet. Recommend an assessment battery before progressing." (translated to the brief's language).
  • capacity_profile.unmeasured_priority = up to 5 domain slugs from the UNMEASURED list, ordered by what would most inform safe programming for THIS client given their goal/constraints. Not a generic list.
- Capacity informs PROGRAMMING INTENT (notes_for_next_stage) and the CAPACITY PROFILE section. It does NOT change goal/constraints/red_flags — those still come from the intake.
- All capacity_profile prose must be in European Portuguese (pt-PT), formal address (você).`;

/**
 * R72.2 — Infer training modalities from any free text the brief may carry
 * (goal_text, secondary_goals, notes_for_next_stage). Always keeps "gym" as
 * a safe default unless an explicit non-gym modality is detected. Multi-tag
 * (e.g. "5K + boulder" → ["gym","running","climbing"]).
 */
export function inferTrainingModalities(
  brief: any,
  sectionAnalyses?: Record<string, any>,
): TrainingModality[] {
  const haystackParts: string[] = [];
  if (brief && typeof brief === "object") {
    haystackParts.push(String(brief.notes_for_next_stage ?? ""));
    haystackParts.push((brief.secondary_goals ?? []).join(" "));
  }
  if (sectionAnalyses) {
    const goal = (sectionAnalyses as any).goal ?? {};
    haystackParts.push(JSON.stringify(goal));
  }
  const text = haystackParts.join(" ").toLowerCase();
  const out = new Set<TrainingModality>();
  // Honor existing modalities (coach edit) when present.
  const existing = Array.isArray(brief?.training_modalities) ? brief.training_modalities : [];
  for (const m of existing) out.add(m);

  if (/(\b\d{1,2}\s*k\b|\bmaratona|meia[- ]maratona|trail|corrida|running|run\b|jog\b)/i.test(text)) out.add("running");
  if (/(boulder|escalad|climb|via\s|grau\s*[5-9][a-c]|6[abc+]|7[abc+]|8[abc+])/i.test(text)) out.add("climbing");
  if (/(handstand|calisten|street\s*workout|paralelas|barra\s*fixa|lever)/i.test(text)) out.add("calisthenics");
  if (/(mobilidade|flexibil|yoga|pilates)/i.test(text)) out.add("mobility");
  if (/(futebol|t[eé]nis|surf|handball|basquete|v[oô]lei|rugby|hokey|skate)/i.test(text)) out.add("sport_skill");

  // Default safety net: keep gym unless caller explicitly stripped it AND we
  // detected at least one alternative.
  if (out.size === 0 || existing.length === 0) out.add("gym");
  return Array.from(out);
}

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
    "capacity_profile",
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
    intensity_appetite: {
      type: "string",
      enum: ["conservador", "padrao", "agressivo"],
    },
    capacity_profile: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "strengths", "gaps", "unmeasured_priority"],
      properties: {
        summary: { type: "string", maxLength: 800 },
        strengths: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["slug", "note"],
            properties: {
              slug: { type: "string" },
              note: { type: "string", maxLength: 200 },
            },
          },
        },
        gaps: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["slug", "note"],
            properties: {
              slug: { type: "string" },
              note: { type: "string", maxLength: 200 },
            },
          },
        },
        unmeasured_priority: {
          type: "array",
          maxItems: 5,
          items: { type: "string" },
        },
      },
    },
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

    // R78 cost guard — reserve quota + lock plan before any AI spend.
    const reserved = await reservePlanQuota(supabase as any, data.planId, userId);
    if (!reserved.ok) {
      return { ok: false as const, error: "quota_exceeded", used: reserved.used, limit: reserved.limit };
    }
    const lock = await acquireGenerationLock(supabase as any, data.planId, userId);
    if (!lock.ok) {
      return { ok: false as const, error: "generation_locked" };
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

    // R2 — capacity context (measured + unmeasured per-domain).
    const capacityCtx = await loadCapacityContext(supabase, (plan as any).client_id);
    const capacityBlock = renderCapacityForPrompt(capacityCtx);

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

${CAPACITY_PROMPT_INSTRUCTIONS}

Output ONLY by calling the record_brief tool.`;

    const userMessage = `Per-section analyses (JSON map):\n${JSON.stringify(sectionAnalyses, null, 2)}\n\nDefault mesocycle length (weeks): ${(plan as any).duration_weeks ?? 4}\n\n${capacityBlock}`;

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
      input_snapshot: {
        section_analyses_keys: Object.keys(sectionAnalyses),
        capacityMeasuredCount: capacityCtx.measuredCount,
        capacityScores: capacityCtx.measured.reduce<Record<string, number>>(
          (acc, m) => {
            acc[m.slug] = m.score;
            return acc;
          },
          {},
        ),
      },
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

    const fallbackRow = await loadAssessmentForFallback(supabase, (plan as any).assessment_id);
    const sanitizedBrief = sanitizeMovementCompetencySummary(result.data, fallbackRow);
    // R72.2 — derive training_modalities from goal/notes text. Coach can
    // override later via brief edit. Default safety: always includes "gym".
    const withModalities = {
      ...sanitizedBrief,
      training_modalities: inferTrainingModalities(sanitizedBrief, sectionAnalyses as any),
    };

    // R2 — backfill capacity_profile counts so the panel always shows the
    // correct measured/total ratio even if the model omitted them.
    const cp = (withModalities as any).capacity_profile ?? {};
    (withModalities as any).capacity_profile = {
      ...cp,
      measured_count: capacityCtx.measuredCount,
      total_domains: capacityCtx.totalDomains,
      // If model returned no unmeasured_priority but we have unmeasured
      // domains, fall back to the natural display order.
      unmeasured_priority:
        Array.isArray(cp.unmeasured_priority) && cp.unmeasured_priority.length > 0
          ? cp.unmeasured_priority
          : capacityCtx.unmeasured.slice(0, 5).map((u) => u.slug),
    };

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update({
        brief: withModalities as any,
        generation_state: newState as any,
        ...clearDownstream("brief"),
      })
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };

    // R73 — stamp the active knowledge profile so the plan is reproducible.
    try {
      const { profileId, version } = await resolveRules(supabase, userId);
      if (profileId) {
        await supabase
          .from("workout_plans")
          .update({
            knowledge_profile_id: profileId,
            knowledge_profile_version: version,
          } as any)
          .eq("id", data.planId);
      }
    } catch {
      // Non-fatal — plan generation works without a stamped profile.
    }

    return { ok: true as const, brief: withModalities };
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
        assessmentCompletionPct: z.number().int().min(0).max(100).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("trainer_id, client_id, status, generation_status, generation_state")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }

    const prevState = GenerationStateSchema.safeParse((plan as any).generation_state ?? {});
    const approved = new Set(prevState.success ? prevState.data.approved_stages : []);
    approved.add("brief");

    const approvedAt = new Date().toISOString();
    const newState = GenerationStateSchema.parse({
      stage: "blueprint",
      approved_stages: Array.from(approved),
      last_updated_at: approvedAt,
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
    if (typeof data.assessmentCompletionPct === "number") {
      update.assessment_completion_pct = data.assessmentCompletionPct;
    }

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update(update as any)
      .eq("id", data.planId);
    if (updErr) return { ok: false as const, error: updErr.message };

    // Existing audit behavior is non-fatal: logAuditEvent logs and swallows
    // insert failures, so brief approval remains consistent with current paths.
    await logAuditEvent({
      trainerId: userId,
      actorId: userId,
      eventType: "plan_approved",
      entityType: "plan",
      entityId: data.planId,
      payload: {
        planId: data.planId,
        clientId: (plan as any).client_id ?? null,
        trainerId: userId,
        actorId: userId,
        approvedStage: "brief",
        source: "server:approveBrief",
        timestamp: approvedAt,
        previous: {
          stage: prevState.success ? prevState.data.stage : null,
          approvedStages: prevState.success ? prevState.data.approved_stages : [],
          status: (plan as any).status ?? null,
          generationStatus: (plan as any).generation_status ?? null,
        },
        next: {
          stage: newState.stage,
          approvedStages: newState.approved_stages,
          status: (plan as any).status ?? null,
          generationStatus: (plan as any).generation_status ?? null,
        },
      },
    });

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
    z.object({
      clientId: z.string().uuid(),
      title: z.string().optional(),
      durationWeeks: z.number().int().min(2).max(12).optional(),
    }).parse(d)
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
          duration_weeks: data.durationWeeks ?? 4,
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

    const fallbackRow2 = await loadAssessmentForFallback(supabase, (plan as any).assessment_id);
    const sanitizedBrief2 = sanitizeMovementCompetencySummary(result.data, fallbackRow2);

    const { error: updErr } = await supabase
      .from("workout_plans")
      .update({
        brief: sanitizedBrief2 as any,
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
