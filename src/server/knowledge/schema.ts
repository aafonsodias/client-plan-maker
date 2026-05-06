import { z } from "zod";
import { MUSCLE_GROUP_ORDER, VOLUME_LANDMARKS, type MuscleGroup } from "@/lib/volume-landmarks";

/**
 * Programmable Knowledge Layer — V1 schema.
 *
 * Stored on `knowledge_profiles.rules`. Every editable field is a structured,
 * range-bounded value: no free text influences engine logic directly.
 */

const LandmarkRow = z
  .object({
    mev: z.number().min(0).max(30),
    mav: z.number().min(0).max(40),
    mrv: z.number().min(0).max(50),
  })
  .refine((v) => v.mev <= v.mav && v.mav <= v.mrv, {
    message: "mev <= mav <= mrv",
  });

const muscleEnum = z.enum(MUSCLE_GROUP_ORDER as [MuscleGroup, ...MuscleGroup[]]);

export const KnowledgeRulesV1 = z.object({
  schema_version: z.literal(1).default(1),
  volume: z
    .object({
      landmarks: z.record(muscleEnum, LandmarkRow).default({}),
    })
    .default({ landmarks: {} }),
  intensity: z
    .object({
      rpe_ceiling_by_tier: z
        .object({
          advanced: z.number().min(7).max(10),
          conservative: z.number().min(7).max(10),
          remedial: z.number().min(6).max(9),
        })
        .default({ advanced: 9.5, conservative: 9, remedial: 7.5 }),
      intensity_volume_tradeoff_default: z
        .enum([
          "high_int_low_vol",
          "moderate_moderate",
          "moderate_int_high_vol",
          "low_int_very_high_vol",
        ])
        .default("moderate_moderate"),
    })
    .default({
      rpe_ceiling_by_tier: { advanced: 9.5, conservative: 9, remedial: 7.5 },
      intensity_volume_tradeoff_default: "moderate_moderate",
    }),
  recovery: z
    .object({
      deload_frequency: z
        .enum([
          "every_3_weeks",
          "every_4_weeks",
          "every_5_weeks",
          "every_6_weeks",
          "no_deload",
        ])
        .default("every_4_weeks"),
      deload_style: z
        .enum(["volume_reduction", "intensity_reduction", "full_rest_week", "mixed"])
        .default("volume_reduction"),
    })
    .default({ deload_frequency: "every_4_weeks", deload_style: "volume_reduction" }),
  progression: z
    .object({
      increments_kg_by_category: z
        .object({
          lower_compound: z.number().min(0.5).max(10),
          upper_compound: z.number().min(0.25).max(5),
          lower_isolation: z.number().min(0.25).max(5),
          upper_isolation: z.number().min(0.25).max(2.5),
        })
        .default({
          lower_compound: 5,
          upper_compound: 2.5,
          lower_isolation: 2.5,
          upper_isolation: 1.25,
        }),
      autoreg_strictness_default: z
        .enum(["strict", "suggested", "off"])
        .default("suggested"),
      wave_model_default: z
        .enum(["linear", "undulating", "block", "conjugate"])
        .default("undulating"),
    })
    .default({
      increments_kg_by_category: {
        lower_compound: 5,
        upper_compound: 2.5,
        lower_isolation: 2.5,
        upper_isolation: 1.25,
      },
      autoreg_strictness_default: "suggested",
      wave_model_default: "undulating",
    }),
});
export type KnowledgeRules = z.infer<typeof KnowledgeRulesV1>;

/** System baseline. Used as fallback when a trainer has no profile yet. */
export const SYSTEM_DEFAULT_RULES: KnowledgeRules = KnowledgeRulesV1.parse({});

/** Deep-merge user rules onto the system baseline (system fills any gap). */
export function mergeWithDefaults(partial: unknown): KnowledgeRules {
  const parsed = KnowledgeRulesV1.safeParse(partial ?? {});
  if (!parsed.success) return SYSTEM_DEFAULT_RULES;
  return parsed.data;
}

/** Resolve effective volume landmarks (user override merged onto VOLUME_LANDMARKS). */
export function resolveLandmarks(rules: KnowledgeRules) {
  const out: Record<MuscleGroup, { mev: number; mav: number; mrv: number }> = {
    ...VOLUME_LANDMARKS,
  };
  for (const [k, v] of Object.entries(rules.volume.landmarks)) {
    if (v) out[k as MuscleGroup] = v;
  }
  return out;
}