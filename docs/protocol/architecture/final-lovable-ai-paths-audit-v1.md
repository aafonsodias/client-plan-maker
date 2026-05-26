# Final Lovable AI Paths Audit v1

## Executive Summary

The active Lovable AI runtime path has been removed.

All known runtime and non-runtime AI surfaces use `src/server/ai/provider-adapter.server.ts`, and the adapter now supports only the OpenAI-compatible chat completions provider.

The former Lovable Gateway provider, key lookup, provider selection branch, and Gateway URL are no longer active code.

## Current Path Inventory

| Path | Runtime or script | Current purpose | Request shape | Current provider status |
|---|---|---|---|---|
| `src/server/atlas.functions.ts` | Runtime | Atlas chat. | `model`, `messages` | Adapter-routed OpenAI-compatible provider. |
| `src/server/concierge.functions.ts` | Runtime | Concierge recommendation flow. | `model`, `messages`, `tools`, forced `tool_choice` | Adapter-routed OpenAI-compatible provider. |
| `src/server/sessions-ocr.functions.ts` | Runtime | Session image OCR. | `model`, multimodal `messages`, `tools`, forced `tool_choice` | Adapter-routed OpenAI-compatible provider. |
| `src/server/demo-judge.functions.ts` | Runtime | Demo run critique. | `model`, `messages`, `tools`, forced `tool_choice` | Adapter-routed OpenAI-compatible provider. |
| `src/server/intake-ai.functions.ts` | Runtime | Intake goal interpretation. | `model`, `messages`, `tools`, forced `tool_choice` | Adapter-routed OpenAI-compatible provider. |
| `src/server/anthropic-compat.server.ts` | Runtime compatibility shim | Anthropic-shaped tool-call response over OpenAI-compatible transport. | `model`, `max_completion_tokens`, `messages`, `tools`, forced `tool_choice` | Adapter-routed OpenAI-compatible provider. |
| `src/server/phased/ai.server.ts` | Runtime | Schema-constrained phased generation helper. | `model`, `max_completion_tokens`, `messages`, `tools`, forced `tool_choice` | Adapter-routed OpenAI-compatible provider. |
| `src/server/phased/stage2-blueprint.functions.ts` | Runtime | Stage 2 blueprint discussion and optional patch proposal. | `model`, `max_tokens`, `messages`, optional `tools`, no forced `tool_choice` | Adapter-routed OpenAI-compatible provider. |
| `scripts/r2.2-smoke2.ts` | Script | End-to-end Sofia smoke for one Stage 3 day and FITT-VP validation. | `model`, `max_completion_tokens`, `reasoning_effort`, `messages`, `tools`, forced `tool_choice` | Adapter-routed OpenAI-compatible provider; report path is Protocol-owned. |

## R2.2 Smoke Report Path

The R2.2 smoke scripts no longer write active output into `.lovable/**`.

Current output path:

```text
docs/protocol/architecture/r2.2-smoke-report.md
```

Existing `.lovable/**` content is historical archive material only.

## Preserved Behavior

The final provider removal did not change:

- prompts
- schemas
- model routing
- response parsing
- retry behavior
- token or cost accounting
- generation logging
- billing, quota, auth, persistence, or UI behavior

## Remaining References

Remaining Lovable references are historical or archival only:

- architecture docs that describe earlier migration states
- `.lovable/**` archive content
- existing database migration history that must not be rewritten
- Git history

None of those references is an active AI runtime, build, browser, package, script, or env dependency.
