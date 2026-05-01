
# Phased Plan Generation (v2)

## Goal

Replace the current single-shot generation with a 5-stage pipeline that does AI work *as the assessment is filled* (Pre-Stage 0) and gives the coach an approval gate at each downstream stage. Final plan output stays structurally identical to today's so the existing FORGE plan view keeps working.

Ships behind a per-trainer feature flag; the existing flow stays as "Quick generate" until the new flow is validated.

## Architecture overview

```text
Assessment fill ──► Pre-Stage 0 (per section, on save)          [Haiku]
                       └─► assessments.section_analyses {...}

Coach: "Generate plan"
   ├─ Stage 1  Brief synthesis              [Haiku]  → plan.brief             → /plans/:id/brief        (gate)
   ├─ Stage 2  Mesocycle blueprint          [Haiku]  → plan.blueprint         → /plans/:id/blueprint    (gate)
   ├─ Stage 3  Week-1 microcycle (||)       [Sonnet] → workout_plan_days W1   → /plans/:id/microcycle   (gate)
   ├─ Stage 4  Progression deltas           [Haiku]  → plan.progression_plan  → /plans/:id/progressions (gate)
   └─ Stage 5  Bulk fill weeks 2..N         [no AI]  → workout_plan_days W2+  → /plans/:planId
```

Each gate persists state, is revisitable read-only after approval, and re-running a stage invalidates downstream stages (they require re-approval).

## Data model

Additive migration only — nothing existing is dropped or renamed.

```sql
-- Eager per-section analysis
alter table assessments
  add column section_analyses     jsonb not null default '{}'::jsonb,
  add column sections_analysed_at jsonb not null default '{}'::jsonb;

-- Phased generation state on plans
alter table workout_plans
  add column generation_state jsonb not null default '{}'::jsonb,
    -- { stage: 'brief'|'blueprint'|'microcycle'|'progressions'|'complete',
    --   approved_stages: string[], last_updated_at: iso }
  add column brief             jsonb,
  add column blueprint         jsonb,
  add column progression_plan  jsonb;

-- Per-trainer rollout flag
alter table profiles
  add column phased_generation_enabled boolean not null default false;

-- Telemetry
create table generation_log (
  id uuid primary key default gen_random_uuid(),
  trainer_id   uuid not null,
  plan_id      uuid,                    -- null for Pre-Stage 0
  assessment_id uuid,                   -- set for Pre-Stage 0
  stage        text not null,           -- 'pre0:par_q' | 'stage1' | ...
  model_used   text not null,
  input_tokens int  not null default 0,
  output_tokens int not null default 0,
  cost_usd     numeric(10,6) not null default 0,
  zod_passed   boolean not null,
  retry_count  int     not null default 0,
  input_snapshot  jsonb,
  output_snapshot jsonb,
  created_at timestamptz not null default now()
);
-- RLS: trainer sees only own rows.
```

`generation_meta` on `workout_plans` stays untouched so the existing flow keeps working.

## Section → brief field map (Pre-Stage 0)

Drives 14 micro-prompts. Source of truth lives in `src/server/phased/section-map.ts`.

| Section | Brief contribution |
|---|---|
| PAR-Q+ | `red_flags[]`, contraindication notes |
| Risk strat. | `red_flags[]` (escalation) |
| Meds | `red_flags[]`, beta-blocker / anticoag notes |
| Anthro + perf | `training_age_band` refinement |
| Goal (SMART) | `primary_goal`, `secondary_goals[]` |
| Readiness | `notes_for_next_stage` (coaching tone) |
| Training setup | `sessions_per_week {recommended,min,max}`, `equipment_constraints` |
| Equipment | `equipment_constraints` |
| Mobility / posture / screen | `movement_competency_summary {squat,hinge,push,pull,carry,lunge}` |
| History | `training_age_band` |
| Lifestyle / nutrition | `recovery_profile` → `notes_for_next_stage` |

A section's micro-call only runs if `sections_analysed_at[section] < section's last update`. Idempotent.

## Server functions (new file: `src/server/phased/*.functions.ts`)

All authenticated with `requireSupabaseAuth`. Each call: own focused system prompt, Zod validator, one retry on validator failure, then surface to coach. All token usage logged via `makeTelemetry` (existing helper) and inserted into `generation_log`.

| Function | Stage | Model env var | Default |
|---|---|---|---|
| `analyzeAssessmentSection({ assessmentId, section })` | Pre-0 | `FORGE_MODEL_PRE_STAGE` | haiku-4-5 |
| `synthesizeBrief({ planId })` | 1 | `FORGE_MODEL_STAGE_1` | haiku-4-5 |
| `approveBrief({ planId, brief })` | 1 gate | — | — |
| `generateBlueprint({ planId })` | 2 | `FORGE_MODEL_STAGE_2` | haiku-4-5 |
| `approveBlueprint({ planId, blueprint })` | 2 gate | — | — |
| `generateMicrocycle({ planId })` (parallel per archetype, streamed) | 3 | `FORGE_MODEL_STAGE_3` | sonnet-4-5 |
| `regenerateArchetype({ planId, archetypeId })` | 3 partial | same | — |
| `approveMicrocycle({ planId })` | 3 gate | — | — |
| `proposeProgressions({ planId })` | 4 | `FORGE_MODEL_STAGE_4` | haiku-4-5 |
| `approveProgressions({ planId, progressionPlan })` | 4 gate | — | — |
| `bulkFillRemainingWeeks({ planId })` | 5 | none | deterministic, target <500ms |

Each generate-* call writes to its own JSONB column and updates `generation_state.stage`. Approving a stage appends to `approved_stages[]`. Editing an upstream stage clears all downstream `approved_stages[]` entries and JSONB columns.

Pre-Stage 0 trigger: `analyzeAssessmentSection` is called from a `useEffect` debounce inside the assessment section's save handler in `clients_.$clientId.tsx` — fires right after the existing autosave succeeds, never blocks UI. Reuses the assessment save's auth context.

## Zod schemas (`src/server/phased/schemas.ts`)

One schema per stage matching the prompt spec verbatim (`BriefSchema`, `BlueprintSchema`, `MicrocycleSessionSchema` reusing the existing FORGE day/exercise contract from `plan.server.ts`, `ProgressionPlanSchema`). Validator failures feed the error string back into a single retry; a second failure throws a typed `PhasedValidationError` surfaced as a coach-facing toast.

## UI routes

New TanStack routes under the existing AppShell, all reusing FORGE design tokens — no design changes:

| Route | File | Purpose |
|---|---|---|
| `/plans/:planId/brief` | `src/routes/plans.$planId.brief.tsx` | Stage 1 review: every brief field inline-editable, "Approve brief" → Stage 2. |
| `/plans/:planId/blueprint` | `src/routes/plans.$planId.blueprint.tsx` | Week×day matrix, rename archetypes, swap days, change progression model. |
| `/plans/:planId/microcycle` | `src/routes/plans.$planId.microcycle.tsx` | Week 1 sessions in FORGE plan view; per-exercise swap/edit, "needs regen" per session. |
| `/plans/:planId/progressions` | `src/routes/plans.$planId.progressions.tsx` | Table: 1 row per exercise, columns per week, all cells editable. |

Plan creation entry point: `/plans/new?clientId=...` (`src/routes/plans.new.tsx`) — creates the `workout_plans` row with `generation_state = { stage: 'brief' }`, kicks off `synthesizeBrief`, redirects to `/plans/:id/brief`. From the client detail page, the existing "Generate plan draft" button routes here when `phased_generation_enabled` is true; otherwise falls through to today's flow.

A small "Brief preview" panel inside the assessment page shows `section_analyses` coverage (X/14 sections analysed, last updated) so the coach knows the eager work is happening.

i18n: every new page uses the existing `assessment` / `plan_editor` namespaces (or a new `phased` namespace if needed) — plan integrates with the in-flight pt|en work, no hardcoded strings.

## Cost guardrail

- Per-call cost tracked via existing `computeCallCostUsd`.
- Pre-Stage 0 attributed to assessment via `assessment_id` column (no separate table — one `generation_log` with nullable plan_id/assessment_id keeps queries simple).
- Plan-level alert: after each stage insert, sum `cost_usd` where `plan_id = $1`; if > €0.80 (≈$0.86) log a warning row + return a coach-facing flag the UI shows in the next gate header.

## Rollback

- Migration is purely additive — reverting it is safe.
- Feature flag `profiles.phased_generation_enabled` default `false`. Existing flow (`generatePlanDraft` etc.) untouched.
- Each new server function lives under `src/server/phased/` — deleting that folder + the 5 new route files removes the feature with zero impact on the existing flow.
- New routes are leaf routes; removing them does not affect `/plans/:planId`.

## Execution order (per-step commits, independently revertible)

1. **Migration + types**: new columns, `generation_log` table, RLS, `phased_generation_enabled` flag. Regenerate `types.ts`.
2. **Schemas + section map**: `src/server/phased/schemas.ts`, `section-map.ts`. No behavior change.
3. **Pre-Stage 0**: `analyzeAssessmentSection` server function + wire-up in assessment section save handlers + "Brief preview" panel. Gated by flag.
4. **Stage 1 + brief route**: `synthesizeBrief`, `approveBrief`, `/plans/:planId/brief`, plus `/plans/new` entry point.
5. **Stage 2 + blueprint route**: `generateBlueprint`, `approveBlueprint`, `/plans/:planId/blueprint`.
6. **Stage 3 + microcycle route**: parallel-per-archetype generation (reuse the existing parallel-day machinery from `generatePlanDraft`), `regenerateArchetype`, `approveMicrocycle`, `/plans/:planId/microcycle`.
7. **Stage 4 + progressions route**: `proposeProgressions`, `approveProgressions`, `/plans/:planId/progressions`.
8. **Stage 5 bulk fill + finalize**: deterministic clone + delta apply, redirect to existing `/plans/:planId`.
9. **Cost guardrail + log viewer (optional, behind flag)**.
10. **Flip flag for first 5 trainers, validate, then default-on**.

Each step touches only its own files plus the matching schema/i18n additions. Reverting any one step leaves earlier steps functional because each downstream stage checks `generation_state.stage` and falls back to the previous gate if its JSONB is missing.

## Acceptance

- Coach with flag on: walks the 4 gates end-to-end; can close tab and return at any gate.
- Stage 1 latency on plan create is dominated by network, not model — section analyses are pre-computed.
- Final `/plans/:planId` view is byte-compatible with today's plan output.
- Bulk fill (Stage 5) <500ms server-side measured in `generation_log`.
- `generation_log` shows: N pre-0 rows per assessment + ≥4 stage rows per plan (Stage 3 = 1 per archetype).
- Re-editing a section re-runs only that section's micro-analysis.
- Editing brief invalidates blueprint/microcycle/progressions; coach is forced to re-approve downstream.
- Coach without flag: zero behavior change.

## Constraints respected

- No exercise generation before Stage 3.
- Weeks 2..N never go through AI — only deltas (Stage 4) + deterministic clone (Stage 5).
- Stage 1 receives `section_analyses`, never raw assessment JSON.
- Stage 4 receives blueprint + Week 1 only, never raw assessment.
- Zod validators on every AI stage; one retry then surface to coach.
- This refactor ships independently of PDF and design work.
