# Final Lovable AI Paths Audit v1

## A. Executive Summary

All known runtime and non-runtime AI surfaces now reach Lovable Gateway through `src/server/ai/provider-adapter.server.ts`.

`scripts/r2.2-smoke2.ts` is now adapter-routed but remains a non-runtime smoke script that writes a historical `.lovable` report.

`src/server/phased/stage2-blueprint.functions.ts` now routes the runtime Stage 2 blueprint discussion transport through the provider adapter while preserving its plain-text or optional `propose_blueprint_patch` behavior.

The remaining decision is whether the R2.2 smoke script is still an active workflow. It can now be kept behind the adapter, archived, or deleted later if the `.lovable` report is historical only.

Recommended order:

1. Decide whether `scripts/r2.2-smoke2.ts` remains useful; keep it only if it still provides value after runtime phased generation is provider-neutral.
2. Replace the active adapter implementation only after all runtime callers have provider-neutral staging coverage.
3. Remove `LOVABLE_API_KEY` only after the active adapter implementation no longer needs Lovable Gateway.

## B. Path Inventory

| Path | Runtime or script | Current purpose | Request shape | Prompt/schema/parsing behavior | Logging/billing/quota coupling | Migration risk | Recommended next action | Validation required |
|---|---|---|---|---|---|---|---|---|
| `src/server/phased/stage2-blueprint.functions.ts` (`discussBlueprint`) | Runtime | Lets an authenticated trainer discuss the current Stage 2 blueprint and optionally receive a partial patch proposal. | Adapter-routed OpenAI-compatible chat completion with `model`, `max_tokens: 1500`, two messages, one `tools` entry, and no `tool_choice`. | System prompt and user content are built from brief, current blueprint, and conversation. Parser accepts plain text and optionally parses `propose_blueprint_patch` tool arguments with Zod. | Calls `logGeneration` with stage `stage2:blueprint:chat`, token usage, cost, duration, reply, and patch. No quota logic found in this path. | Medium for future provider replacement | Add fixtures before replacing the active adapter provider. | Unit or fixture coverage for text-only response, tool-call patch response, non-OK response, missing key behavior, token/cost logging fields, and no DB write except existing generation log. |
| `scripts/r2.2-smoke2.ts` | Script | End-to-end Sofia smoke that calls the adapter for a single Stage 3 day, validates FITT-VP, retries once on violations, and appends a `.lovable/r2.2-smoke-report.md` section. | Adapter-routed OpenAI-compatible chat completion with `model`, `max_completion_tokens: 16000`, `reasoning_effort: "low"`, two messages, one `tools` entry, and forced `tool_choice`. | Uses an inline Stage 3 prompt, inline `DAY_TOOL_SCHEMA`, parses required `record_day` tool call, validates with `PhasedDaySchema`, and retries once by changing the system prompt when FITT-VP violations exist. | Uses service-role Supabase to load ACSM thresholds, local pricing table for report cost, console logs, and `.lovable` report writing. No production billing/quota path. | Medium operational risk | Decide whether to keep, archive, or delete after replacement-provider validation. | If retained, run only in an explicit smoke environment with service-role credentials and fake-safe output review. Validate that no report writes leak secrets. |

## C. `stage2-blueprint.functions.ts` Migration Notes

`discussBlueprint` is a runtime Stage 2 discussion surface, not the same path as the main phased schema helper. Its Lovable Gateway transport is now routed through `getDefaultAiProvider().createChatCompletion(...)`.

Classification:

- Tool-call chat with optional plain-text response.
- Uses an OpenAI-compatible `tools` array.
- Intentionally omits `tool_choice` so the model may either answer in text or call `propose_blueprint_patch`.
- Uses `max_tokens`, not `max_completion_tokens`; the adapter type now passes this field through unchanged.
- Parses raw OpenAI-compatible response directly.
- Logs generation metadata after successful response handling.

Adapter status:

- The existing adapter supports the main `messages` and `tools` shape.
- The adapter type includes an optional `max_tokens` field to preserve the exact request body.
- The migration does not normalize `max_tokens` into `max_completion_tokens`.
- The migration does not force a tool call.

Discussion behavior to preserve:

- Trainer questions can receive plain text without a patch.
- Trainer change requests can receive a partial patch through `propose_blueprint_patch`.
- Invalid patch arguments are ignored and leave `patch` as `null`.
- Existing friendly 402 and 429 messages remain unchanged.
- Existing `logGeneration` payload remains unchanged.

Tests or fixtures needed before migration:

- Text-only successful response.
- Tool-call successful response with a valid partial patch.
- Tool-call response with malformed or invalid patch arguments.
- Missing AI configuration.
- 402 and 429 upstream status mapping.
- Token/cost/duration fields passed to generation logging.

## D. `scripts/r2.2-smoke2.ts` Migration Notes

This script is not runtime-critical. It is a local or maintenance smoke that still needs `LOVABLE_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` while Lovable Gateway remains the active adapter provider.

Disposition options:

- Keep: useful if the team wants a provider-neutral smoke after runtime migration.
- Archive: appropriate if the `.lovable` report is only historical evidence.
- Delete later: reasonable if replaced by tests or a safer smoke that does not depend on service-role local execution.

Because it is non-runtime and writes into `.lovable`, it should not block user-facing Lovable AI exit. It should remain last in the migration order unless the team confirms it is still an active release gate.

## E. Final Lovable AI Exit Plan

Before removing `LOVABLE_API_KEY`:

- All runtime AI callers route through `src/server/ai/provider-adapter.server.ts`.
- `discussBlueprint` no longer calls Lovable Gateway directly.
- `scripts/r2.2-smoke2.ts` is migrated, archived, or removed from active workflows.
- Staging has the replacement provider secret configured without exposing values.
- Provider replacement smoke checks pass for plain chat, forced tool calls, optional tool calls, image content, and phased schema generation.

Before removing Lovable packages:

- Confirm no runtime auth, build, deployment, or AI path imports Lovable-only packages.
- Confirm `.lovable` content is historical archive only and not required by deployment or smoke workflows.
- Confirm environment validation no longer marks Lovable-specific variables as required for production.

Before replacing the active adapter implementation:

- Model mapping is explicit for every current model id.
- Response envelopes are mapped for chat text, tool calls, image inputs, Anthropic compatibility, and phased schema calls.
- Error semantics are defined for missing key, 402, 429, non-OK responses, malformed JSON, empty replies, missing tool calls, and invalid tool arguments.
- Token usage and cost accounting are either preserved or intentionally changed with docs and tests.
- Contract tests protect `callAnthropicWithSchema` and the Stage 2 discussion path.
