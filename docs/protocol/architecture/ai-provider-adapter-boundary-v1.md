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

`AiChatCompletionRequest` supports the existing plain chat request shape and the OpenAI-compatible `tools` / `tool_choice` fields needed by Concierge. The adapter does not parse tool calls yet; callers still own response parsing so behavior remains unchanged.

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

## Remaining Lovable AI call sites

These still call Lovable Gateway directly or through existing Lovable-specific compatibility helpers:

- `src/server/intake-ai.functions.ts`
- `src/server/sessions-ocr.functions.ts`
- `src/server/demo-judge.functions.ts`
- `src/server/anthropic-compat.server.ts`
- `src/server/phased/ai.server.ts`
- `src/server/phased/stage2-blueprint.functions.ts`
- `scripts/r2.2-smoke2.ts`

Related model/cost routing surfaces remain unchanged:

- `src/lib/ai-models.ts`
- `src/server/phased/model-routing.server.ts`
- `src/server/plan-cost.server.ts`

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
- Confirm no prompt text, model allow-list, error copy, billing behavior, or auth behavior changed.
- In staging, manually verify Atlas and Concierge response behavior after provider secrets are available.

## Next safe migration PRs

1. Add adapter support for image/chat payloads, then migrate `extractSessionFromImage`.
2. Move `anthropic-compat.server.ts` transport through the adapter while preserving its Anthropic-shaped response envelope.
3. Migrate `interpretGoal` or `judgeDemoRun` after adding focused validation for their tool-call schemas.
