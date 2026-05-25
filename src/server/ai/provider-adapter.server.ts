export type AiChatRole = "system" | "user" | "assistant";

export type AiChatContent = string | unknown[];

export type AiChatMessage = {
  role: AiChatRole;
  content: AiChatContent;
};

export type AiChatCompletionRequest = {
  model: string;
  max_completion_tokens?: number;
  messages: AiChatMessage[];
  tools?: unknown[];
  tool_choice?: unknown;
};

export type AiProviderResult =
  | { ok: true; response: Response }
  | { ok: false; error: "missing_api_key" };

export type AiProvider = {
  isConfigured(): boolean;
  createChatCompletion(request: AiChatCompletionRequest): Promise<AiProviderResult>;
};

const LOVABLE_GATEWAY_CHAT_COMPLETIONS_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

function getLovableGatewayApiKey(): string | null {
  const apiKey = process.env.LOVABLE_API_KEY;
  return typeof apiKey === "string" && apiKey.trim().length > 0 ? apiKey : null;
}

export const lovableGatewayProvider: AiProvider = {
  isConfigured() {
    return getLovableGatewayApiKey() !== null;
  },

  async createChatCompletion(request) {
    const apiKey = getLovableGatewayApiKey();
    if (!apiKey) return { ok: false, error: "missing_api_key" };

    const response = await fetch(LOVABLE_GATEWAY_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    return { ok: true, response };
  },
};

export function getDefaultAiProvider(): AiProvider {
  return lovableGatewayProvider;
}
