
# Plan — Exercise selection, assessment-driven picks & regen reliability

## 1. What I found (current state)

### How exercises are picked today

The phased pipeline runs `pre-stage → stage1-brief → stage2-blueprint → stage3-microcycle → stage4-progressions → stage5-bulkfill`. The actual **exercise names are invented free-text by the LLM in Stage 3** (`src/server/phased/stage3-microcycle.functions.ts`), constrained by:

- **Tier guidelines** (`programming-tier.server.ts`) — `remedial / conservative / advanced` derived from PAR-Q+, ACSM CVD risk, BP, movement-screen failures, recovery flags, age, training-age band.
- **Forbidden lists** per tier (e.g. remedial bans barbell back squat / DL / OHP / cleans; conservative bans back squat / conventional DL / push press).
- **Brief constraints**: `red_flags`, `equipment_constraints`, `training_location`, `training_age_band`, `intensity_appetite`.
- **Programming Variables (Cockpit)**: `rpe_floor / rpe_ceiling / wave_model / volume tier / autoreg`.
- **Volume targets** (PKL landmarks per muscle, weekly totals).
- **Rotation pool** (`generation_meta.prior_exercise_pool`) — block N>1 must rotate ≥60% of accessories.
- **FITT-VP ranges** retry loop (Stage 3 retries if a violation is detected).

### What is NOT used today (gaps)

- **No structured exercise database** — names are free strings (`mem/features/exercise-intelligence-layer.md`, `.lovable/r72-exercise-system-audit.md`). No `exercise_id`, no canonical movement-pattern field, no contraindication flags on exercise records → "knee pain" only blocks via free-text prompt, not via structured filtering.
- **Injury detail underused** — `assessment_injuries` (with `body_zone`, `severity`, `injury_label`) is collected but only flows into the prompt as flat `red_flags`. There's no per-zone exercise denylist (e.g. shoulder impingement → no behind-neck press, no upright row).
- **Capacity snapshots** (`client_capacity_snapshots`, `cardio_capacity`, `submax_test`) feed tier classification but **don't bias exercise selection** (no "if VO₂max < X → no high-impact plyo").
- **NASM OPT phase** is not modelled — beginners should start in Stabilisation (single-leg, instability, slow tempo) regardless of tier.
- **Bompa loading-zone caps** are present (RPE/volume tiers) but not the exercise-classification side (compound vs auxiliary vs corrective ratios per phase).

### Why the plan "reverted in front of you" (the bug)

`RegenerateWithFeedbackDialog` writes to `workout_plans.plan_data` (the legacy JSON blob). But the rendered phased plan also reads `workout_plan_days` rows (one row per day), and `MicrocyclePanel` keeps a **realtime `postgres_changes` subscription on `workout_plan_days`** (`src/components/MicrocyclePanel.tsx:96`). Regen never updates `workout_plan_days` → on the next subscription tick (or any reload) the view re-hydrates from the stale day rows and the user sees the "old" plan re-appear. Same root cause as why edits made in `view` mode disappear.

## 2. Goals

1. Make exercise picks **provably driven by the assessment** (injuries, screens, capacity, equipment, age, OPT phase).
2. Make regenerate **stick** — single source of truth for plan content.
3. Surface **all inputs** that affect a meso in one place ("Edit meso" panel) so the trainer can tweak any of them and regen with confidence.

## 3. Proposed work — 3 phases

### Phase C1 — Fix the "revert" bug (must-ship first)

- Make the regenerate path the same as initial phased generation: **rewrite `workout_plan_days` rows** (week 1) and persist mesocycle metadata, instead of (or in addition to) `workout_plans.plan_data`.
- Decide one source of truth per phased plan: either (a) `workout_plan_days` is canonical and `plan_data` is a derived snapshot, or (b) `plan_data` is canonical and `MicrocyclePanel` switches off its realtime subscription when `generation_status === 'complete'`. Option (a) is the right answer — lets the rest of the pipeline (stage4/5) keep working.
- Add a `plan_data_version` check on the realtime handler so a stale day-row event can't overwrite a newer `plan_data` snapshot.
- Verify: regenerate, leave the page, come back — same plan. Trigger a manual `workout_plan_days` UPDATE in another tab — UI doesn't flip back.

### Phase C2 — Assessment → Exercise filtering (rules engine, no schema yet)

Add `src/server/phased/exercise-filters.server.ts` that, given `(brief, assessment, assessment_injuries[])`, produces:

- `forbiddenExercises[]` = tier list ∪ per-injury list (e.g. `low_back severity≥3` → no conventional DL, no good morning, no behind-neck press; `knee severity≥3` → no deep box jump, no pistol squat, no jump lunge; `shoulder` → no upright row, no behind-neck press, no kipping; `pregnancy` → no prone work after week 16, no breath-holding).
- `requiredAlternatives` table per banned movement pattern.
- `opt_phase` (Stabilisation / Strength Endurance / Hypertrophy / Max Strength / Power) from NASM, decided by `training_age_band + movement_screen_score + weeks_in_program`. Stage 3 prompt receives "main lifts must be unilateral or stability-biased" when phase=Stabilisation.
- `impact_ceiling` (low / moderate / high) from `cardio_capacity`, BP, BMI → caps plyo.
- Each rule has a citation tag (ACSM 12e Ch.X / NASM Ch.Y / Bompa 6e Ch.Z) written into `generation_log` so we can audit later.

Wire this into `tierGuidelines()` — it merges into the existing `forbiddenExercises` + adds a new `selection_constraints` block in the Stage 3 prompt.

**No new tables.** This is pure server logic on top of data we already collect. The full structured exercise DB stays deferred (see `mem/features/exercise-intelligence-layer.md`).

### Phase C3 — "Edit Meso" panel: all inputs in one click

Move regenerate **into edit mode** as the single CTA "Regenerate this mesocycle". Above the button, expose collapsible groups, each pre-filled and editable:

1. **Goal & timing** (primary_goal, secondary_goals, duration_weeks, sessions_per_week, session_minutes).
2. **Intensity Cockpit** (existing `<IntensityCockpit/>`).
3. **Tier & screening result** (read-only chip: "Conservative · 1 movement-screen failure · PAR-Q+ passed") with a "why?" popover citing the rules.
4. **Injury overrides** (list from `assessment_injuries`, each with toggle "honour in plan" + severity slider).
5. **Equipment & location** (multi-select).
6. **Block lineage** (prior block summary + rotation rule strength: 60% / 80% / unrestricted).
7. **Free-text trainer note** (current "feedback" field).

Hitting Regenerate = single server fn `regenerateMesocycle({planId, overrides})` that:
- merges overrides into `brief` + `programming_variables`,
- re-runs Stage 3 (and stage 4 deterministically),
- writes `workout_plan_days` rows atomically,
- bumps `plan_data_version`,
- logs to `generation_log` with the diff of overrides.

This replaces both the current "Regenerate (Cockpit-aware)" button and the scattered edit-then-save flow.

## 4. Open decisions for you

I'd like your call on three things before I touch code:

1. **Source of truth** — `workout_plan_days` rows (per-day, what the phased pipeline natively writes) or `workout_plans.plan_data` JSON (what the legacy regen writes)? My recommendation: **day rows are canonical, `plan_data` becomes a read-model rebuilt on save.**
2. **Scope of C2 rule pack** — start with the top 6 injury zones (low_back, knee, shoulder, neck, hip, wrist) and 3 medical flags (hypertension, pregnancy, recent surgery), or go wider day-one?
3. **C3 panel** — replace the existing edit mode entirely, or add it as a new "Meso settings" section above the week grid?

I will not start the structured-exercise-database refactor (that's a separate, much larger round per the existing memo) unless you ask.
