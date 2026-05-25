/**
 * Allow-listed AI model ids the coach can pick when invoking AI features.
 * Credits are advisory display values that mirror relative cost/latency tiers.
 */
export type AiModelTier = "fast" | "balanced" | "deep";

export type AiModel = {
  id: string;
  label: string;
  description: string;
  credits: number;
  tier: AiModelTier;
};

export const AI_MODELS: AiModel[] = [
  {
    id: "google/gemini-3-flash-preview",
    label: "Flash",
    description: "Rápido. Ideal para sugestões e ajustes rápidos.",
    credits: 1,
    tier: "fast",
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 mini",
    description: "Equilibrado entre custo e qualidade.",
    credits: 3,
    tier: "balanced",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini Pro",
    description: "Raciocínio profundo, contexto longo.",
    credits: 4,
    tier: "balanced",
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    description: "Máxima precisão para casos complexos.",
    credits: 8,
    tier: "deep",
  },
];

export const DEFAULT_MODEL_ID = "google/gemini-3-flash-preview";

export const ALLOWED_MODEL_IDS = AI_MODELS.map((m) => m.id);

export function isAllowedModel(id: string | null | undefined): id is string {
  return !!id && ALLOWED_MODEL_IDS.includes(id);
}

export function findModel(id: string | null | undefined): AiModel {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0];
}
