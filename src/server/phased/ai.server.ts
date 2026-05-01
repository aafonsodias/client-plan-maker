import type { z } from "zod";
import { computeCallCostUsd, type AnthropicModelId } from "../plan-cost.server";

// Resolve a model id from an env var with a safe default.
export function resolveModel(envVar: string, fallback: AnthropicModelId): AnthropicModelId {
  const v = process.env[envVar];
  if (!v) return fallback;
  // Only allow the two models we price.
  if (v === "claude-haiku-4-5-20251001" || v === "claude-sonnet-4-5-20250929") {
    return v as AnthropicModelId;
  }
  return fallback;
}

export type AiCallResult<T> = {
  ok: true;
  data: T;
  raw: unknown;
  model: AnthropicModelId;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  retryCount: number;
};

export type AiCallFailure = {
  ok: false;
  error: string;
  zodError?: string;
  model: AnthropicModelId;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  retryCount: number;
};

/**
 * Call Anthropic with a tool-call schema and validate the result with Zod.
 * Retries ONCE on Zod failure, feeding the validation error back to the model.
 * Pure function — no DB writes; the caller is responsible for persisting telemetry.
 */
export async function callAnthropicWithSchema<T>(opts: {
  model: AnthropicModelId;
  system: string;
  userMessage: string;
  toolName: string;
  toolDescription: string;
  toolJsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<AiCallResult<T> | AiCallFailure> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY is not configured.",
      model: opts.model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: 0,
      retryCount: 0,
    };
  }

  const tool = {
    name: opts.toolName,
    description: opts.toolDescription,
    input_schema: opts.toolJsonSchema,
  };

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalDurationMs = 0;
  let lastRaw: unknown = null;
  let lastZodError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const userContent =
      attempt === 0
        ? opts.userMessage
        : `${opts.userMessage}\n\nYour previous attempt FAILED schema validation:\n${lastZodError}\n\nFix the issues and call ${opts.toolName} again with valid input.`;

    const t0 = Date.now();
    let resp: Response;
    try {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: opts.maxTokens ?? 1500,
          system: opts.system,
          tools: [tool],
          tool_choice: { type: "tool", name: opts.toolName },
          messages: [{ role: "user", content: userContent }],
        }),
      });
    } catch (e) {
      const dur = Date.now() - t0;
      totalDurationMs += dur;
      return {
        ok: false,
        error: `Network error calling Anthropic: ${e instanceof Error ? e.message : String(e)}`,
        model: opts.model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costUsd: computeCallCostUsd(opts.model, {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
        }),
        durationMs: totalDurationMs,
        retryCount: attempt,
      };
    }
    const dur = Date.now() - t0;
    totalDurationMs += dur;

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return {
        ok: false,
        error: `Anthropic ${resp.status}: ${body.slice(0, 500)}`,
        model: opts.model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costUsd: computeCallCostUsd(opts.model, {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
        }),
        durationMs: totalDurationMs,
        retryCount: attempt,
      };
    }

    const json: any = await resp.json();
    totalInputTokens += Number(json?.usage?.input_tokens ?? 0);
    totalOutputTokens += Number(json?.usage?.output_tokens ?? 0);
    const toolUse = (json?.content ?? []).find((b: any) => b?.type === "tool_use" && b?.name === opts.toolName);
    lastRaw = toolUse?.input ?? null;

    if (!toolUse) {
      lastZodError = "Model did not call the required tool.";
      continue;
    }

    const parsed = opts.schema.safeParse(toolUse.input);
    if (parsed.success) {
      return {
        ok: true,
        data: parsed.data,
        raw: lastRaw,
        model: opts.model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costUsd: computeCallCostUsd(opts.model, {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
        }),
        durationMs: totalDurationMs,
        retryCount: attempt,
      };
    }
    lastZodError = parsed.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
  }

  return {
    ok: false,
    error: "Schema validation failed after retry.",
    zodError: lastZodError,
    model: opts.model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costUsd: computeCallCostUsd(opts.model, {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    }),
    durationMs: totalDurationMs,
    retryCount: 1,
  };
}

// Persist a single generation_log row using the trainer's authenticated client.
// The row is RLS-scoped to the trainer.
export async function logGeneration(
  supabase: any,
  row: {
    trainer_id: string;
    plan_id?: string | null;
    assessment_id?: string | null;
    stage: string;
    model_used: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    zod_passed: boolean;
    retry_count: number;
    duration_ms: number;
    error?: string | null;
    input_snapshot?: unknown;
    output_snapshot?: unknown;
  }
): Promise<void> {
  try {
    await supabase.from("generation_log").insert(row);
  } catch (e) {
    // Telemetry must never break the user-facing flow.
    console.error("[generation_log] insert failed:", e);
  }
}