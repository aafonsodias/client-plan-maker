// Single source of truth for which configured AI provider model each pipeline
// stage uses. Tune here to trade cost vs intelligence — never hardcode model
// ids in stage files.
//
// Principle: technique > brute force. Deep model only where multi-constraint
// reasoning genuinely pays (Stage 3 microcycle generation). Fast model
// everywhere else.

export type StageKey =
  | "preStage"
  | "stage1"
  | "stage2"
  | "stage3"
  | "stage4"
  | "discuss";

const FAST = "google/gemini-3-flash-preview";
const MID = "openai/gpt-5-mini";
const DEEP = "openai/gpt-5";

const DEFAULTS: Record<StageKey, string> = {
  preStage: FAST,
  stage1: FAST,
  stage2: MID,
  stage3: DEEP,
  stage4: MID,
  discuss: FAST,
};

const ENV_MAP: Record<StageKey, string> = {
  preStage: "FORGE_MODEL_PRE_STAGE",
  stage1: "FORGE_MODEL_STAGE_1",
  stage2: "FORGE_MODEL_STAGE_2",
  stage3: "FORGE_MODEL_STAGE_3",
  stage4: "FORGE_MODEL_STAGE_4",
  discuss: "FORGE_MODEL_DISCUSS",
};

/**
 * Returns the model id for a given stage. Allows env-var override per stage
 * (e.g. set FORGE_MODEL_STAGE_3=openai/gpt-5-mini to downgrade). Falls back
 * to the default when the env var is unset.
 */
export function modelForStage(stage: StageKey): string {
  const v = process.env[ENV_MAP[stage]];
  if (v && typeof v === "string" && v.trim().length > 0) return v.trim();
  return DEFAULTS[stage];
}

export const STAGE_MODELS = {
  FAST,
  MID,
  DEEP,
} as const;
