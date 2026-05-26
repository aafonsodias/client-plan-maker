export type AiChatRole = "system" | "user" | "assistant";

export type AiChatContent = string | unknown[];

export type AiChatMessage = {
  role: AiChatRole;
  content: AiChatContent;
};

export type AiChatCompletionRequest = {
  model: string;
  max_tokens?: number;
  max_completion_tokens?: number;
  reasoning_effort?: string;
  messages: AiChatMessage[];
  tools?: unknown[];
  tool_choice?: unknown;
};

export type AiProviderResult =
  | { ok: true; response: Response }
  | { ok: false; error: "missing_configuration" };

export type AiProvider = {
  isConfigured(): boolean;
  createChatCompletion(request: AiChatCompletionRequest): Promise<AiProviderResult>;
};

export type AiProviderName = "openai-compatible";

function getOpenAiCompatibleConfig(): { url: string; apiKey: string } | null {
  const baseUrl = process.env.AI_OPENAI_COMPATIBLE_BASE_URL;
  const apiKey = process.env.AI_OPENAI_COMPATIBLE_API_KEY;

  if (
    typeof baseUrl !== "string" ||
    baseUrl.trim().length === 0 ||
    typeof apiKey !== "string" ||
    apiKey.trim().length === 0
  ) {
    return null;
  }

  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  const url = trimmedBaseUrl.endsWith("/chat/completions")
    ? trimmedBaseUrl
    : `${trimmedBaseUrl}/chat/completions`;

  return { url, apiKey: apiKey.trim() };
}

export const openAiCompatibleProvider: AiProvider = {
  isConfigured() {
    return getOpenAiCompatibleConfig() !== null;
  },

  async createChatCompletion(request) {
    const config = getOpenAiCompatibleConfig();
    if (!config) return { ok: false, error: "missing_configuration" };

    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    return { ok: true, response };
  },
};

export function getSelectedAiProviderName(): AiProviderName {
  return "openai-compatible";
}

export function getDefaultAiProvider(): AiProvider {
  return openAiCompatibleProvider;
}
