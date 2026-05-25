# Phased AI Generation Contract v1

## Purpose

This document captures the current contract for the phased AI generation helper before moving its transport behind the provider adapter.

The current implementation still calls Lovable Gateway directly from `src/server/phased/ai.server.ts`. This document and the focused test coverage protect behavior before any transport migration.

## Current helper

`callAnthropicWithSchema` is exported from `src/server/phased/ai.server.ts`.

Despite its historical name, it now calls the Lovable AI Gateway OpenAI-compatible chat completions endpoint. Stage files keep the older function name for compatibility.

## Inputs

The helper receives:

- `model`: model id or legacy Anthropic id.
- `system`: system prompt.
- `userMessage`: user prompt.
- `toolName`: required tool/function name.
- `toolDescription`: tool/function description.
- `toolJsonSchema`: JSON schema passed to the gateway tool definition.
- `schema`: Zod schema used to validate the tool arguments returned by the model.
- `maxTokens`: optional token limit, sent as `max_completion_tokens`.

## Gateway request contract

The helper currently sends:

- `model`: normalized model id.
- `max_completion_tokens`: `opts.maxTokens ?? 1500`.
- `messages`: exactly one system message and one user message.
- `tools`: one OpenAI-compatible function tool built from `toolName`, `toolDescription`, and `toolJsonSchema`.
- `tool_choice`: forced to the required function name.

Legacy model ids are normalized:

- `claude-haiku-4-5-20251001` -> `google/gemini-3-flash-preview`
- `claude-sonnet-4-5-20250929` -> `openai/gpt-5`

## Response contract

On success, the helper returns:

- `ok: true`
- parsed and Zod-validated `data`
- raw parsed tool input in `raw`
- normalized `model`
- accumulated `inputTokens`
- accumulated `outputTokens`
- computed `costUsd`
- accumulated `durationMs`
- `retryCount`

Token usage accepts both OpenAI-compatible and alternate names:

- input: `usage.prompt_tokens` or `usage.input_tokens`
- output: `usage.completion_tokens` or `usage.output_tokens`

## Retry and repair contract

The helper attempts at most two gateway calls.

The first attempt sends the original `userMessage`.

If the model does not call the required tool, returns malformed tool arguments, or returns arguments that fail Zod validation, the helper retries once. The retry appends a schema-failure repair instruction to the user message and asks the model to call the same tool again.

If the retry still fails schema validation, the helper returns:

- `ok: false`
- `error: "Schema validation failed after retry."`
- `zodError` containing the last validation or parsing failure summary
- accumulated token, cost, duration, and retry metadata

## Failure contract

Missing `LOVABLE_API_KEY` returns `ok: false` with zero token, cost, duration, and retry metadata.

Network failure returns `ok: false` with a network error message, accumulated duration, and no real response parsing.

Non-OK gateway responses return `ok: false` immediately without schema retry. Status handling currently preserves special user-facing messages for:

- `402`: AI credits exhausted.
- `429`: rate limited.

Other statuses include the Lovable status and a truncated response body.

## Logging and cost contract

`callAnthropicWithSchema` does not write to `generation_log` directly. It returns telemetry fields that callers pass to `logGeneration`.

`logGeneration` is separately exported from `src/server/phased/ai.server.ts` and must remain non-fatal. Insert failures are logged and swallowed so telemetry cannot break the user-facing generation flow.

Cost is computed with `computeCallCostUsd(model, usage)` from `src/server/plan-cost.server.ts`.

## Callers

Known runtime callers include:

- `src/server/phased/pre-stage.functions.ts`
- `src/server/phased/stage1-brief.functions.ts`
- `src/server/phased/stage2-blueprint.functions.ts`
- `src/server/phased/stage3-microcycle.functions.ts`

Related phased files use `logGeneration` without calling `callAnthropicWithSchema` directly.

## Why this path is high-risk

Phased generation is higher risk than Atlas, Concierge, OCR, Demo Judge, Intake, and the Anthropic compatibility shim because it combines:

- forced tool calls
- Zod schema validation
- one-attempt repair behavior
- user-facing gateway error mapping
- token aggregation
- cost calculation
- generation logging by callers
- downstream fallback behavior in stage files
- model normalization for legacy ids

Changing the transport without preserving these contracts could alter plan generation, quota-adjacent reporting, cost displays, and debugging telemetry.

## Coverage added

`test/phased-ai-contract.test.ts` covers:

- successful tool-call parsing and gateway request shape
- one retry after schema validation failure
- accumulated token and cost metadata across retry
- upstream rate-limit failure behavior
- legacy model normalization

The tests stub `globalThis.fetch`, set a fake local `LOVABLE_API_KEY`, and do not call real APIs or require secrets.

## Before transport migration

Before routing `callAnthropicWithSchema` through `src/server/ai/provider-adapter.server.ts`, the next PR must preserve:

- exact gateway request body fields
- exact forced tool-call behavior
- exact retry and repair message behavior
- exact token aggregation and cost calculation
- exact non-OK status behavior
- exact missing-key behavior
- exact return shape consumed by stage callers
- no changes to `logGeneration`

## Recommended next PR

Route only the Lovable Gateway transport inside `callAnthropicWithSchema` through the provider adapter. Do not change stage prompts, schemas, model routing, retry behavior, logging, cost calculation, or fallback behavior in that PR.
