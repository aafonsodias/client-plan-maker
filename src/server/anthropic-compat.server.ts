/**
 * anthropic-compat.server.ts
 *
 * Drop-in replacement for direct Anthropic /v1/messages calls. Speaks the
 * Anthropic request/response shape callers expect, but under the hood routes
 * to the Lovable AI Gateway (OpenAI-compatible Chat Completions).
 *
 * Why this exists:
 * - The legacy plan generator (src/server/plan.functions.ts) and its
 *   critic/repair helpers were written against api.anthropic.com directly.
 * - In production we only have LOVABLE_API_KEY; ANTHROPIC_API_KEY is gone,
 *   which is why "Regenerate with feedback" was returning 401.
 * - Rewriting all six call sites to OpenAI shape is risky; this shim keeps
 *   them on the same surface (`tools[].input_schema`, response.content[]
 *   `tool_use` blocks) while migrating the transport.
 *
 * Model mapping: Anthropic ids → equivalent Lovable Gateway models.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5-20251001": "google/gemini-3-flash-preview",
  "claude-sonnet-4-5-20250929": "openai/gpt-5",
};

function mapModel(id: string): string {
  return MODEL_MAP[id] ?? id;
}

type AnthropicTool = {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
};

type AnthropicRequest = {
  model: string;
  max_tokens?: number;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tools?: AnthropicTool[];
  tool_choice?: { type: "tool"; name: string };
};

/**
 * Minimal Anthropic-shaped Response. Returns:
 *   - ok / status (so existing `if (!res.ok)` branches work)
 *   - .json() resolving to { content: [{ type: "tool_use", input: {...} }], usage: {...} }
 *   - .text() for error logging
 */
export async function anthropicCompatFetch(body: AnthropicRequest): Promise<Response> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, {
      error: "LOVABLE_API_KEY is not configured. Lovable Cloud must be enabled.",
    });
  }

  const tool = body.tools?.[0];
  if (!tool) {
    return jsonResponse(400, { error: "anthropic-compat requires exactly one tool." });
  }

  const upstreamBody = {
    model: mapModel(body.model),
    max_completion_tokens: body.max_tokens ?? 4000,
    messages: [
      ...(body.system ? [{ role: "system", content: body.system }] : []),
      ...body.messages,
    ],
    tools: [
      {
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description ?? "",
          parameters: tool.input_schema,
        },
      },
    ],
    tool_choice: {
      type: "function" as const,
      function: { name: tool.name },
    },
  };

  let upstream: Response;
  try {
    upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamBody),
    });
  } catch (e) {
    return jsonResponse(502, {
      error: `Network error calling Lovable AI Gateway: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    // Preserve status so existing 429/402 branches at call sites keep working.
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const json: any = await upstream.json().catch(() => ({}));
  const choice = json?.choices?.[0];
  const toolCalls = choice?.message?.tool_calls ?? [];
  const match = toolCalls.find(
    (tc: any) => tc?.type === "function" && tc?.function?.name === tool.name,
  );

  let parsedInput: unknown = null;
  if (match) {
    const argsRaw = match?.function?.arguments;
    try {
      parsedInput = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    } catch {
      parsedInput = null;
    }
  }

  // Anthropic-shaped envelope so callers' existing parsing logic still works.
  const anthropicShaped = {
    content: parsedInput
      ? [{ type: "tool_use", name: tool.name, input: parsedInput }]
      : [],
    usage: {
      input_tokens: Number(
        json?.usage?.prompt_tokens ?? json?.usage?.input_tokens ?? 0,
      ),
      output_tokens: Number(
        json?.usage?.completion_tokens ?? json?.usage?.output_tokens ?? 0,
      ),
    },
  };

  return new Response(JSON.stringify(anthropicShaped), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}