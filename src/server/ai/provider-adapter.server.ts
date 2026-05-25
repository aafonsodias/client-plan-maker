export type AiChatRole = "system" | "user" | "assistant";

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

export type AiChatCompletionRequest = {
  model: string;
  messages: AiChatMessage[];
  tools?: unknown[];
  tool_choice?: unknown;
};

export type AiProviderResult =
  | { ok: true; response: Response }
  | { ok: false; error: "missing_api_key" };

export type AiProvider = {
  createChatCompletion(request: AiChatCompletionRequest): Promise<AiProviderResult>;
};

const LOVABLE_GATEWAY_CHAT_COMPLETIONS_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

export const lovableGatewayProvider: AiProvider = {
  async createChatCompletion(request) {
    const apiKey = process.env.LOVABLE_API_KEY;
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
