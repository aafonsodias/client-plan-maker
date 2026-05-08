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
import { resolveRules } from "@/server/knowledge/resolve.server";
import { resolveLandmarks } from "@/server/knowledge/schema";
import { getLatestWaistCm } from "@/server/capacity.server";
import type { MuscleGroup } from "@/lib/volume-landmarks";
import type { VolumeLandmark } from "@/lib/volume-landmarks";
import {
  validateDayAgainstFittVp,
  type PrescriptionParameters,
  type FittVpViolation,
} from "@/server/fitt-vp/derive.server";

/**
 * Lowercase / strip variant suffix to compare exercise names across blocks.
 * "Barbell back squat (close stance)" → "barbell back squat".
 */
function normalizeExerciseName(n: string): string {
  return String(n ?? "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute % of accessories in this microcycle that are NOT in the prior pool.
 * The first exercise of each day is treated as the main lift and excluded
 * (mains are allowed to repeat across blocks for progression).
 */
function computeAccessoryRotationPct(
  days: any[],
  priorPool: string[],
): { pct: number; accessoryCount: number; rotated: number; topPriorAccessories: string[] } {
  if (!Array.isArray(days) || days.length === 0 || priorPool.length === 0) {
    return { pct: 100, accessoryCount: 0, rotated: 0, topPriorAccessories: [] };
  }
  const priorSet = new Set(priorPool.map(normalizeExerciseName).filter(Boolean));
  let total = 0;
  let rotated = 0;
  for (const d of days) {
    const ex = Array.isArray(d?.exercises) ? d.exercises : [];
    // accessories = everything except first (main lift)
    for (let i = 1; i < ex.length; i++) {
      const name = normalizeExerciseName(ex[i]?.name);
      if (!name) continue;
      total++;
      if (!priorSet.has(name)) rotated++;
    }
  }
  const pct = total > 0 ? Math.round((rotated / total) * 100) : 100;
  return { pct, accessoryCount: total, rotated, topPriorAccessories: priorPool.slice(0, 12) };
}

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
  prescription_parameters?: any;
};

async function loadPlan(supabase: any, planId: string, userId: string): Promise<
  { ok: true; plan: LoadedPlan } | { ok: false; error: string }
> {
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("trainer_id, brief, blueprint, generation_meta, assessment_id, client_id, prescription_parameters")
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
  const archetypes = Array.isArray(blueprint?.session_archetypes)
    ? blueprint.session_archetypes
    : [];
  // Primary path: matrix has an entry for this day.
  let id: string | undefined =
    Array.isArray(week1) && dayIndex - 1 < week1.length ? week1[dayIndex - 1] : undefined;
  // Fallback 1: matrix exists but is too short — round-robin through archetypes.
  if (!id && archetypes.length > 0) {
    id = archetypes[(dayIndex - 1) % archetypes.length]?.id;
  }
  // Fallback 2: nothing usable — synthesize a generic full-body archetype.
  if (!id) {
    return {
      id: "full_body",
      focus: "Full body",
      primary_movements: ["squat", "hinge", "push", "pull"],
    };
  }
  const arch = archetypes.find((a: any) => a?.id === id);
  if (!arch) return { id, focus: id, primary_movements: [] };
  return arch;
}

/**
 * Render the FITT-VP "non-negotiable" constraints block injected into the
 * Stage 3 system prompt. ACSM 12e thresholds derived in Stage 2 from
 * acsm_thresholds. Citations are surfaced so the model knows the source.
 */
function fittVpPromptBlock(pp: PrescriptionParameters | null): string {
  if (!pp) return "";
  const c = pp.cardio;
  const r = pp.resistance;
  const f = pp.flexibility;
  const sf = pp.safety_floors;
  const cits = (pp.citations ?? [])
    .map((x) => `${x.source} ${x.ref}`)
    .join("; ");
  const crBp =
    sf.cardiac_rehab_resting_sbp_mmhg && sf.cardiac_rehab_resting_dbp_mmhg
      ? `\n- Cardiac rehab resting BP exclusion: SBP >= ${sf.cardiac_rehab_resting_sbp_mmhg} OR DBP >= ${sf.cardiac_rehab_resting_dbp_mmhg}`
      : "";
  return `

CONSTRAINTS — FITT-VP Non-Negotiable (ACSM 12e):
- Cardio intensity: ${c.intensity_pct_hrr.low}-${c.intensity_pct_hrr.high}% HRR (${c.intensity_pct_hrr.zone})
- Cardio weekly time: ${c.weekly_minutes.min}-${c.weekly_minutes.max} min/week
- Resistance frequency: ${r.frequency_days_per_week.min}-${r.frequency_days_per_week.max} d/wk
- Resistance inter-set rest (strength, RPE >= 8): ${r.inter_set_rest_seconds_strength.min}-${r.inter_set_rest_seconds_strength.max} sec
- Static stretch hold: ${f.static_stretch_hold_seconds.min}-${f.static_stretch_hold_seconds.max} sec (pre-exercise max ${f.pre_exercise_static_max_seconds}s)

Safety floors (absolute stop criteria):
- BP test stop: SBP >= ${sf.bp_test_stop_sbp_mmhg} OR DBP >= ${sf.bp_test_stop_dbp_mmhg}
- Submax test stop: >= ${sf.submax_stop_pct_hrr}% HRR OR >= ${sf.submax_stop_pct_age_pred_hrmax}% age-pred HRmax${crBp}

Citations: ${cits}

Your generated exercise selections, rest periods, and stretch durations MUST fit within these ranges. Do not negotiate or interpret these as guidelines — they are constraints.`;
}

async function runDay(
  supabase: any,
  userId: string,
  planId: string,
  dayIndex: number,
  brief: any,
  blueprint: any,
  guidelines: TierGuidelines | null,
  priorSummary: any = null,
  priorExercisePool: string[] = [],
  hardBan: string[] = [],
  swapMainLift: boolean = false,
  prescriptionParameters: PrescriptionParameters | null = null,
  pklLandmarks: Record<MuscleGroup, VolumeLandmark> | null = null,
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
  const week1 = prescribeWeek(1, totalWeeks, { priorSummary, landmarks: pklLandmarks ?? undefined });
  const week1TargetsLine = week1.rows
    .map((r) => `${r.muscle}=${r.target}(${r.min}..${r.max})`)
    .join(" ");
  const volumeBlock = `\n\nWEEKLY VOLUME PRESCRIPTION (full mesocycle, hard constraint):\n${prescriptionPromptBlock(totalWeeks, { priorSummary, landmarks: pklLandmarks ?? undefined })}\n\nTHIS DAY contributes to WEEK 1 totals: ${week1TargetsLine}.\nPick exercises whose primary/secondary muscles move the day toward those weekly targets without overshooting on any single muscle.`;

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

  const rotationBlock = priorExercisePool.length > 0
    ? `\n\nEXERCISE ROTATION (block N>1) — SAID variation rule:\nThe prior block already exhausted these exercises: ${priorExercisePool.slice(0, 40).join(", ")}.\nAt least 60% of the accessories you pick for THIS day must NOT be in that list (substitute with same movement pattern + same intent — e.g. replace 'leg press' with 'hack squat' or 'belt squat'). The 1–2 main lifts may repeat if they are the driver of progression. Isolators MUST rotate. Variation is what creates new adaptation; clones stall.`
    : "";

  const hardBanBlock = hardBan.length > 0
    ? `\n\nRETRY — STRICT BAN LIST:\nThe previous attempt repeated too many accessories. DO NOT use any of these accessories (any close variant): ${hardBan.slice(0, 14).join(", ")}.\nReplace each with the closest substitute that trains the same primary muscle / pattern (e.g. swap incline DB press → low-incline machine press; swap leg press → belt squat or hack squat). Main lift may stay.`
    : "";

  const mainLiftSwapBlock = swapMainLift && priorExercisePool.length > 0
    ? `\n\nMAIN LIFT REFRESH (block ≥4 — anti-stale):\nWe've kept the same main lifts for several blocks. For at least ONE pattern this microcycle, swap the main lift to a same-pattern variant (e.g. back squat → front squat or safety-bar squat; bench press → low-incline DB press; conventional deadlift → trap-bar; barbell row → chest-supported row). Keep RPE floors and intent unchanged. The remaining main lifts may stay.`
    : "";

  const fittVpBlock = fittVpPromptBlock(prescriptionParameters);

  // R72.2 — surface declared training modalities so the model adapts cardio /
  // skill blocks accordingly (e.g. running intervals expressed inside cardio[]
  // text, climbing pyramids inside notes). Structured intervals/climb_blocks
  // schema fields land in R72.2b.
  const modalities: string[] = Array.isArray(brief?.training_modalities) && brief.training_modalities.length > 0
    ? brief.training_modalities
    : ["gym"];
  const modalityTargets = brief?.modality_targets ?? {};
  const modalityBlock = modalities.length === 1 && modalities[0] === "gym"
    ? ""
    : `\n\nTRAINING MODALITIES (R72.2): ${modalities.join(", ")}.\n` +
      `Modality targets: ${JSON.stringify(modalityTargets)}.\n` +
      `For 'running' sessions, populate cardio[] with explicit interval structure inside notes (e.g. "5×800m @ 4:00/km, 90s rest" or "Z2 base 40min @ HR 130-145"). ` +
      `For 'climbing', use the exercises[] list to express boulder/route blocks (warmup V0-V2 → project at limit → endurance circuits) — sets/reps map to attempts. ` +
      `For 'calisthenics' and 'sport_skill', exercises[] should include skill drills (handstand against wall 5×30s, single-leg balance) before strength accessories. ` +
      `For 'mobility', favour activation[]/dynamic_stretches[] over heavy resistance. ` +
      `Always keep gym strength work honest to the tier and RPE floors above.`;

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

Call record_day exactly once.${tierBlock}${rpeFloorBlock}${fittVpBlock}${volumeBlock}${rotationBlock}${hardBanBlock}${mainLiftSwapBlock}${modalityBlock}`;

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

  const model = resolveModel("FORGE_MODEL_STAGE_3", "google/gemini-2.5-flash");
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

  // ---- FITT-VP validator + 1× retry (R2.2 Phase C.3) ---------------------
  // Only run the expensive retry on block N≥2 (where prior pool exists) — for
  // block 1 we accept first-pass output to keep generation snappy.
  let finalDay = floored;
  if (prescriptionParameters && priorExercisePool.length > 0) {
    const violationsInitial: FittVpViolation[] = validateDayAgainstFittVp(
      finalDay,
      prescriptionParameters,
    );
    if (violationsInitial.length > 0) {
      const violationLines = violationsInitial
        .map(
          (v) =>
            `- ${v.exercise}: ${v.field} = ${v.observed}, threshold ${JSON.stringify(v.threshold)} (${v.citation.source} ${v.citation.ref})`,
        )
        .join("\n");
      const retrySystem = `${system}\n\nPREVIOUS OUTPUT VIOLATED FITT-VP CONSTRAINTS:\n${violationLines}\n\nRegenerate ensuring ALL exercises fit within the FITT-VP ranges above. These are non-negotiable.`;
      const retry = await callAnthropicWithSchema({
        model,
        system: retrySystem,
        userMessage: user,
        toolName: "record_day",
        toolDescription: "Record one training session as a structured day.",
        toolJsonSchema: DAY_TOOL_SCHEMA,
        schema: PhasedDaySchema,
        maxTokens: 4000,
      });
      let violationsAfter: FittVpViolation[] = violationsInitial;
      if (retry.ok) {
        const retrySanitized = sanitizePrepBlocks(retry.data);
        const { day: retryFloored } = enforceRpeFloor(retrySanitized, floors);
        violationsAfter = validateDayAgainstFittVp(retryFloored, prescriptionParameters);
        // Use retry output if it strictly improves things; else keep original.
        if (violationsAfter.length < violationsInitial.length) {
          finalDay = retryFloored;
        }
      }
      await logGeneration(supabase, {
        trainer_id: userId,
        plan_id: planId,
        stage: `stage3:day${dayIndex}:fittvp_validator`,
        model_used: model,
        input_tokens: retry.inputTokens,
        output_tokens: retry.outputTokens,
        cost_usd: retry.costUsd,
        zod_passed: retry.ok,
        retry_count: 1,
        duration_ms: retry.durationMs,
        error: retry.ok ? null : (retry as any).error,
        input_snapshot: { violations_initial: violationsInitial },
        output_snapshot: {
          violations_initial_count: violationsInitial.length,
          violations_after_retry_count: violationsAfter.length,
          retry_succeeded: violationsAfter.length === 0,
        },
      });
    }
  }
  return { ok: true, day: finalDay };
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
  if (loadedPlan.client_id) {
    const latestWaist = await getLatestWaistCm(loadedPlan.client_id, supabase as any);
    if (latestWaist != null) {
      assessment = { ...(assessment ?? {}), waist_cm: latestWaist };
    }
  }
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
    const priorBlockSummary = (loaded.plan.generation_meta as any)?.block_feedback ?? null;
    const priorPool = ((loaded.plan.generation_meta as any)?.prior_exercise_pool ?? []) as string[];
    const swapMainLift = !!(loaded.plan.generation_meta as any)?.suggest_main_lift_swap;
    const pp = (loaded.plan.prescription_parameters ?? null) as PrescriptionParameters | null;
    await markPending(supabase, userId, data.planId, data.dayIndex);
    const { rules: pklRules } = await resolveRules(supabase, userId);
    const pklLandmarks = resolveLandmarks(pklRules);
    const r = await runDay(
      supabase,
      userId,
      data.planId,
      data.dayIndex,
      briefP.data,
      bpP.data,
      guidelines,
      priorBlockSummary,
      priorPool,
      [],
      swapMainLift,
      pp,
      pklLandmarks,
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
        dayIndices: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
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
    const sessionsPerWeek = Math.max(1, Math.min(7, bpP.data.sessions_per_week ?? 0));
    const dayIndices = data.dayIndices ?? Array.from({ length: sessionsPerWeek }, (_, i) => i + 1);
    const guidelines = await resolveTierGuidelines(supabase, loaded.plan, briefP.data);
    const priorBlockSummary = (loaded.plan.generation_meta as any)?.block_feedback ?? null;
    const priorPool = ((loaded.plan.generation_meta as any)?.prior_exercise_pool ?? []) as string[];
    const swapMainLift = !!(loaded.plan.generation_meta as any)?.suggest_main_lift_swap;
    const pp = (loaded.plan.prescription_parameters ?? null) as PrescriptionParameters | null;
    const { rules: pklRules } = await resolveRules(supabase, userId);
    const pklLandmarks = resolveLandmarks(pklRules);

    // Mark all pending immediately so UI sees them.
    await Promise.all(dayIndices.map((d) => markPending(supabase, userId, data.planId, d)));

    console.log("[generateMicrocycleDays] start", {
      planId: data.planId,
      sessionsPerWeek,
      dayIndices,
      priorPoolSize: priorPool.length,
    });
    const queue = [...dayIndices];
    const concurrency = 7;
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
            priorBlockSummary,
            priorPool,
            [],
            swapMainLift,
            pp,
            pklLandmarks,
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
    console.log("[generateMicrocycleDays] done", { planId: data.planId, ok: okCount, err: errCount });

    // ---- Post-validation: rotation audit (block N>1 only) -----------------
    let rotationAudit: any = null;
    if (priorPool.length > 0) {
      const { data: rows } = await supabase
        .from("workout_plan_days")
        .select("day_number, content")
        .eq("plan_id", data.planId)
        .eq("week_number", 1);
      const days = ((rows ?? []) as any[]).map((r) => r.content ?? {});
      const first = computeAccessoryRotationPct(days, priorPool);
      rotationAudit = { firstPct: first.pct, accessoryCount: first.accessoryCount, retried: false, finalPct: first.pct };

      // If <40% of accessories rotated, retry the most-stale days once with a
      // hard "do not use" list. Cap to 3 worst days to keep cost bounded.
      if (first.pct < 40 && first.accessoryCount > 0) {
        const banned = first.topPriorAccessories;
        // Identify days where ≥50% of accessories collide with prior pool.
        const stale: number[] = [];
        for (const r of (rows ?? []) as any[]) {
          const ex = Array.isArray(r.content?.exercises) ? r.content.exercises : [];
          if (ex.length <= 1) continue;
          const accs = ex.slice(1);
          const collisions = accs.filter((e: any) =>
            new Set(banned.map(normalizeExerciseName)).has(normalizeExerciseName(e?.name)),
          ).length;
          if (collisions / accs.length >= 0.5) stale.push(r.day_number as number);
        }
        const targets = stale.slice(0, 3);
        for (const idx of targets) {
          const r = await runDay(
            supabase, userId, data.planId, idx,
            briefP.data, bpP.data, guidelines, priorBlockSummary,
            priorPool,
            banned,
            false,
            pp,
            pklLandmarks,
          );
          if (r.ok) await upsertDayRow(supabase, userId, data.planId, 1, idx, "done", r.day);
        }
        const { data: rows2 } = await supabase
          .from("workout_plan_days")
          .select("content")
          .eq("plan_id", data.planId)
          .eq("week_number", 1);
        const finalDays = ((rows2 ?? []) as any[]).map((r) => r.content ?? {});
        const second = computeAccessoryRotationPct(finalDays, priorPool);
        rotationAudit.retried = true;
        rotationAudit.finalPct = second.pct;
        rotationAudit.daysRegenerated = targets;
      }

      // Stamp into generation_meta for transparency.
      const { data: cur } = await supabase
        .from("workout_plans")
        .select("generation_meta")
        .eq("id", data.planId)
        .maybeSingle();
      const meta = ((cur as any)?.generation_meta ?? {}) as Record<string, any>;
      meta.rotation_audit = rotationAudit;

      // Main-lift swap audit: compare current main lifts vs prior_main_lifts.
      // Honest reporting — only claim "swapped" if the model actually changed
      // at least one main-lift name (normalised) vs the prior block.
      const priorMain = ((meta as any)?.prior_main_lifts ?? []) as string[];
      if (swapMainLift && priorMain.length > 0) {
        const { data: rowsAll } = await supabase
          .from("workout_plan_days")
          .select("content")
          .eq("plan_id", data.planId)
          .eq("week_number", 1);
        const currentMain: string[] = [];
        for (const r of (rowsAll ?? []) as any[]) {
          const ex = Array.isArray(r?.content?.exercises) ? r.content.exercises : [];
          const name = String(ex[0]?.name ?? "").trim();
          if (name) currentMain.push(name);
        }
        const priorSet = new Set(priorMain.map(normalizeExerciseName));
        const swapped = currentMain.filter((n) => !priorSet.has(normalizeExerciseName(n)));
        meta.main_lift_audit = {
          requested: true,
          priorMain,
          currentMain,
          swappedCount: swapped.length,
          swappedNames: swapped,
          honored: swapped.length > 0,
        };
      }

      await supabase.from("workout_plans").update({ generation_meta: meta }).eq("id", data.planId);
    }

    return { ok: true as const, generated: okCount, errors: errCount, rotationAudit };
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