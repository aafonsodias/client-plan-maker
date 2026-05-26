# AI Provider Staging Validation Runbook v1

## Executive Summary

Lovable remains the default AI provider until staging proves replacement compatibility. The intended replacement path is `AI_PROVIDER=openai-compatible`, backed by an OpenAI-compatible chat completions provider.

Provider compatibility must be proven across every Protocol AI surface before Lovable runtime removal. This runbook prepares the staging validation only; it does not switch production, remove Lovable, change model IDs, or change caller behavior.

## Suggested Provider Profile

OpenRouter is the first candidate provider profile for staging validation.

Configure these environment variable names in staging only:

```text
AI_PROVIDER=openai-compatible
AI_OPENAI_COMPATIBLE_BASE_URL
AI_OPENAI_COMPATIBLE_API_KEY
```

Suggested base URL value:

```text
https://openrouter.ai/api/v1/chat/completions
```

Do not hardcode this value in source code. Configure it through staging environment settings, and do not paste API keys in chat, docs, logs, screenshots, or issue comments.

## Current AI Surface Validation Matrix

| Surface | Request type | Model source | Fields used | Manual test | Expected success signal | Expected failure signal | Rollback action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Atlas | Plain chat completion | User-selected model or `MODEL_OPTIONS` fallback | `model`, `messages` | Open the Atlas surface in staging and send a simple non-client prompt | Assistant response renders without parse or provider errors | Provider rejects model, request fails, or UI shows AI error | Unset `AI_PROVIDER` or set `AI_PROVIDER=lovable`; keep `LOVABLE_API_KEY` available |
| Concierge | Tool-call chat completion | `google/gemini-3-flash-preview` | `model`, `messages`, `tools`, forced `tool_choice` | Run a normal Concierge recommendation flow | Structured tool result is parsed and displayed | Missing tool call, invalid tool JSON, provider rejection, or graceful app error | Roll back provider env and retest with Lovable |
| Sessions OCR | Multimodal tool-call completion | `google/gemini-2.5-pro` | `model`, multimodal `messages` content arrays, `tools`, forced `tool_choice` | Upload a representative session image in staging | OCR fields parse into the expected structured result | Image content rejected, no tool call, malformed tool arguments, or app error | Roll back provider env and record multimodal incompatibility |
| Demo judge | Tool-call chat completion | `google/gemini-3-flash-preview` | `model`, `messages`, `tools`, forced `tool_choice` | Run the demo judge path with known sample input | Judgement result parses and downstream UI remains unchanged | Provider rejects tool forcing or returns non-parseable output | Roll back provider env and record tool-call incompatibility |
| Intake AI | Public intake tool-call completion | `google/gemini-3-flash-preview` | `model`, `messages`, `tools`, forced `tool_choice` | Complete a staging public intake link using non-production data | Intake AI output is generated and saved through the existing flow | Auth/intake flow works but AI generation fails or returns invalid tool data | Roll back provider env; do not change intake token logic |
| Anthropic compatibility path | Adapter-backed Anthropic-shaped tool-call response | Compatibility wrapper maps Anthropic model IDs to provider-prefixed model IDs | `model`, `max_completion_tokens`, `messages`, `tools`, forced `tool_choice` | Exercise an existing caller that uses `anthropicCompatibleMessagesCreate` | Caller receives the same Anthropic-shaped response contract | Provider response cannot be transformed or lacks expected tool content | Roll back provider env; create a separate compatibility fix PR if needed |
| Phased generation / `callAnthropicWithSchema` | Schema-constrained tool-call generation | `STAGE_MODEL_IDS` and `FORGE_MODEL_*` overrides | `model`, `max_completion_tokens`, `messages`, `tools`, forced `tool_choice` | Run a full phased plan generation after lower-risk surfaces pass | Stage output validates, retry behavior remains unchanged, token/cost logging records normally | Schema parse fails repeatedly, provider rejects model/tools, or cost logging diverges | Roll back provider env; do not adjust prompts or schemas in staging |
| Stage 2 blueprint discussion | Chat completion with optional tools | Stage model routing config | `model`, `max_tokens`, `messages`, optional `tools` | Exercise Stage 2 blueprint discussion in staging | Text or tool response parses through existing logic and logs generation metadata | Unexpected response shape, missing content, or provider rejection | Roll back provider env and isolate response-shape issue in a separate PR |
| R2.2 smoke script | Scripted schema/tool smoke | Script defaults and `FORGE_MODEL_*` where applicable | `model`, `max_completion_tokens`, `reasoning_effort`, `messages`, `tools`, forced `tool_choice` | Run the existing R2.2 smoke script only after app surfaces pass | Smoke report completes without provider or schema errors | `.lovable/r2.2-smoke-report.md` records provider/model/schema failure | Roll back provider env; keep `.lovable` history until scripts are moved separately |

## Model Compatibility Checklist

Current provider-visible model IDs in the repo:

- `google/gemini-3-flash-preview`
- `google/gemini-2.5-pro`
- `openai/gpt-5-mini`
- `openai/gpt-5`

Legacy Anthropic IDs still appear in compatibility boundaries and pricing docs, including:

- `claude-haiku-4-5-20251001`
- `claude-sonnet-4-5-20250929`

The Anthropic compatibility path maps those legacy IDs before sending provider requests. Compatibility for all provider-visible model IDs is unproven until staging tests pass.

Do not remap model IDs silently. If the replacement provider rejects any current model ID, stop validation and create a separate model mapping PR with explicit tests, docs, and rollout notes.

## Staging Switch Procedure

1. Deploy current `main` to staging.
2. Configure environment variables only in staging.
3. Set `AI_PROVIDER=openai-compatible`.
4. Set `AI_OPENAI_COMPATIBLE_BASE_URL`.
5. Set `AI_OPENAI_COMPATIBLE_API_KEY`.
6. Keep `LOVABLE_API_KEY` available for rollback.
7. Run `npm.cmd run check:env` in the staging-like environment.
8. Run `npm.cmd run smoke:ai-provider` to confirm dry-run config visibility without a network call.
9. Optionally run `node scripts/ai-provider-smoke.mjs --live` only in staging after the provider key is configured.
10. Test surfaces from lowest risk to highest risk: Atlas, Concierge, Demo judge, Intake AI, Sessions OCR, Stage 2 blueprint discussion, Anthropic compatibility path, then phased generation.
11. Run phased generation last.
12. Roll back by unsetting `AI_PROVIDER` or setting `AI_PROVIDER=lovable`.

## Do Not Do

- Do not switch production before staging passes.
- Do not paste keys in chat, docs, logs, screenshots, or issue comments.
- Do not delete the Lovable provider before validation.
- Do not change prompts to make a provider pass.
- Do not silently remap models.
- Do not test phased generation first.
