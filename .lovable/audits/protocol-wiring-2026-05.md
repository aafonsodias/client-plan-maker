# Protocol wiring audit — May 2026

Goal: trace each protocol step (assessment → brief → plan → log → next-week)
and document where intent is honoured, lost, or overwritten. This is the
Phase-0 deliverable from `.lovable/plan.md` (May 2026 round).

## TL;DR — what is broken today

| Symptom user reported              | Root cause                                                                                 | Fix in this round                       |
|-------------------------------------|--------------------------------------------------------------------------------------------|------------------------------------------|
| "Regen with RPE 6.5" ignored        | `RegenerateWithFeedbackDialog` calls `generatePlanDraft` (legacy single-shot). Wave anchor is picked from `experience_level` only — trainer feedback text is appended verbatim but never parsed. | Add `parseRpeOverrideFromFeedback()` and override the wave anchor when present. |
| "Upstream request timeout" on regen | `generatePlanDraft` regenerates **all weeks in one Haiku call** with 12k max-tokens. Worker hard-limit ≈ 30s. | Switch the dialog to fan out per-week with `generatePlanWeek` (already exists) and merge. |
| "Not getting concurrent training"   | The system prompt teaches "warmup / activation / exercises / cardio / cooldown / finisher" — there is no concept of a balance / agility / coordination / dual-task block. Movement-screen scores ≤2 are passed in context but the model has no instruction to act on them. | Add `motorCapacityNeeds()` + `buildConcurrentTrainingBlock()` that injects an explicit instruction whenever the assessment shows ≥1 motor-capacity gap or a goal that demands concurrent work. |
| Volume "not too high" but not low   | `pickWaveTier()` already drops to `beginner` (anchor 5.5) when `injuryActive` or `redFlagsCount ≥ 2`. Anchor for plain "beginner" is 5.5 too. So the wave starts low when the upstream signals are correct. The leaky link is `experience_level` not always being filled. | Documented; no code change this round (low risk needs more data). |

## Map: assessment field → where consumed → state

| Assessment field                     | Read in                                            | Used to set                                                | State |
|--------------------------------------|----------------------------------------------------|-------------------------------------------------------------|-------|
| `experience_level`                   | `plan.functions.ts` line ~722, stage4              | `pickWaveTier` → wave anchor                                | OK    |
| `parq_passed`, `acsm_risk_category`  | `buildSafetyBlock` (plan.server.ts)                | Hard cap RPE in safety block                                | OK    |
| `med_flags[]`                        | `buildSafetyBlock` + `pickWaveTier(redFlagsCount)` | Conservative block, beginner anchor                         | OK    |
| `injuries`                           | `pickWaveTier(injuryActive)` + safety block        | Beginner anchor                                             | OK    |
| `single_leg_balance_score` ≤2        | `buildClientContextBlock` (raw dump only)          | Nothing — model is just told the number                     | **PARTIAL** → fixed via concurrent block |
| `squat_depth_score`, `hip_hinge_score`, `overhead_reach_score` ≤2 | same | same                                                        | **PARTIAL** — substitution rule exists but is generic |
| `cardio_capacity` low                | `buildClientContextBlock`                          | Cardio prescription guidance is generic                     | **PARTIAL** — fixed via concurrent block when combined with strength goal |
| `secondary_goals[]` containing balance/agility/coordination | none | none                                          | **MISSING** — fixed via concurrent block |
| `programming_variables.rpe_ceiling` (Cockpit) | `resolveCockpit` → stage4 wave              | Stage 4 wave shape                                          | OK in phased pipeline; **MISSING** in legacy generator (the regenerate path) |
| Trainer free-text feedback "rpe X"   | Appended verbatim to prompt only                   | Model decides whether to honour                             | **WEAK** → fixed by deterministic parse + anchor override |

## Two pipelines, two behaviours

1. **Phased pipeline** (Stage 1 brief → 2 blueprint → 3 microcycle → 4 wave → 5 bulkfill).
   - Stage 4 is deterministic and reads `programming_variables.rpe_ceiling`.
   - This path honours the Cockpit (good).
   - Used for initial generation.
2. **Legacy single-shot** (`generatePlanDraft`, called by the "Regenerate with feedback" dialog).
   - Builds the wave from `experience_level` + safety counts only.
   - Ignores `programming_variables.rpe_ceiling`.
   - Single 12k-token Haiku call → frequent Worker timeout on long plans.

The user is hitting (2). Long term the legacy path should be replaced with a
phased re-run; for this round we shore it up.

## What ships in this round

- `parseRpeOverrideFromFeedback(text)` — recognises `rpe 6.5`, `rpe 6-7`, `começa em rpe 6.5`, `start at rpe 6.5`. When matched, the wave anchor for that single regeneration is overridden.
- `motorCapacityNeeds(assessment)` — returns the union of:
  - movement-screen items with score ≤2 mapped to `balance | hip_hinge | overhead | squat`,
  - `secondary_goals` containing `balance | agility | coordination | dual.?task | cognitive`,
  - `cardio_capacity` low/poor combined with a strength primary goal → `cardio_concurrent`.
- `buildConcurrentTrainingBlock(needs)` — appended to the system prompt when needs is non-empty. Tells the model that ONE day per week (or per microcycle) must dedicate 8–15 min after the main lifts to a `motor_skills` block (single-leg balance, agility ladder, dual-task walk-and-count) and, when `cardio_concurrent` is present, a Z2 or Z2/Z4 short interval block — bounded so it does not blow up volume.
- `RegenerateWithFeedbackDialog` switched to fan out `generatePlanWeek` calls (parallel) and merge — fixes the upstream timeout.

## What does NOT ship in this round (intentional)

- Refactor of `generatePlanDraft` into the phased pipeline. Higher reward but the regression surface is huge — needs its own focused round.
- Pushing `programming_variables.rpe_ceiling` through the legacy generator. The override parser covers the immediate case; full Cockpit-through-legacy plumb-through belongs with the refactor above.
- New tables, new UI sections. The user explicitly said the 5 sections are enough.

## How to verify

1. Open a plan, click **Regenerate with feedback**, type `rpe 6.5` → after regen the W1/W2 RPE column shows `6.5–7.5` (instead of `7–8`). No upstream timeout.
2. On a client with `single_leg_balance_score = 2`, regenerate → at least one day's `cardio` or extra block contains a balance / coordination / dual-task drill (e.g. "Single-leg stand 3×30s", "Agility ladder shuffle 4×20s", "Walk + serial 7s subtraction 3 min").
3. Cockpit-driven flow (initial phased generation) is unchanged — Stage 4 still reads `rpe_ceiling`.
