# AI Provider Adapter Boundary v1

## Current Status

Protocol AI runtime now uses the OpenAI-compatible provider path through `src/server/ai/provider-adapter.server.ts`.

The adapter boundary remains in place so callers keep a stable transport interface. The former Lovable Gateway provider implementation and `LOVABLE_API_KEY` runtime dependency have been removed from active code.

## Current Implementation

The adapter defines:

- `AiChatMessage`
- `AiChatCompletionRequest`
- `AiProvider`
- `AiProviderName`
- `openAiCompatibleProvider`
- `getSelectedAiProviderName()`
- `getDefaultAiProvider()`

`getSelectedAiProviderName()` returns `openai-compatible`. `getDefaultAiProvider()` returns `openAiCompatibleProvider`.

`AI_PROVIDER` may be unset or set to `openai-compatible`. Any other value is treated as invalid by `scripts/validate-env.mjs`; the adapter itself no longer branches to any alternate provider.

The OpenAI-compatible provider:

- reads `AI_OPENAI_COMPATIBLE_BASE_URL` server-side
- reads `AI_OPENAI_COMPATIBLE_API_KEY` server-side
- trims surrounding whitespace from both values
- posts to the configured URL when it already ends in `/chat/completions`
- otherwise posts to `${AI_OPENAI_COMPATIBLE_BASE_URL}/chat/completions`
- sends the caller-provided request body unchanged
- returns the raw `Response`
- does not remap model IDs
- returns `missing_configuration` without a network call when required config is absent
- never prints secret values

`AiChatCompletionRequest` supports the existing plain chat request shape, OpenAI-compatible `tools` / `tool_choice` fields, `max_tokens`, `max_completion_tokens`, `reasoning_effort`, and multimodal message content arrays needed by OCR image inputs. The adapter does not parse tool calls; callers still own response parsing.

## Provider Tests

`test/ai-provider-adapter.test.ts` covers provider selection and request forwarding with a mocked `fetch`. The tests verify:

- unset `AI_PROVIDER` uses the OpenAI-compatible provider
- unsupported `AI_PROVIDER` values do not select a separate provider path
- missing OpenAI-compatible configuration returns `missing_configuration` without a network call
- base URL normalization preserves `/chat/completions`
- API keys are sent as `Authorization: Bearer <AI_OPENAI_COMPATIBLE_API_KEY>`
- request fields are forwarded unchanged, including `model`, `messages`, `tools`, `tool_choice`, `max_tokens`, `max_completion_tokens`, and `reasoning_effort`

## Migrated Callers

All known runtime and non-runtime AI callers route through `getDefaultAiProvider().createChatCompletion(...)`:

- `src/server/atlas.functions.ts`
- `src/server/concierge.functions.ts`
- `src/server/sessions-ocr.functions.ts`
- `src/server/demo-judge.functions.ts`
- `src/server/intake-ai.functions.ts`
- `src/server/anthropic-compat.server.ts`
- `src/server/phased/ai.server.ts`
- `src/server/phased/stage2-blueprint.functions.ts`
- `scripts/r2.2-smoke2.ts`

Caller-owned behavior remains unchanged:

- prompt text
- model routing
- tool schemas
- forced or optional tool choice
- multimodal message content
- response parsing
- retry and repair behavior
- token aggregation
- cost calculation
- generation logging
- quota, billing, auth, and persistence behavior

## Phased AI Contract

`src/server/phased/ai.server.ts` still owns the high-risk phased generation contract:

- legacy model normalization
- exact OpenAI-compatible request body construction
- forced tool-call schema behavior
- one-attempt Zod repair retry
- response parsing and Zod validation
- token aggregation and cost calculation
- return telemetry consumed by generation logging callers

`test/phased-ai-contract.test.ts` covers this helper without real API calls.

## Smoke And Validation

Safe local commands:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run check:env
npm.cmd run smoke:ai-provider
```

`npm.cmd run smoke:ai-provider` is dry-run/config-only by default. It prints selected provider and required variable-name presence only. It never prints values and makes no network call unless `--live` is passed explicitly.

`node scripts/ai-provider-smoke.mjs --live` is reserved for a configured staging or operator-controlled environment.

## Current Runtime Requirements

Required for staging and production AI runtime:

- `AI_OPENAI_COMPATIBLE_BASE_URL`
- `AI_OPENAI_COMPATIBLE_API_KEY`

Optional:

- `AI_PROVIDER=openai-compatible`

No Lovable package, browser domain, build wrapper, auth wrapper, or AI Gateway key is required by the current runtime.

## Remaining Lovable References

Remaining Lovable references are historical or archival only:

- migration-history docs under `docs/protocol/architecture/**`
- the `.lovable/**` archive
- existing migration history that must not be rewritten

Do not reintroduce a Lovable provider path. If a future provider needs different model IDs, response mapping, or cost accounting, create an explicit provider compatibility PR rather than changing prompts or silently remapping models.
