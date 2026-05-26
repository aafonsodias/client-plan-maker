# AI Provider Staging Validation Runbook v1

## Status

This runbook records the staging validation gate that allowed Protocol to remove Lovable as an active AI provider.

Validation result:

- `AI_PROVIDER=openai-compatible` path exists in current main.
- Dry-run smoke validation passed.
- Live smoke validation returned HTTP 200 with `result ok`.
- The final provider removal pass can use OpenAI-compatible as the only active provider path.

The runbook remains as migration evidence. It is not a rollback instruction for the current runtime.

## Current Provider Profile

The current replacement path uses OpenAI-compatible chat completions.

Environment variable names:

```text
AI_PROVIDER=openai-compatible
AI_OPENAI_COMPATIBLE_BASE_URL
AI_OPENAI_COMPATIBLE_API_KEY
```

`AI_PROVIDER` may also be unset because the adapter now selects OpenAI-compatible by default. Any other value is invalid in env validation.

OpenRouter was the first candidate provider profile validated by smoke. Do not hardcode provider URLs in source code; configure them through environment settings.

## Current AI Surface Validation Matrix

| Surface | Request type | Model source | Fields used | Validation signal |
| --- | --- | --- | --- | --- |
| Atlas | Plain chat completion | User-selected model or `MODEL_OPTIONS` fallback | `model`, `messages` | Assistant response renders without parse or provider errors. |
| Concierge | Tool-call chat completion | `google/gemini-3-flash-preview` | `model`, `messages`, `tools`, forced `tool_choice` | Structured tool result parses and displays. |
| Sessions OCR | Multimodal tool-call completion | `google/gemini-2.5-pro` | `model`, multimodal `messages` content arrays, `tools`, forced `tool_choice` | OCR fields parse into the expected structured result. |
| Demo judge | Tool-call chat completion | `google/gemini-3-flash-preview` | `model`, `messages`, `tools`, forced `tool_choice` | Judgement result parses and downstream UI remains unchanged. |
| Intake AI | Public intake tool-call completion | `google/gemini-3-flash-preview` | `model`, `messages`, `tools`, forced `tool_choice` | Intake AI output is generated and saved through the existing flow. |
| Anthropic compatibility path | Adapter-backed Anthropic-shaped tool-call response | Compatibility wrapper maps Anthropic model IDs to provider-prefixed model IDs | `model`, `max_completion_tokens`, `messages`, `tools`, forced `tool_choice` | Caller receives the same Anthropic-shaped response contract. |
| Phased generation / `callAnthropicWithSchema` | Schema-constrained tool-call generation | `STAGE_MODEL_IDS` and `FORGE_MODEL_*` overrides | `model`, `max_completion_tokens`, `messages`, `tools`, forced `tool_choice` | Stage output validates, retry behavior remains unchanged, token/cost logging records normally. |
| Stage 2 blueprint discussion | Chat completion with optional tools | Stage model routing config | `model`, `max_tokens`, `messages`, optional `tools` | Text or tool response parses through existing logic and logs generation metadata. |
| R2.2 smoke script | Scripted schema/tool smoke | Script defaults and `FORGE_MODEL_*` where applicable | `model`, `max_completion_tokens`, `reasoning_effort`, `messages`, `tools`, forced `tool_choice` | Smoke report completes without provider or schema errors. |

## Model Compatibility Checklist

Current provider-visible model IDs in the repo:

- `google/gemini-3-flash-preview`
- `google/gemini-2.5-pro`
- `openai/gpt-5-mini`
- `openai/gpt-5`

Legacy Anthropic IDs still appear in compatibility boundaries and pricing docs, including:

- `claude-haiku-4-5-20251001`
- `claude-sonnet-4-5-20250929`

The Anthropic compatibility path maps those legacy IDs before sending provider requests.

Do not remap model IDs silently. If a provider rejects any current model ID, stop and create a separate model mapping PR with explicit tests, docs, and rollout notes.

## Safe Smoke Commands

Dry-run only:

```powershell
npm.cmd run smoke:ai-provider
```

Live smoke, only in an operator-controlled environment with provider config already set:

```powershell
node scripts/ai-provider-smoke.mjs --live
```

The smoke script never prints secret values.

## Do Not Do

- Do not paste keys in chat, docs, logs, screenshots, or issue comments.
- Do not change prompts to make a provider pass.
- Do not silently remap models.
- Do not test phased generation before lower-risk surfaces when validating a new provider profile.
