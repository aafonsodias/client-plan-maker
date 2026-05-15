---
name: Restraint copy contract
description: Required + forbidden phrases for adaptation/decision surfaces. Engine output is evidence, never instruction. Trainer is the decider.
type: preference
---
## Why

R-D refactor (May 2026): the engine no longer auto-applies its next-block
proposal — the trainer must explicitly decide. Copy must reflect that.
Anywhere we surface engine output (proposal review, evidence chips,
markers, transition summaries, future ReportSnapshot panels), language
must position the system as **evidence**, never as **instruction**.

## Required phrases (PT-PT and EN equivalents)

- PT: "O Protocol mostra evidência. Você decide."
  EN: "Protocol surfaces evidence. You decide."
- PT: "Calculado a partir dos seus logs. Não é uma recomendação."
  EN: "Computed from your logs. Not a recommendation."
- PT: "Cargas e progressões são suas para definir."
  EN: "Loads and progressions are yours to set."
- PT: "Justificação obrigatória."
  EN: "Rationale required."

## Forbidden phrases — fail review if present in adaptation/decision surfaces

- "recomendamos" / "we recommend"
- "carga sugerida" / "suggested load"
- "ideal" (as a directive on prescription)
- "score de risco" / "risk score" (as a single composite verdict)
- "o seu cliente deve" / "your client should"
- "próxima sessão óptima" / "optimal next session"
- "auto-aplicado" / "auto-applied"

## Where this applies (today)

- `/clients/$clientId/adaptation/$proposalId` review screen
- Landing `value.client.items` block-continuity bullet
- `block_transition_summary` rendered in plan headers
- Future ReportSnapshot PDF (Phase 4.1) — the 5 buckets must label engine
  output as `engine evidence`, never merge it with `trainer decisions`.

## Where this does NOT apply

- Internal engine logs / generation_log payloads (machine-readable, not UX).
- Stage 3 prompts to the AI — those are instructions to a tool, not to a
  human, and are out of scope.

## How to apply on every new copy

Before shipping any string in an adaptation surface: scan for the forbidden
list above; if hit, rewrite as evidence ("RPE +0.7 sem ganho de e1RM"
instead of "carga sugerida −5%"). The decision verb belongs to the
trainer, never to the system.