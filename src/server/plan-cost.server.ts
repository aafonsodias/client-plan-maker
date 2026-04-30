// Cost tracking helpers (server-only).
// Prices in USD per 1M tokens (Anthropic pricing as of 2025-10).
// https://www.anthropic.com/pricing

export type AnthropicModelId =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-5-20250929";

const PRICING: Record<AnthropicModelId, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-5-20250929": { in: 3.0, out: 15.0 },
};

export function computeCallCostUsd(
  model: AnthropicModelId,
  usage: { input_tokens?: number; output_tokens?: number } | null | undefined
): number {
  if (!usage) return 0;
  const p = PRICING[model];
  if (!p) return 0;
  const inT = Number(usage.input_tokens ?? 0);
  const outT = Number(usage.output_tokens ?? 0);
  return (inT / 1_000_000) * p.in + (outT / 1_000_000) * p.out;
}

export type CallTelemetry = {
  model: AnthropicModelId;
  pass: "generate" | "critic-1" | "repair" | "critic-2" | "escalate-generate" | "escalate-critic";
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number;
  ok: boolean;
  error?: string;
};

export function makeTelemetry(
  model: AnthropicModelId,
  pass: CallTelemetry["pass"],
  usage: { input_tokens?: number; output_tokens?: number } | null | undefined,
  duration_ms: number,
  ok: boolean,
  error?: string
): CallTelemetry {
  return {
    model,
    pass,
    input_tokens: Number(usage?.input_tokens ?? 0),
    output_tokens: Number(usage?.output_tokens ?? 0),
    cost_usd: computeCallCostUsd(model, usage),
    duration_ms,
    ok,
    error,
  };
}