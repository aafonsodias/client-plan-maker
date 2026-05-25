# AI Provider Adapter Boundary v1

## Why this exists

Protocol still depends on Lovable for AI calls through `LOVABLE_API_KEY` and `https://ai.gateway.lovable.dev/v1/chat/completions`. Replacing that dependency safely requires a provider-neutral boundary first, so future provider migration can happen behind a small interface instead of changing prompts, models, schemas, parsing, and UI behavior in the same PR.

This PR does not replace Lovable AI. It introduces the first adapter boundary and keeps Lovable Gateway as the only active implementation.

## Current implementation

The adapter lives at `src/server/ai/provider-adapter.server.ts`.

It defines:

- `AiChatMessage`
- `AiChatCompletionRequest`
- `AiProvider`
- `lovableGatewayProvider`
- `getDefaultAiProvider()`

The default provider still:

- reads `LOVABLE_API_KEY` server-side
- posts to `https://ai.gateway.lovable.dev/v1/chat/completions`
- sends the caller-provided request body unchanged
- returns the raw `Response` to preserve existing status handling and parsing
- never prints secret values

`AiChatCompletionRequest` supports the existing plain chat request shape, OpenAI-compatible `tools` / `tool_choice` fields, and multimodal message content arrays needed by OCR image inputs. The adapter does not parse tool calls yet; callers still own response parsing so behavior remains unchanged.

## Migrated callers

`src/server/atlas.functions.ts` routes `askAtlas` through `getDefaultAiProvider().createChatCompletion(...)`.

`askAtlas` was chosen first because it is a plain chat-completion caller:

- no tool-call schema
- no retry loop
- no generation log persistence
- no OCR/image payload
- no billing or quota logic changes
- existing model allow-list and default model behavior stay in place

The request payload remains `{ model, messages }`. Existing handling for missing AI configuration, 429, 402, generic gateway errors, empty replies, and JSON parsing is preserved at the caller.

`src/server/concierge.functions.ts` now routes `askConcierge` through the same adapter.

`askConcierge` is a tool-call based caller, but the migration stays low-risk because:

- it sends one OpenAI-compatible `tools` array
- it forces one `tool_choice`
- it has no retry loop
- it has no generation log persistence
- it has no billing or quota logic
- it parses the same raw gateway response at the caller
- existing model, prompt text, tool schema, error handling, and suggestion filtering stay in place

The request payload remains `{ model, messages, tools, tool_choice }`. The adapter only carries that payload to the current Lovable Gateway implementation.

`src/server/sessions-ocr.functions.ts` now routes `extractSessionFromImage` through the same adapter.

`extractSessionFromImage` was migrated in this PR because it is isolated from billing/quota/generation logs and the current gateway request can be preserved exactly:

- hardcoded model remains `google/gemini-2.5-pro`
- OCR prompt text remains unchanged
- image payload remains in the existing OpenAI-compatible content array
- `submit_log` tool schema and forced `tool_choice` remain unchanged
- status handling, tool-call parsing, normalization, and user-facing errors stay at the caller

`src/server/demo-judge.functions.ts` now routes `judgeDemoRun` through the same adapter.

`judgeDemoRun` was migrated because it is a single tool-call request with no retry loop and no provider-specific response wrapping:

- hardcoded model remains `google/gemini-3-flash-preview`
- prompt text and input JSON construction remain unchanged
- `submit_critique` tool schema and forced `tool_choice` remain unchanged
- cached critique behavior, schema validation, persistence, and error handling stay at the caller

`src/server/intake-ai.functions.ts` now routes `interpretGoal` through the same adapter.

`interpretGoal` was migrated because it uses the same OpenAI-compatible tool-call shape as other low-risk callers:

- hardcoded model remains `google/gemini-3-flash-preview`
- locale-specific prompt text remains unchanged
- `interpret` tool schema and forced `tool_choice` remain unchanged
- token validation, response parsing, assessment persistence, and user-facing errors stay at the caller
- no billing, quota, or generation log behavior is introduced or changed

`src/server/anthropic-compat.server.ts` now routes its Lovable Gateway transport through the same adapter.

The compatibility shim still owns the Anthropic-shaped API surface:

- callers still invoke `anthropicCompatFetch(body)`
- Anthropic model IDs are still mapped inside the shim
- Anthropic `tools[].input_schema` is still converted to OpenAI-compatible `tools`
- the raw OpenAI-compatible response is still converted back to `{ content: [{ type: "tool_use", ... }], usage }`
- existing missing-key, network error, upstream status, JSON parsing, and tool-call handling remain in the shim

The adapter capability added for this path is `max_completion_tokens` pass-through on `AiChatCompletionRequest`.

`src/server/phased/ai.server.ts` now routes `callAnthropicWithSchema` transport through the same adapter.

The phased helper still owns the high-risk contract:

- legacy model normalization
- exact OpenAI-compatible request body construction
- forced tool-call schema behavior
- one-attempt Zod repair retry
- response parsing and Zod validation
- token aggregation and cost calculation
- return telemetry consumed by generation logging callers

The adapter only owns the Lovable Gateway transport and raw `Response` return. Lovable Gateway remains the only active implementation.

`src/server/phased/stage2-blueprint.functions.ts` now routes the `discussBlueprint` transport through the same adapter.

The Stage 2 discussion caller still owns:

- brief, current blueprint, and conversation prompt construction
- optional `propose_blueprint_patch` tool schema
- intentional absence of `tool_choice`
- text-or-tool-call response handling
- patch argument parsing and validation
- token, cost, duration, and `stage2:blueprint:chat` generation logging

The adapter capability added for this path is `max_tokens` pass-through on `AiChatCompletionRequest`, preserving the existing request body field.

`scripts/r2.2-smoke2.ts` now routes its non-runtime smoke transport through the same adapter.

The smoke script still owns:

- Sofia smoke data construction
- FITT-VP DB derivation through service-role Supabase
- Stage 3 prompt construction
- forced `record_day` tool schema and parsing
- one FITT-VP retry
- local smoke cost estimate
- `.lovable/r2.2-smoke-report.md` append behavior

The adapter capability added for this path is `reasoning_effort` pass-through on `AiChatCompletionRequest`, preserving the existing request body field.

## Remaining Lovable AI call sites

No known runtime or non-runtime AI caller now calls Lovable Gateway directly outside `src/server/ai/provider-adapter.server.ts`.

`docs/protocol/architecture/final-lovable-ai-paths-audit-v1.md` now maps these final direct paths, their migration risk, and the recommended exit order.

Related model/cost routing surfaces remain unchanged:

- `src/lib/ai-models.ts`
- `src/server/phased/model-routing.server.ts`
- `src/server/plan-cost.server.ts`

## Remaining high-risk AI paths

| Path | Risk level | Why it is high-risk | Recommended handling |
|---|---:|---|---|
| `scripts/r2.2-smoke2.ts` | Medium | Non-runtime smoke script with script-specific model, cost, service-role DB, and report-writing assumptions. | Now adapter-routed; decide separately whether to keep, archive, or delete this historical smoke. |

## Phased AI contract coverage status

`src/server/phased/ai.server.ts` now routes `callAnthropicWithSchema` transport through the provider adapter.

`docs/protocol/architecture/phased-ai-generation-contract-v1.md` documents the current contract and `test/phased-ai-contract.test.ts` covers the highest-risk helper behavior without real API calls:

- gateway request body shape
- legacy model normalization
- successful tool-call parsing
- one-attempt schema repair retry
- accumulated token and cost metadata
- upstream rate-limit failure behavior

This coverage protects the adapter-routed phased helper before any future active provider replacement.

## Before replacing Lovable Gateway

Before changing the active provider implementation, these must be true:

- Target AI provider and model IDs are chosen.
- Equivalent request and response behavior is mapped for plain chat, tool calls, image inputs, and Anthropic-compatible tool envelopes.
- Error semantics are defined for missing key, 402, 429, network failure, malformed JSON, missing tool calls, and empty replies.
- Cost tracking semantics are updated or intentionally preserved.
- Staging has provider secrets configured without exposing values.
- Existing prompts, schemas, and model routing are covered by build/test plus manual AI smoke checks.

## Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Provider response shape drift | Existing callers parse OpenAI-compatible response fields directly. | Keep returning raw `Response` until each caller has a typed parser behind the adapter. |
| Tool-call callers are more complex than chat callers | Several features require function/tool responses and schema validation. | Migrate those one at a time with dedicated tests or smoke checks. |
| Model ID mismatch | Current model names are Lovable Gateway model IDs. | Preserve model routing until the provider decision is made. |
| Cost display mismatch | `plan-cost.server.ts` estimates current gateway costs. | Update cost mapping only when provider routing changes. |
| Hidden runtime secret gaps | New provider secrets will need owned deployment configuration. | Use env validation and staging checks before changing the default provider. |

## Validation checklist

- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run check:env`
- Confirm `askAtlas` still sends the same model and messages payload shape.
- Confirm `askConcierge` still sends the same model, messages, tools, and tool_choice payload shape.
- Confirm `extractSessionFromImage` still sends the same model, messages with image content, tools, and tool_choice payload shape.
- Confirm `judgeDemoRun` still sends the same model, messages, tools, and tool_choice payload shape.
- Confirm `interpretGoal` still sends the same model, locale-specific messages, tools, and tool_choice payload shape.
- Confirm `anthropicCompatFetch` still preserves its Anthropic-shaped request and response envelopes while sending the same OpenAI-compatible gateway payload.
- Confirm `discussBlueprint` still sends the same model, messages, tools, and no tool_choice payload shape.
- Confirm `scripts/r2.2-smoke2.ts` still sends the same model, max_completion_tokens, reasoning_effort, messages, tools, and tool_choice payload shape when run manually.
- Confirm no prompt text, model allow-list, error copy, billing behavior, or auth behavior changed.
- In staging, manually verify Atlas, Concierge, OCR extraction, demo critique, intake goal interpretation, Anthropic compatibility callers, and Stage 2 blueprint discussion after provider secrets are available.

## Next safe migration PRs

1. Decide whether `scripts/r2.2-smoke2.ts` should remain as a historical smoke, be archived, or be deleted after replacement-provider validation exists.
2. Replace the active adapter implementation only after all runtime surfaces have staging coverage against the chosen provider.
3. Remove `LOVABLE_API_KEY` only after the active adapter implementation no longer needs Lovable Gateway.
