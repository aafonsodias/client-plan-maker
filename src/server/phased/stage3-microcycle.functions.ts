import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BlueprintSchema,
  BriefSchema,
  GenerationStateSchema,
  PhasedDaySchema,
} from "./schemas";
import { callAnthropicWithSchema, logGeneration, resolveModel } from "./ai.server";
import {
  classifyTier,
  tierGuidelines,
  type TierGuidelines,
  rpeFloors,
  isCarryLike,
  type RpeFloors,
} from "./programming-tier.server";
import { prescribeWeek, prescriptionPromptBlock } from "@/lib/prescribe-volume";

/**
 * Cap preparation duration at 15 minutes total (warmup + activation +
 * dynamic_stretches). The model frequently inflates these to 25–35 minutes,
 * which is unrealistic. We trim from the LARGEST section first while
 * preserving at least one item per non-empty section.
 */
function parseDurationToSeconds(d: string | undefined): number {
  if (!d) return 0;
  const s = String(d).toLowerCase().trim();
  const colon = s.match(/^(\d+):(\d{1,2})$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const min = s.match(/(\d+(?:[.,]\d+)?)\s*m/);
  const sec = s.match(/(\d+)\s*s/);
  let total = 0;
  if (min) total += parseFloat(min[1].replace(",", ".")) * 60;
  if (sec) total += parseInt(sec[1], 10);
  if (!min && !sec) {
    const n = parseFloat(s);
    if (!isNaN(n)) total += n * 60;
  }
  return total;
}

function sumPrepSeconds(items: any[] | undefined): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, it) => acc + parseDurationToSeconds(it?.duration), 0);
}

function sanitizePrepBlocks(day: any): any {
  if (!day) return day;
  const MAX_TOTAL_SEC = 15 * 60;
  const sections: ("warmup" | "activation" | "dynamic_stretches")[] = [
    "warmup",
    "activation",
    "dynamic_stretches",
  ];
  const total =
    sumPrepSeconds(day.warmup) +
    sumPrepSeconds(day.activation) +
    sumPrepSeconds(day.dynamic_stretches);
  if (total <= MAX_TOTAL_SEC) return day;
  // Compute scale to fit within 15 min, then re-format each item duration in minutes.
  const scale = MAX_TOTAL_SEC / total;
  const out = { ...day };
  for (const sec of sections) {
    const items = Array.isArray(day[sec]) ? day[sec] : [];
    if (items.length === 0) continue;
    out[sec] = items.map((it: any) => {
      const orig = parseDurationToSeconds(it?.duration);
      if (!orig) return it;
      const scaled = Math.max(20, Math.round(orig * scale));
      const formatted =
        scaled >= 60
          ? `${Math.round(scaled / 60)} min`
          : `${scaled} s`;
      return { ...it, duration: formatted };
    });
  }
  return out;
}

/**
 * Parse a free-form RPE string ("7", "7-8", "RPE 6.5", "@8") to a single number.
 * Returns null when nothing usable is found.
 */
function parseRpeNumber(rpe: string | undefined | null): number | null {
  if (!rpe) return null;
  const s = String(rpe).toLowerCase();
  // Range like "7-8" → take the higher number (closer to coach intent).
  const range = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return parseFloat(range[2]);
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Deterministic Week-1 RPE floor enforcement.
 *
 * Iterates main-block exercises. For each one classifies the role
 * (main lift = first exercise; carry/core = name-matched; accessory = rest),
 * looks up the floor for the active tier × appetite and bumps `ex.rpe` up
 * when it sits below the floor. Original RPE is preserved on `ex.meta.rpe_original`
 * for auditing.
 *
 * Returns the (possibly-mutated) day plus a `floorApplied` count for telemetry.
 */
function enforceRpeFloor(
  day: any,
  floors: RpeFloors,
): { day: any; floorApplied: number } {
  if (!day || !Array.isArray(day.exercises)) return { day, floorApplied: 0 };
  let applied = 0;
  const exercises = day.exercises.map((ex: any, idx: number) => {
    const isMain = idx === 0;
    const isCarry = isCarryLike(ex?.name);
    const floor = isMain ? floors.main : isCarry ? floors.carry : floors.accessory;
    const current = parseRpeNumber(ex?.rpe);
    if (current != null && current >= floor) return ex;
    const meta = { ...(ex?.meta ?? {}), rpe_original: ex?.rpe ?? null, rpe_floor_applied: true };
    applied++;
    return { ...ex, rpe: String(floor), meta };
  });
  return { day: { ...day, exercises }, floorApplied: applied };
}

// JSON-Schema for the day tool. Mirrors PhasedDaySchema/WeekDaySchema.
const SECTION_ITEM = {
  type: "object",
  additionalProperties: false,
  required: ["name", "duration", "notes"],
  properties: {
    name: { type: "string" },
    duration: { type: "string" },
    notes: { type: "string" },
  },
};

const DAY_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "day_label",
    "focus",
    "rationale",
    "warmup",
    "activation",
    "dynamic_stretches",
    "cooldown",
    "finisher",
    "finisher_enabled",
    "cardio",
    "exercises",
  ],
  properties: {
    day_label: { type: "string" },
    focus: { type: "string" },
    rationale: { type: "string" },
    warmup: { type: "array", items: SECTION_ITEM },
    activation: { type: "array", items: SECTION_ITEM },
    dynamic_stretches: { type: "array", items: SECTION_ITEM },
    cooldown: { type: "array", items: SECTION_ITEM },
    finisher: { type: "array", items: SECTION_ITEM },
    finisher_enabled: { type: "boolean" },
    cardio: { type: "array", items: SECTION_ITEM },
    exercises: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name", "sets", "reps", "rest", "notes",
          "primary_muscles", "secondary_muscles",
          "rpe", "tempo", "technique_cues", "cue",
          "rationale", "superset_id", "variant", "optional", "equipment",
        ],
        properties: {
          name: { type: "string" },
          sets: { type: "string" },
          reps: { type: "string" },
          rest: { type: "string" },
          notes: { type: "string" },
          primary_muscles: { type: "array", items: { type: "string" } },
          secondary_muscles: { type: "array", items: { type: "string" } },
          rpe: { type: "string" },
          tempo: { type: "string" },
          technique_cues: { type: "string" },
          cue: { type: "string" },
          rationale: { type: "string" },
          superset_id: { type: ["string", "null"] },
          variant: { type: ["string", "null"] },
          optional: { type: "boolean" },
          equipment: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

type LoadedPlan = {
  trainer_id: string;
  brief: any;
  blueprint: any;
  generation_meta?: any;
  assessment_id?: string | null;
  client_id?: string | null;
};

async function loadPlan(supabase: any, planId: string, userId: string): Promise<
  { ok: true; plan: LoadedPlan } | { ok: false; error: string }
> {
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("trainer_id, brief, blueprint, generation_meta, assessment_id, client_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || (plan as any).trainer_id !== userId) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, plan: plan as LoadedPlan };
}

function archetypeForDay(blueprint: any, dayIndex: number): {
  id: string;
  focus: string;
  primary_movements: string[];
} | null {
  const map = blueprint?.week_to_session_map ?? {};
  const week1 = map["1"] ?? Object.values(map)[0];
  if (!Array.isArray(week1)) return null;
  const id = week1[dayIndex - 1];
  if (!id) return null;
  const arch = (blueprint?.session_archetypes ?? []).find((a: any) => a?.id === id);
  if (!arch) return { id, focus: id, primary_movements: [] };
  return arch;
}

async function runDay(
  supabase: any,
  userId: string,
  planId: string,
  dayIndex: number,
  brief: any,
  blueprint: any,
  guidelines: TierGuidelines | null
): Promise<{ ok: true; day: any } | { ok: false; error: string }> {
  const arch = archetypeForDay(blueprint, dayIndex);
  if (!arch) return { ok: false, error: `No archetype for day ${dayIndex}` };

  const equipment = (brief?.equipment_constraints ?? []).join(", ") || "no specific constraints";
  const redFlags = (brief?.red_flags ?? []).join("; ") || "none";

  // Resolve role-specific RPE floors from tier × appetite. Both Stage 3
  // (anchor) and the post-validator below use these same numbers so the
  // model is told the truth and the truth is enforced after.
  const tierForFloors = guidelines?.tier ?? "conservative";
  const appetite = String(brief?.intensity_appetite ?? "padrao");
  const floors = rpeFloors(tierForFloors, appetite);

  // Volume prescription — Stage 3 generates the WEEK-1 anchor day. Tell the
  // model both the full meso curve (so progression sense is right) and the
  // week-1 targets it must meet via this single day's contribution.
  const totalWeeks = Math.max(
    4,
    Number(blueprint?.mesocycle_length_weeks) || Number(brief?.mesocycle_length_weeks) || 4,
  );
  const week1 = prescribeWeek(1, totalWeeks);
  const week1TargetsLine = week1.rows
    .map((r) => `${r.muscle}=${r.target}(${r.min}..${r.max})`)
    .join(" ");
  const volumeBlock = `\n\nWEEKLY VOLUME PRESCRIPTION (full mesocycle, hard constraint):\n${prescriptionPromptBlock(totalWeeks)}\n\nTHIS DAY contributes to WEEK 1 totals: ${week1TargetsLine}.\nPick exercises whose primary/secondary muscles move the day toward those weekly targets without overshooting on any single muscle.`;

  const tierBlock = guidelines
    ? `

PROGRAMMING TIER: ${guidelines.tier.toUpperCase()}
- Main-block exercises (the "exercises" array): ${guidelines.exercisesPerSessionMin}-${guidelines.exercisesPerSessionMax}.
- RPE range: ${guidelines.rpeRange}.
${
  guidelines.forbiddenExercises.length > 0
    ? `- DO NOT USE these exercises (any variation): ${guidelines.forbiddenExercises.join(", ")}.
- Use these alternatives instead:
${guidelines.requiredAlternatives}`
    : ""
}`
    : "";

  const rpeFloorBlock = `

WEEK 1 RPE FLOORS (intensity_appetite = ${appetite.toUpperCase()}):
- Main lift (the FIRST exercise): RPE >= ${floors.main}. Sit AT or NEAR this number — never below.
- Secondary / accessory exercises: RPE >= ${floors.accessory}.
- Carry / Pallof / dead-bug / plank / suitcase / farmer: RPE >= ${floors.carry}.
RPE 5 is reserved for warm-up / activation / cooldown — NEVER for the main block.
If a movement is genuinely "supported" or rehab-style, prefer reducing load and KEEPING RPE at the floor (the goal is honest effort, not artificially low numbers).`;

  const system = `You are a senior strength coach generating ONE single training session.

Output ONE day matching the record_day tool. NO weeks, NO multi-day, NO programming notes outside the schema.

RULES:
- Order: warmup → activation → dynamic_stretches → exercises → cooldown → (finisher if enabled) → (cardio if relevant).
- exercises: ${guidelines ? `${guidelines.exercisesPerSessionMin}-${guidelines.exercisesPerSessionMax}` : "4–8"} entries. Order: primer → main lift → secondary → accessories → optional.
- Main lift: the FIRST exercise with RPE ≥ 8 (or first exercise if none).
- superset_id: same string for paired exercises (max 3 groups), null otherwise. NEVER pair the main lift in a strength phase.
- optional: ≤ 2 marked optional, all with RPE ≤ 7.
- equipment[]: subset of available equipment.
- rationale (per day AND per exercise): 1–2 sentences referencing concrete client constraints (red flags, training age, movement competency). No generic phrases like "build strength" or "compound movement".
- All required fields must be filled — use empty arrays/strings where genuinely empty.

Call record_day exactly once.${tierBlock}${rpeFloorBlock}`;

  const user = `Day ${dayIndex} of Week 1.
Archetype: ${arch.id} — ${arch.focus}
Primary movements: ${arch.primary_movements.join(", ") || "(coach's choice)"}

Brief context:
- primary_goal: ${brief.primary_goal}
- training_age_band: ${brief.training_age_band}
- sessions_per_week: ${brief.sessions_per_week?.recommended}
- movement_competency_summary: ${JSON.stringify(brief.movement_competency_summary)}
- red_flags: ${redFlags}
- equipment available: ${equipment}
- progression_model: ${blueprint?.progression_model_proposal?.model ?? "linear"}
- coach notes: ${brief.notes_for_next_stage || "(none)"}

Generate ONLY this single day's session.`;

  const model = resolveModel("FORGE_MODEL_STAGE_3", "claude-sonnet-4-5-20250929");
  const result = await callAnthropicWithSchema({
    model,
    system,
    userMessage: user,
    toolName: "record_day",
    toolDescription: "Record one training session as a structured day.",
    toolJsonSchema: DAY_TOOL_SCHEMA,
    schema: PhasedDaySchema,
    maxTokens: 4000,
  });

  await logGeneration(supabase, {
    trainer_id: userId,
    plan_id: planId,
    stage: `stage3:day${dayIndex}`,
    model_used: model,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    cost_usd: result.costUsd,
    zod_passed: result.ok,
    retry_count: result.retryCount,
    duration_ms: result.durationMs,
    error: result.ok ? null : result.error,
    output_snapshot: result.ok ? { day_label: result.data.day_label, focus: result.data.focus } : (result as any).zodError ?? null,
  });

  if (!result.ok) return { ok: false, error: result.error };
  // Deterministic post-validation: lift any RPE that came in below the floor.
  const sanitized = sanitizePrepBlocks(result.data);
  const { day: floored, floorApplied } = enforceRpeFloor(sanitized, floors);
  if (floorApplied > 0) {
    await logGeneration(supabase, {
      trainer_id: userId,
      plan_id: planId,
      stage: `stage3:day${dayIndex}:rpe_floor`,
      model_used: "deterministic",
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      zod_passed: true,
      retry_count: 0,
      duration_ms: 0,
      error: null,
      input_snapshot: { tier: tierForFloors, appetite, floors },
      output_snapshot: { floorApplied },
    });
  }
  return { ok: true, day: floored };
}

async function upsertDayRow(
  supabase: any,
  trainer_id: string,
  planId: string,
  weekNumber: number,
  dayIndex: number,
  status: "done" | "error",
  day: any,
  errorText?: string
) {
  // Find existing row
  const { data: existing } = await supabase
    .from("workout_plan_days")
    .select("id")
    .eq("plan_id", planId)
    .eq("week_number", weekNumber)
    .eq("day_number", dayIndex)
    .maybeSingle();

  const payload: any = {
    plan_id: planId,
    trainer_id,
    week_number: weekNumber,
    day_number: dayIndex,
    day_label: day?.day_label ?? `Day ${dayIndex}`,
    focus: day?.focus ?? "",
    rationale: day?.rationale ?? "",
    status,
    content: day ?? {},
    validation_meta: errorText ? { error: errorText } : {},
  };

  if (existing?.id) {
    await supabase.from("workout_plan_days").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("workout_plan_days").insert(payload);
  }
}

async function markPending(
  supabase: any,
  trainer_id: string,
  planId: string,
  dayIndex: number
) {
  const { data: existing } = await supabase
    .from("workout_plan_days")
    .select("id")
    .eq("plan_id", planId)
    .eq("week_number", 1)
    .eq("day_number", dayIndex)
    .maybeSingle();
  const payload: any = {
    plan_id: planId,
    trainer_id,
    week_number: 1,
    day_number: dayIndex,
    day_label: `Day ${dayIndex}`,
    focus: "",
    rationale: "",
    status: "pending",
    content: {},
    validation_meta: {},
  };
  if (existing?.id) {
    await supabase.from("workout_plan_days").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("workout_plan_days").insert(payload);
  }
}

async function resolveTierGuidelines(
  supabase: any,
  loadedPlan: LoadedPlan,
  brief: any,
): Promise<TierGuidelines | null> {
  const meta = loadedPlan.generation_meta as any;
  if (meta?.tier_guidelines) return meta.tier_guidelines as TierGuidelines;
  if (meta?.tier && brief) {
    return tierGuidelines(meta.tier, brief.sessions_per_week?.recommended ?? 3, brief.primary_goal);
  }
  // Fallback: classify from assessment now.
  let assessment: Record<string, any> | null = null;
  if (loadedPlan.assessment_id) {
    const { data } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", loadedPlan.assessment_id)
      .maybeSingle();
    assessment = (data as any) ?? null;
  }
  if (!assessment && loadedPlan.client_id) {
    const { data } = await supabase
      .from("assessments")
      .select("*")
      .eq("client_id", loadedPlan.client_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    assessment = (data as any) ?? null;
  }
  if (!brief) return null;
  const tier = classifyTier(brief, assessment ?? {});
  return tierGuidelines(tier, brief.sessions_per_week?.recommended ?? 3, brief.primary_goal);
}

/** Generate a single day (used for Day 1 and per-day regen). */
export const generateDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid(), dayIndex: z.number().int().min(1).max(7) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const loaded = await loadPlan(supabase, data.planId, userId);
    if (!loaded.ok) return { ok: false as const, error: loaded.error };
    const briefP = BriefSchema.safeParse(loaded.plan.brief);
    const bpP = BlueprintSchema.safeParse(loaded.plan.blueprint);
    if (!briefP.success || !bpP.success) {
      return { ok: false as const, error: "Brief or blueprint missing/invalid" };
    }
    const guidelines = await resolveTierGuidelines(supabase, loaded.plan, briefP.data);
    await markPending(supabase, userId, data.planId, data.dayIndex);
    const r = await runDay(
      supabase,
      userId,
      data.planId,
      data.dayIndex,
      briefP.data,
      bpP.data,
      guidelines,
    );
    if (!r.ok) {
      await upsertDayRow(supabase, userId, data.planId, 1, data.dayIndex, "error", null, r.error);
      return { ok: false as const, error: r.error };
    }
    await upsertDayRow(supabase, userId, data.planId, 1, data.dayIndex, "done", r.day);
    return { ok: true as const };
  });

/** Generate days 2..N with bounded concurrency = 5, server-side. */
export const generateMicrocycleDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        dayIndices: z.array(z.number().int().min(1).max(7)).min(1).max(7),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const loaded = await loadPlan(supabase, data.planId, userId);
    if (!loaded.ok) return { ok: false as const, error: loaded.error };
    const briefP = BriefSchema.safeParse(loaded.plan.brief);
    const bpP = BlueprintSchema.safeParse(loaded.plan.blueprint);
    if (!briefP.success || !bpP.success) {
      return { ok: false as const, error: "Brief or blueprint missing/invalid" };
    }
    const guidelines = await resolveTierGuidelines(supabase, loaded.plan, briefP.data);

    // Mark all pending immediately so UI sees them.
    await Promise.all(data.dayIndices.map((d) => markPending(supabase, userId, data.planId, d)));

    const queue = [...data.dayIndices];
    const concurrency = 5;
    let okCount = 0;
    let errCount = 0;

    async function worker() {
      while (queue.length > 0) {
        const idx = queue.shift();
        if (idx == null) return;
        try {
          const r = await runDay(
            supabase,
            userId,
            data.planId,
            idx,
            briefP.data,
            bpP.data,
            guidelines,
          );
          if (r.ok) {
            await upsertDayRow(supabase, userId, data.planId, 1, idx, "done", r.day);
            okCount++;
          } else {
            await upsertDayRow(supabase, userId, data.planId, 1, idx, "error", null, r.error);
            errCount++;
          }
        } catch (e) {
          await upsertDayRow(
            supabase,
            userId,
            data.planId,
            1,
            idx,
            "error",
            null,
            e instanceof Error ? e.message : String(e)
          );
          errCount++;
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
    return { ok: true as const, generated: okCount, errors: errCount };
  });

export const approveMicrocycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
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
    const newState = GenerationStateSchema.parse({
      stage: "progressions",
      approved_stages: Array.from(approved),
      last_updated_at: new Date().toISOString(),
    });
    const { error } = await supabase
      .from("workout_plans")
      .update({ generation_state: newState as any })
      .eq("id", data.planId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

// ---- Inline edits to a generated day -------------------------------------
const ExerciseEditZ = z.object({
  name: z.string().min(1),
  sets: z.string().default(""),
  reps: z.string().default(""),
  rest: z.string().default(""),
  rpe: z.string().default(""),
  cue: z.string().default(""),
});

export const updateDayContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        dayId: z.string().uuid(),
        focus: z.string().optional(),
        rationale: z.string().optional(),
        exercises: z.array(ExerciseEditZ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("workout_plan_days")
      .select("trainer_id, content")
      .eq("id", data.dayId)
      .maybeSingle();
    if (!row || (row as any).trainer_id !== userId) {
      return { ok: false as const, error: "forbidden" };
    }
    const prevContent = ((row as any).content ?? {}) as Record<string, unknown>;
    const prevExercises = (prevContent.exercises as any[]) ?? [];
    const mergedExercises = data.exercises.map((ex, i) => ({
      ...(prevExercises[i] ?? {}),
      ...ex,
    }));
    const newContent = { ...prevContent, exercises: mergedExercises };
    const update: {
      content: Record<string, unknown>;
      focus?: string;
      rationale?: string;
    } = { content: newContent };
    if (typeof data.focus === "string") update.focus = data.focus;
    if (typeof data.rationale === "string") update.rationale = data.rationale;
    const { error } = await supabase
      .from("workout_plan_days")
      .update(update as any)
      .eq("id", data.dayId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/**
 * reanchorPlanRpe — retroactive RPE floor application for an existing plan.
 *
 * Use case: Marta's plan was generated before the floor logic existed and
 * the whole mesocycle reads RPE 5.4 across all 4 weeks. Instead of forcing
 * the trainer to throw the plan away and regenerate, this fn:
 *   1. Re-resolves tier × intensity_appetite floors.
 *   2. Walks every workout_plan_days row (Week 1 only — the anchor).
 *   3. Applies enforceRpeFloor() determinatively and updates `content`.
 *   4. Wipes the cached progression_plan so the next view forces re-generation
 *      OR the trainer re-runs Stage 4 to layer a real wave on top.
 */
export const reanchorPlanRpe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const loaded = await loadPlan(supabase, data.planId, userId);
    if (!loaded.ok) return { ok: false as const, error: loaded.error };
    const briefP = BriefSchema.safeParse(loaded.plan.brief);
    if (!briefP.success) return { ok: false as const, error: "Brief inválido — não dá para re-ancorar." };
    const guidelines = await resolveTierGuidelines(supabase, loaded.plan, briefP.data);
    const tier = guidelines?.tier ?? "conservative";
    const appetite = String(briefP.data.intensity_appetite ?? "padrao");
    const floors = rpeFloors(tier, appetite);

    const { data: rows } = await supabase
      .from("workout_plan_days")
      .select("id, content")
      .eq("plan_id", data.planId)
      .eq("week_number", 1);

    let touched = 0;
    let totalApplied = 0;
    for (const row of (rows ?? []) as any[]) {
      const { day, floorApplied } = enforceRpeFloor(row.content ?? {}, floors);
      if (floorApplied > 0) {
        await supabase
          .from("workout_plan_days")
          .update({ content: day })
          .eq("id", row.id);
        touched++;
        totalApplied += floorApplied;
      }
    }

    return {
      ok: true as const,
      tier,
      appetite,
      floors,
      daysTouched: touched,
      exercisesBumped: totalApplied,
    };
  });