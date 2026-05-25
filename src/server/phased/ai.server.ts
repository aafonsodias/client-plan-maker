import type { z } from "zod";
import { getDefaultAiProvider } from "@/server/ai/provider-adapter.server";
import { computeCallCostUsd, type AiModelId } from "../plan-cost.server";

// Map any legacy Anthropic fallback id → equivalent Lovable Gateway model.
// Keeps existing stage files compiling without per-file edits while we
// migrate to model-routing.server.ts.
const LEGACY_TO_GATEWAY: Record<string, string> = {
  "claude-haiku-4-5-20251001": "google/gemini-3-flash-preview",
  "claude-sonnet-4-5-20250929": "openai/gpt-5",
};

function normalizeModel(id: string): string {
  return LEGACY_TO_GATEWAY[id] ?? id;
}

/**
 * Resolve a model id from an env var with a safe default. Both env values
 * and fallbacks are normalized: legacy Anthropic ids are mapped to their
 * Lovable Gateway equivalents so stage files don't need to change.
 */
export function resolveModel(envVar: string, fallback: string): string {
  const v = process.env[envVar];
  return normalizeModel(v && v.trim().length > 0 ? v.trim() : fallback);
}

export type AiCallResult<T> = {
  ok: true;
  data: T;
  raw: unknown;
  model: AiModelId;
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
  model: AiModelId;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  retryCount: number;
};

/**
 * Call the Lovable AI Gateway with a tool-call schema and validate the
 * result with Zod. Retries ONCE on Zod failure, feeding the validation
 * error back to the model. Pure function — caller persists telemetry.
 *
 * Name kept as `callAnthropicWithSchema` for back-compat with existing
 * stage files. Under the hood now talks to Lovable Gateway (OpenAI-
 * compatible Chat Completions API).
 */
export async function callAnthropicWithSchema<T>(opts: {
  model: string;
  system: string;
  userMessage: string;
  toolName: string;
  toolDescription: string;
  toolJsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<AiCallResult<T> | AiCallFailure> {
  const aiProvider = getDefaultAiProvider();
  const model = normalizeModel(opts.model);

  if (!aiProvider.isConfigured()) {
    return {
      ok: false,
      error:
        "LOVABLE_API_KEY is not configured. Lovable Cloud must be enabled.",
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: 0,
      retryCount: 0,
    };
  }

  const tool = {
    type: "function" as const,
    function: {
      name: opts.toolName,
      description: opts.toolDescription,
      parameters: opts.toolJsonSchema,
    },
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
      const aiResult = await aiProvider.createChatCompletion({
        model,
        max_completion_tokens: opts.maxTokens ?? 1500,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: userContent },
        ],
        tools: [tool],
        tool_choice: {
          type: "function",
          function: { name: opts.toolName },
        },
      });
      if (!aiResult.ok) {
        return {
          ok: false,
          error:
            "LOVABLE_API_KEY is not configured. Lovable Cloud must be enabled.",
          model,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          costUsd: computeCallCostUsd(model, {
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
          }),
          durationMs: totalDurationMs,
          retryCount: attempt,
        };
      }
      resp = aiResult.response;
    } catch (e) {
      const dur = Date.now() - t0;
      totalDurationMs += dur;
      return {
        ok: false,
        error: `Network error calling Lovable AI Gateway: ${e instanceof Error ? e.message : String(e)}`,
        model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costUsd: computeCallCostUsd(model, {
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
      let friendly = `Lovable AI ${resp.status}: ${body.slice(0, 400)}`;
      if (resp.status === 402) {
        friendly =
          "Sem créditos AI. Adiciona em Settings → Workspace → Usage e tenta de novo.";
      } else if (resp.status === 429) {
        friendly =
          "Demasiados pedidos AI por minuto. Aguarda alguns segundos e tenta de novo.";
      }
      return {
        ok: false,
        error: friendly,
        model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costUsd: computeCallCostUsd(model, {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
        }),
        durationMs: totalDurationMs,
        retryCount: attempt,
      };
    }

    const json: any = await resp.json();
    totalInputTokens += Number(json?.usage?.prompt_tokens ?? json?.usage?.input_tokens ?? 0);
    totalOutputTokens += Number(json?.usage?.completion_tokens ?? json?.usage?.output_tokens ?? 0);

    const choice = json?.choices?.[0];
    const toolCalls = choice?.message?.tool_calls ?? [];
    const match = toolCalls.find(
      (tc: any) => tc?.type === "function" && tc?.function?.name === opts.toolName,
    );
    let parsedInput: unknown = null;
    if (match) {
      const argsRaw = match?.function?.arguments;
      try {
        parsedInput = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
      } catch (e) {
        lastZodError = `tool_call arguments not valid JSON: ${e instanceof Error ? e.message : String(e)}`;
        continue;
      }
    }
    lastRaw = parsedInput;

    if (!match || parsedInput == null) {
      lastZodError = "Model did not call the required tool.";
      continue;
    }

    const parsed = opts.schema.safeParse(parsedInput);
    if (parsed.success) {
      return {
        ok: true,
        data: parsed.data,
        raw: lastRaw,
        model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costUsd: computeCallCostUsd(model, {
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
    model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costUsd: computeCallCostUsd(model, {
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
