import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultAiProvider,
  getSelectedAiProviderName,
} from "../src/server/ai/provider-adapter.server.ts";

type CapturedFetch = {
  url: string;
  init: RequestInit;
  body: any;
};

const originalFetch = globalThis.fetch;
const originalEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_OPENAI_COMPATIBLE_BASE_URL: process.env.AI_OPENAI_COMPATIBLE_BASE_URL,
  AI_OPENAI_COMPATIBLE_API_KEY: process.env.AI_OPENAI_COMPATIBLE_API_KEY,
  LOVABLE_API_KEY: process.env.LOVABLE_API_KEY,
};

const request = {
  model: "provider/model-id",
  max_tokens: 1500,
  max_completion_tokens: 16000,
  reasoning_effort: "low",
  messages: [
    { role: "system" as const, content: "System prompt" },
    { role: "user" as const, content: "User prompt" },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "record_result",
        parameters: { type: "object", properties: { ok: { type: "boolean" } } },
      },
    },
  ],
  tool_choice: { type: "function", function: { name: "record_result" } },
};

function installFetch() {
  const calls: CapturedFetch[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      init: init ?? {},
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

function restoreFetchAndEnv() {
  globalThis.fetch = originalFetch;

  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

test("default provider is Lovable when AI_PROVIDER is unset", async () => {
  const calls = installFetch();
  delete process.env.AI_PROVIDER;
  process.env.LOVABLE_API_KEY = "lovable-test-key";

  try {
    assert.equal(getSelectedAiProviderName(), "lovable");
    const result = await getDefaultAiProvider().createChatCompletion(request);

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://ai.gateway.lovable.dev/v1/chat/completions");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer lovable-test-key");
    assert.deepEqual(calls[0].body, request);
  } finally {
    restoreFetchAndEnv();
  }
});

test("AI_PROVIDER=lovable keeps Lovable Gateway behavior", async () => {
  const calls = installFetch();
  process.env.AI_PROVIDER = "lovable";
  process.env.LOVABLE_API_KEY = "lovable-test-key";

  try {
    assert.equal(getSelectedAiProviderName(), "lovable");
    const result = await getDefaultAiProvider().createChatCompletion(request);

    assert.equal(result.ok, true);
    assert.equal(calls[0].url, "https://ai.gateway.lovable.dev/v1/chat/completions");
    assert.deepEqual(calls[0].body, request);
  } finally {
    restoreFetchAndEnv();
  }
});

test("AI_PROVIDER=openai-compatible uses configured OpenAI-compatible endpoint", async () => {
  const calls = installFetch();
  process.env.AI_PROVIDER = "openai-compatible";
  process.env.AI_OPENAI_COMPATIBLE_BASE_URL = "https://provider.example.test/v1";
  process.env.AI_OPENAI_COMPATIBLE_API_KEY = "openai-compatible-test-key";
  delete process.env.LOVABLE_API_KEY;

  try {
    assert.equal(getSelectedAiProviderName(), "openai-compatible");
    const result = await getDefaultAiProvider().createChatCompletion(request);

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://provider.example.test/v1/chat/completions");
    assert.equal(
      (calls[0].init.headers as Record<string, string>).Authorization,
      "Bearer openai-compatible-test-key",
    );
    assert.deepEqual(calls[0].body, request);
  } finally {
    restoreFetchAndEnv();
  }
});

test("OpenAI-compatible provider reports missing configuration without a network call", async () => {
  const calls = installFetch();
  process.env.AI_PROVIDER = "openai-compatible";
  delete process.env.AI_OPENAI_COMPATIBLE_BASE_URL;
  process.env.AI_OPENAI_COMPATIBLE_API_KEY = "openai-compatible-test-key";

  try {
    const result = await getDefaultAiProvider().createChatCompletion(request);

    assert.deepEqual(result, { ok: false, error: "missing_configuration" });
    assert.equal(calls.length, 0);
  } finally {
    restoreFetchAndEnv();
  }
});
