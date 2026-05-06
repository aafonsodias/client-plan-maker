/**
 * R73 Step 4A — Pure inference helpers.
 *
 * Each helper looks at the inputs that already exist in the brief / assessment /
 * PKL and returns the value that the engine *would* default to anyway, plus a
 * rationale envelope so the UI can explain "why this?" without changing engine
 * behaviour.
 *
 * IMPORTANT — these helpers are display-only. They never write to schemas,
 * never call the engine, and never override an explicit user choice. If a
 * caller passes in a stored value, helpers return it as `confidence: "manual"`.
 */

import type {
  Brief,
  ProgrammingVariables,
} from "@/server/phased/schemas";
import type { KnowledgeRules } from "@/server/knowledge/schema";
import type { CockpitPreset } from "@/components/plan/CockpitPresets";

export type Confidence = "confident" | "assumed" | "manual";
export type InferenceSource =
  | "assessment"
  | "pkl"
  | "cockpit"
  | "default"
  | "user";

export interface Inference<T> {
  value: T;
  confidence: Confidence;
  source: InferenceSource;
  /** i18n key under common.json `ux.rationale.reasons.*`. */
  reason_key: string;
  /** Interpolated values for the i18n string. */
  reason_params?: Record<string, string | number>;
}

/* ---------------------------------------------------------------- inferTier */

export type ProgrammingTier = "advanced" | "conservative" | "remedial";

export function inferTier(input: {
  red_flags?: string[];
  training_age_band?: "beginner" | "intermediate" | "advanced";
  manual?: ProgrammingTier | null;
}): Inference<ProgrammingTier> {
  if (input.manual) {
    return {
      value: input.manual,
      confidence: "manual",
      source: "user",
      reason_key: "tier_manual",
    };
  }
  const flags = input.red_flags?.length ?? 0;
  if (flags >= 2) {
    return {
      value: "remedial",
      confidence: "confident",
      source: "assessment",
      reason_key: "tier_remedial_flags",
      reason_params: { count: flags },
    };
  }
  if (flags === 1 || input.training_age_band === "beginner") {
    return {
      value: "conservative",
      confidence: "assumed",
      source: "assessment",
      reason_key: "tier_conservative",
    };
  }
  if (input.training_age_band === "advanced") {
    return {
      value: "advanced",
      confidence: "confident",
      source: "assessment",
      reason_key: "tier_advanced_age",
    };
  }
  return {
    value: "advanced",
    confidence: "assumed",
    source: "default",
    reason_key: "tier_default",
  };
}

/* ------------------------------------------------------ inferCockpitPreset */

export function inferCockpitPreset(input: {
  primary_goal?: Brief["primary_goal"];
  current?: CockpitPreset;
}): Inference<CockpitPreset> {
  if (input.current && input.current !== "custom") {
    return {
      value: input.current,
      confidence: "manual",
      source: "cockpit",
      reason_key: "preset_manual",
    };
  }
  if (input.current === "custom") {
    return {
      value: "custom",
      confidence: "manual",
      source: "cockpit",
      reason_key: "preset_custom",
    };
  }
  switch (input.primary_goal) {
    case "strength":
      return {
        value: "strength_base",
        confidence: "confident",
        source: "assessment",
        reason_key: "preset_from_goal",
        reason_params: { goal: "strength" },
      };
    case "hypertrophy":
      return {
        value: "hypertrophy_classic",
        confidence: "confident",
        source: "assessment",
        reason_key: "preset_from_goal",
        reason_params: { goal: "hypertrophy" },
      };
    case "fat_loss":
    case "conditioning":
      return {
        value: "high_volume",
        confidence: "assumed",
        source: "assessment",
        reason_key: "preset_from_goal",
        reason_params: { goal: String(input.primary_goal) },
      };
    default:
      return {
        value: "moderate_recomp",
        confidence: "assumed",
        source: "default",
        reason_key: "preset_default",
      };
  }
}

/* --------------------------------------------------------------- inferSplit */

export type TrainingSplit =
  | "full_body"
  | "upper_lower"
  | "ppl"
  | "pplc"
  | "ppl_x2"
  | "body_part_split"
  | "custom";

export function inferSplit(input: {
  sessions_per_week?: number;
  manual?: TrainingSplit | null;
}): Inference<TrainingSplit> {
  if (input.manual) {
    return {
      value: input.manual,
      confidence: "manual",
      source: "user",
      reason_key: "split_manual",
    };
  }
  const n = input.sessions_per_week ?? 0;
  if (n <= 3) {
    return {
      value: "full_body",
      confidence: "confident",
      source: "assessment",
      reason_key: "split_from_sessions",
      reason_params: { n },
    };
  }
  if (n === 4) {
    return {
      value: "upper_lower",
      confidence: "confident",
      source: "assessment",
      reason_key: "split_from_sessions",
      reason_params: { n },
    };
  }
  if (n === 5) {
    return {
      value: "ppl",
      confidence: "assumed",
      source: "assessment",
      reason_key: "split_from_sessions",
      reason_params: { n },
    };
  }
  return {
    value: "ppl_x2",
    confidence: "assumed",
    source: "assessment",
    reason_key: "split_from_sessions",
    reason_params: { n },
  };
}

/* ----------------------------------------------------------- inferWaveModel */

export type WaveModel = ProgrammingVariables["wave_model"];

export function inferWaveModel(input: {
  primary_goal?: Brief["primary_goal"];
  pkl?: KnowledgeRules | null;
  current?: WaveModel | null;
}): Inference<WaveModel> {
  if (input.current) {
    return {
      value: input.current,
      confidence: "manual",
      source: "cockpit",
      reason_key: "wave_manual",
    };
  }
  const pklVal = input.pkl?.progression?.wave_model_default;
  if (pklVal) {
    return {
      value: pklVal,
      confidence: "confident",
      source: "pkl",
      reason_key: "wave_from_pkl",
    };
  }
  if (input.primary_goal === "strength") {
    return {
      value: "linear",
      confidence: "assumed",
      source: "assessment",
      reason_key: "wave_from_goal",
      reason_params: { goal: "strength" },
    };
  }
  return {
    value: "undulating",
    confidence: "assumed",
    source: "default",
    reason_key: "wave_default",
  };
}

/* --------------------------------------------------------- inferDeloadFreq */

export type DeloadFreq = ProgrammingVariables["deload_frequency"];

export function inferDeloadFreq(input: {
  tier?: ProgrammingTier;
  pkl?: KnowledgeRules | null;
  current?: DeloadFreq | null;
}): Inference<DeloadFreq> {
  if (input.current) {
    return {
      value: input.current,
      confidence: "manual",
      source: "cockpit",
      reason_key: "deload_manual",
    };
  }
  const pklVal = input.pkl?.recovery?.deload_frequency;
  if (pklVal) {
    return {
      value: pklVal,
      confidence: "confident",
      source: "pkl",
      reason_key: "deload_from_pkl",
    };
  }
  if (input.tier === "remedial") {
    return {
      value: "every_3_weeks",
      confidence: "assumed",
      source: "assessment",
      reason_key: "deload_from_tier",
      reason_params: { tier: "remedial" },
    };
  }
  return {
    value: "every_4_weeks",
    confidence: "assumed",
    source: "default",
    reason_key: "deload_default",
  };
}

/* ----------------------------------------------- inferLogbookModeFromDayFocus */

export type LogbookMode =
  | "strength"
  | "hypertrophy"
  | "cardio"
  | "intervals"
  | "mobility"
  | "skill"
  | "mixed";

export function inferLogbookModeFromDayFocus(
  focus: string | null | undefined
): Inference<LogbookMode> {
  const f = (focus ?? "").toLowerCase();
  if (!f) {
    return {
      value: "mixed",
      confidence: "assumed",
      source: "default",
      reason_key: "logbook_mode_default",
    };
  }
  const map: Array<[RegExp, LogbookMode]> = [
    [/strength|força|forca|max|1rm|heavy/, "strength"],
    [/hyper|hipertr|volume|pump/, "hypertrophy"],
    [/interval|hiit|sprint|tabata/, "intervals"],
    [/cardio|run|corrida|bike|row|aerob|condition/, "cardio"],
    [/mobil|stretch|flex/, "mobility"],
    [/skill|tech|técnic|tecnic/, "skill"],
  ];
  for (const [rx, mode] of map) {
    if (rx.test(f)) {
      return {
        value: mode,
        confidence: "confident",
        source: "assessment",
        reason_key: "logbook_mode_from_focus",
        reason_params: { focus: f },
      };
    }
  }
  return {
    value: "mixed",
    confidence: "assumed",
    source: "default",
    reason_key: "logbook_mode_default",
  };
}
