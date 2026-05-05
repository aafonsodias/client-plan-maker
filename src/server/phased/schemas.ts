import { z } from "zod";

// ============================================================================
// Phased plan generation — Zod schemas (one per stage).
// Kept narrow on purpose: each schema validates exactly the contract that
// stage owns, nothing more. Downstream stages re-validate their own input.
// ============================================================================

// ---- Pre-Stage 0 — section micro-analysis ----------------------------------
// Each section returns a small partial contribution to the eventual brief.
// All fields optional so any section can contribute zero-or-more keys.
export const SectionAnalysisSchema = z.object({
  red_flags: z.array(z.string()).optional(),
  contraindication_notes: z.string().optional(),
  primary_goal: z
    .enum(["hypertrophy", "strength", "conditioning", "mixed", "fat_loss", "general"])
    .optional(),
  secondary_goals: z.array(z.string()).optional(),
  training_age_band: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  sessions_per_week: z
    .object({
      recommended: z.number().int().min(1).max(7),
      min: z.number().int().min(1).max(7),
      max: z.number().int().min(1).max(7),
    })
    .optional(),
  equipment_constraints: z.array(z.string()).optional(),
  movement_competency_summary: z
    .object({
      squat: z.string().optional(),
      hinge: z.string().optional(),
      push: z.string().optional(),
      pull: z.string().optional(),
      carry: z.string().optional(),
      lunge: z.string().optional(),
    })
    .optional(),
  recovery_profile: z.string().optional(),
  notes_for_next_stage: z.string().optional(),
});
export type SectionAnalysis = z.infer<typeof SectionAnalysisSchema>;

// ---- Stage 1 — Training brief ---------------------------------------------
export const BriefSchema = z.object({
  primary_goal: z.enum([
    "hypertrophy",
    "strength",
    "conditioning",
    "mixed",
    "fat_loss",
    "general",
  ]),
  secondary_goals: z.array(z.string()).default([]),
  red_flags: z.array(z.string()).default([]),
  movement_competency_summary: z.object({
    squat: z.string().default(""),
    hinge: z.string().default(""),
    push: z.string().default(""),
    pull: z.string().default(""),
    carry: z.string().default(""),
    lunge: z.string().default(""),
  }),
  training_age_band: z.enum(["beginner", "intermediate", "advanced"]),
  sessions_per_week: z.object({
    recommended: z.number().int().min(1).max(7),
    min: z.number().int().min(1).max(7),
    max: z.number().int().min(1).max(7),
  }),
  mesocycle_length_weeks: z.number().int().min(2).max(12),
  emphasis_split: z.object({
    upper: z.number().min(0).max(1),
    lower: z.number().min(0).max(1),
    conditioning: z.number().min(0).max(1),
  }),
  equipment_constraints: z.array(z.string()).default([]),
  notes_for_next_stage: z.string().default(""),
  current_capacity_vs_pb: z
    .number()
    .int()
    .min(1)
    .max(10)
    .nullable()
    .default(null),
  // Coach-tunable progression aggression. Drives the RPE ramp + load deltas
  // in Stage 4. Defaults to "padrao" (standard) so existing plans behave the
  // same; "agressivo" pushes harder, "conservador" backs off.
  intensity_appetite: z
    .enum(["conservador", "padrao", "agressivo"])
    .default("padrao"),
});
export type Brief = z.infer<typeof BriefSchema>;

// ---- Stage 1.5 — Coach programming variables ------------------------------
// Coach-controlled knobs captured alongside the brief. Drives Stage 2.
export const TrainingSplitEnum = z.enum([
  "full_body",
  "upper_lower",
  "ppl",
  "pplc",
  "ppl_x2",
  "body_part_split",
  "custom",
]);

export const DeloadFrequencyEnum = z.enum([
  "every_3_weeks",
  "every_4_weeks",
  "every_5_weeks",
  "every_6_weeks",
  "no_deload",
]);

export const DeloadStyleEnum = z.enum([
  "volume_reduction",
  "intensity_reduction",
  "full_rest_week",
  "mixed",
]);

export const ExerciseBiasEnum = z.enum([
  "compound_first",
  "balanced",
  "isolation_friendly",
  "bodyweight_friendly",
  "equipment_flexible",
]);

export const IntensityVolumeTradeoffEnum = z.enum([
  "high_int_low_vol",
  "moderate_moderate",
  "moderate_int_high_vol",
  "low_int_very_high_vol",
]);

// R64 — Wave/periodisation model (Bompa & Buzzichelli 6e §7.3-7.5).
// Conjugate is reserved for a future round (max-effort/dynamic-effort split
// requires Stage 3 day tagging).
export const WaveModelEnum = z.enum(["linear", "undulating", "block", "conjugate"]);

// R64 — How hard the auto-regulator should react when realised RPE drifts
// above prescribed (programNextWeek) — strict cuts load, suggested flags
// the day, off ignores and follows wave nominal.
export const AutoregStrictnessEnum = z.enum(["strict", "suggested", "off"]);

// R64 — Cockpit preset. "custom" = coach moved knobs by hand.
export const CockpitPresetEnum = z.enum([
  "custom",
  "hypertrophy_classic",
  "strength_base",
  "moderate_recomp",
  "high_volume",
  "conservative",
]);

export const ProgrammingVariablesSchema = z.object({
  training_split: TrainingSplitEnum,
  deload_frequency: DeloadFrequencyEnum,
  deload_style: DeloadStyleEnum,
  rpe_ceiling: z.number().min(7.5).max(10),
  exercise_bias: ExerciseBiasEnum,
  intensity_volume_tradeoff: IntensityVolumeTradeoffEnum,
  // R64 Intensity Cockpit knobs — all optional with sane fallbacks so legacy
  // plans continue to behave the same when these fields are absent.
  wave_model: WaveModelEnum.default("undulating"),
  autoreg_strictness: AutoregStrictnessEnum.default("suggested"),
  cockpit_preset: CockpitPresetEnum.default("custom"),
});
export type ProgrammingVariables = z.infer<typeof ProgrammingVariablesSchema>;

// ---- Stage 1.5 — Red flag accommodations ----------------------------------
export const FlagStrategyEnum = z.enum(["AVOID", "MODIFY", "MONITOR", "ACCOMMODATE"]);

export const RedFlagAccommodationSchema = z.object({
  flag: z.string().min(1),
  strategy: FlagStrategyEnum,
  detail: z.string().default(""),
});
export const RedFlagAccommodationsSchema = z.array(RedFlagAccommodationSchema);
export type RedFlagAccommodation = z.infer<typeof RedFlagAccommodationSchema>;

// ---- Stage 2 — Mesocycle blueprint ----------------------------------------
export const SessionArchetypeSchema = z.object({
  id: z.string().min(1),
  focus: z.string().min(1),
  primary_movements: z.array(z.string()).default([]),
});

export const BlueprintSchema = z.object({
  mesocycle_length_weeks: z.number().int().min(2).max(12),
  sessions_per_week: z.number().int().min(1).max(7),
  session_archetypes: z.array(SessionArchetypeSchema).min(1),
  // week_to_session_map[weekIdx][dayIdx] = archetype id
  week_to_session_map: z.record(z.string(), z.array(z.string())),
  progression_model_proposal: z.object({
    model: z.enum(["linear", "undulating", "block"]),
    rationale: z.string().default(""),
  }),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;

// ---- Stage 4 — Progression deltas -----------------------------------------
export const ProgressionRowSchema = z.object({
  exercise_id: z.string().min(1),
  dimension: z.enum([
    "load",
    "reps",
    "sets",
    "intensity_rpe",
    "tempo",
    "complexity_variant",
  ]),
  week_2_delta: z.string().default(""),
  week_3_delta: z.string().default(""),
  week_4_delta: z.string().default(""),
  rationale: z.string().default(""),
});

export const ProgressionPlanSchema = z.object({
  rows: z.array(ProgressionRowSchema).default([]),
});
export type ProgressionPlan = z.infer<typeof ProgressionPlanSchema>;

// ---- Stage 3 — Single-day workout content ----------------------------------
// Mirrors the existing FORGE day shape so workout_plan_days.content is
// byte-compatible with the legacy single-shot generator.
const SectionItemZ = z.object({
  name: z.string(),
  duration: z.string(),
  notes: z.string(),
});

const ExerciseZ = z.object({
  name: z.string().min(1),
  sets: z.string(),
  reps: z.string(),
  rest: z.string(),
  notes: z.string(),
  primary_muscles: z.array(z.string()),
  secondary_muscles: z.array(z.string()),
  rpe: z.string(),
  tempo: z.string(),
  technique_cues: z.string(),
  cue: z.string(),
  rationale: z.string(),
  superset_id: z.string().nullable(),
  variant: z.string().nullable(),
  optional: z.boolean(),
  equipment: z.array(z.string()),
});

export const PhasedDaySchema = z.object({
  day_label: z.string(),
  focus: z.string(),
  rationale: z.string(),
  warmup: z.array(SectionItemZ).default([]),
  activation: z.array(SectionItemZ).default([]),
  dynamic_stretches: z.array(SectionItemZ).default([]),
  cooldown: z.array(SectionItemZ).default([]),
  finisher: z.array(SectionItemZ).default([]),
  finisher_enabled: z.boolean().default(false),
  cardio: z.array(SectionItemZ).default([]),
  exercises: z.array(ExerciseZ).min(1),
});
export type PhasedDay = z.output<typeof PhasedDaySchema>;

// ---- Generation state stored on workout_plans.generation_state -------------
export const GenerationStageSchema = z.enum([
  "brief",
  "blueprint",
  "microcycle",
  "progressions",
  "complete",
]);
export type GenerationStage = z.infer<typeof GenerationStageSchema>;

export const GenerationStateSchema = z.object({
  stage: GenerationStageSchema.default("brief"),
  approved_stages: z.array(GenerationStageSchema).default([]),
  last_updated_at: z.string().optional(),
});
export type GenerationState = z.infer<typeof GenerationStateSchema>;

// Stages that become invalid when an upstream stage is edited.
export const DOWNSTREAM_OF: Record<GenerationStage, GenerationStage[]> = {
  brief: ["blueprint", "microcycle", "progressions", "complete"],
  blueprint: ["microcycle", "progressions", "complete"],
  microcycle: ["progressions", "complete"],
  progressions: ["complete"],
  complete: [],
};

export class PhasedValidationError extends Error {
  constructor(
    public stage: string,
    public zodError: string,
    public retryCount: number
  ) {
    super(`Phased validation failed at ${stage} after ${retryCount} retries: ${zodError}`);
    this.name = "PhasedValidationError";
  }
}