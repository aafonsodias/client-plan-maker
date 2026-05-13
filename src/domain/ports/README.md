# Engine ports

Stable TypeScript contracts for every engine the product depends on. The
rule (FORGE study, Section F):

> The product never imports an implementation directly. Feature modules
> name the port; only the registry resolves the port to an adapter.

Each port has:

- A `version: string` field of the form `name@semver` that travels with
  every output and lands in `audit_events.engine_versions` and
  `generation_log.engine_versions`.
- A pure input type (no Supabase rows, no Anthropic types — domain shapes
  only).
- A pure output type.

Adapters live in `src/server/...` and `import type { ... } from
"@/domain/ports"`. The reverse import (port importing adapter) is a
compile error.

## Current ports

- `PlanGenerator` — drafts a Plan from an AssessmentSnapshot + Brief.
- `ProgressionEngine` — given a logged week, produces next week's loads
  deterministically. Adapter: `programNextWeek`.
- `ScreeningEvaluator` — PAR-Q+ / ePARmed-X+ → RiskBand + structured
  reasons. Adapter: `runPreparticipationAlgorithm`.
- `AdaptationEngine` — given block-level logs + assessment, proposes the
  next block's prescription diff with rationale. **No adapter yet — this
  is the existential MVP build.**
- `AiProvider` — wraps any LLM. Adapter today: Anthropic Claude via
  `anthropic-compat.server.ts`.
- `PdfExporter` — produces a versioned PDF from a pure view-model.
- `MediaProvider` — resolves `MediaRef` → playable URL. Today: Supabase
  Storage.
- `PaymentProvider` — sessions, webhooks, subscription state. Today:
  Stripe.

## Adding a new engine

1. Define the port here in a new file.
2. Write a contract test suite in `src/domain/ports/__tests__/`.
3. Build the adapter under `src/server/`. The adapter MUST import the
   port and its input/output types from `@/domain/ports`.
4. Register the adapter in `src/server/engine-registry.ts` (created when
   the second adapter for any port appears — premature today).