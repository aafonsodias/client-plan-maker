import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { callAnthropicWithSchema, resolveModel } from "../src/server/phased/ai.server.ts";

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
  FORGE_MODEL_STAGE_1: process.env.FORGE_MODEL_STAGE_1,
};
const testProviderUrl = "https://provider.example.test/v1/chat/completions";

function toolCallResponse(toolName: string, args: unknown, usage = { prompt_tokens: 10, completion_tokens: 5 }) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: "function",
                function: {
                  name: toolName,
                  arguments: JSON.stringify(args),
                },
              },
            ],
          },
        },
      ],
      usage,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function installFetch(responses: Array<Response | Error>) {
  const calls: CapturedFetch[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const response = responses.shift();
    calls.push({
      url: String(url),
      init: init ?? {},
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (response instanceof Error) throw response;
    if (!response) throw new Error("Unexpected fetch call");
    return response;
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

function configureAiProvider() {
  delete process.env.AI_PROVIDER;
  process.env.AI_OPENAI_COMPATIBLE_BASE_URL = "https://provider.example.test/v1";
  process.env.AI_OPENAI_COMPATIBLE_API_KEY = "test-key";
}

const schema = z.object({
  summary: z.string(),
  count: z.number(),
});

const baseOpts = {
  model: "claude-haiku-4-5-20251001",
  system: "System prompt",
  userMessage: "User request",
  toolName: "record_contract",
  toolDescription: "Record the contract payload.",
  toolJsonSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      count: { type: "number" },
    },
    required: ["summary", "count"],
  },
  schema,
  maxTokens: 777,
};

test("callAnthropicWithSchema sends the expected provider payload and parses tool-use data", async () => {
  configureAiProvider();
  const calls = installFetch([toolCallResponse("record_contract", { summary: "ok", count: 2 })]);

  try {
    const result = await callAnthropicWithSchema(baseOpts);

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok ? result.data : null, { summary: "ok", count: 2 });
    assert.equal(result.model, "google/gemini-3-flash-preview");
    assert.equal(result.inputTokens, 10);
    assert.equal(result.outputTokens, 5);
    assert.equal(result.retryCount, 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, testProviderUrl);
    assert.equal(calls[0].body.model, "google/gemini-3-flash-preview");
    assert.equal(calls[0].body.max_completion_tokens, 777);
    assert.deepEqual(calls[0].body.messages, [
      { role: "system", content: "System prompt" },
      { role: "user", content: "User request" },
    ]);
    assert.equal(calls[0].body.tools[0].function.name, "record_contract");
    assert.deepEqual(calls[0].body.tools[0].function.parameters, baseOpts.toolJsonSchema);
    assert.deepEqual(calls[0].body.tool_choice, {
      type: "function",
      function: { name: "record_contract" },
    });
    assert.ok(result.costUsd > 0);
  } finally {
    restoreFetchAndEnv();
  }
});

test("callAnthropicWithSchema retries once after schema failure and preserves accumulated usage", async () => {
  configureAiProvider();
  const calls = installFetch([
    toolCallResponse("record_contract", { summary: "missing count" }, { prompt_tokens: 3, completion_tokens: 4 }),
    toolCallResponse("record_contract", { summary: "fixed", count: 9 }, { prompt_tokens: 5, completion_tokens: 6 }),
  ]);

  try {
    const result = await callAnthropicWithSchema(baseOpts);

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok ? result.data : null, { summary: "fixed", count: 9 });
    assert.equal(result.inputTokens, 8);
    assert.equal(result.outputTokens, 10);
    assert.equal(result.retryCount, 1);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].body.messages[1].content.includes("Your previous attempt FAILED schema validation"), true);
    assert.equal(calls[1].body.messages[1].content.includes("count: Required"), true);
    assert.equal(calls[1].body.messages[1].content.includes("call record_contract again"), true);
  } finally {
    restoreFetchAndEnv();
  }
});

test("callAnthropicWithSchema surfaces upstream failure without retrying", async () => {
  configureAiProvider();
  const calls = installFetch([new Response("too many", { status: 429 })]);

  try {
    const result = await callAnthropicWithSchema(baseOpts);

    assert.equal(result.ok, false);
    assert.equal(result.error, "Demasiados pedidos AI por minuto. Aguarda alguns segundos e tenta de novo.");
    assert.equal(result.inputTokens, 0);
    assert.equal(result.outputTokens, 0);
    assert.equal(result.costUsd, 0);
    assert.equal(result.retryCount, 0);
    assert.equal(calls.length, 1);
  } finally {
    restoreFetchAndEnv();
  }
});

test("resolveModel normalizes legacy Anthropic fallbacks and environment overrides", () => {
  try {
    delete process.env.FORGE_MODEL_STAGE_1;
    assert.equal(
      resolveModel("FORGE_MODEL_STAGE_1", "claude-sonnet-4-5-20250929"),
      "openai/gpt-5",
    );

    process.env.FORGE_MODEL_STAGE_1 = "claude-haiku-4-5-20251001";
    assert.equal(resolveModel("FORGE_MODEL_STAGE_1", "openai/gpt-5-mini"), "google/gemini-3-flash-preview");
  } finally {
    restoreFetchAndEnv();
  }
});
