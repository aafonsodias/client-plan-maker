## Goal

Turn the demo client into a **theatrical end-to-end stress test** that:
1. Generates a *truly randomised* persona (no longer just 3 templates) with full assessment coverage — including all the form-criteria / capacity JSON fields the current demo skips.
2. Plays the journey out visually: opens each gate, fills it, collapses, advances, all the way to the planner.
3. After the planner finishes, runs an **AI judge** that grades the plan against the persona's red flags and writes a structured "Findings" report we can iterate on.

This becomes our regression harness — every turn we run it, fix what it complains about, run it again.

---

## Phase 1 — Richer demo personas (server)

`src/server/demo-client.functions.ts`:
- Expand from 3 templates to ~10 archetypes covering the realistic edge cases:
  - Post-partum (6 months), runner with knee pain, desk worker pre-diabetic, masters athlete (60+) on statins, hypertensive untrained, returner after ACL, advanced powerlifter cutting, hypermobile yoga teacher, shift-worker (poor sleep), deconditioned post-COVID.
- Each archetype declares **expected red-flag tags** (e.g. `["no_axial_loading", "bp_monitoring", "unilateral_emphasis"]`). These become the rubric for the judge later.
- Fill the JSON fields the current demo leaves empty:
  - `squat_form_criteria`, `hinge_form_criteria`, `push_form_criteria`, `pull_form_criteria`, `carry_form_criteria`, `lunge_form_criteria` (booleans per criterion)
  - `*_capacity` (reps / load / time per pattern)
  - `screen_not_assessed`
  - `extended.parq_answers`, `extended.risk_factors`, `extended.mobility_scores`, `extended.cardio_test`
  - `standing_posture_notes`, `known_imbalances`, `body_fat_pct/method`
- Within each archetype, randomise *within plausible ranges* per field — so two runs of the same archetype still differ.
- New flag on the function: `createDemoClient({ archetype?: string, seed?: number })` so the harness can request a specific scenario or reproduce a run.

## Phase 2 — Theatrical "auto-fill" mode (client)

New mode on the client detail route triggered by query param `?demo=play`:
- When the freshly-created demo client lands on `/clients/:id`, the page detects the flag and runs an orchestrator that, **section by section** in the order of `SECTIONS`:
  1. Scrolls the section into view + opens it (`setOpenSections`).
  2. Waits ~600ms (perceptible, not annoying).
  3. Streams the persona's values into the local form state field-by-field (50ms stagger) so the user sees inputs filling.
  4. Persists the section (existing autosave / save-section path).
  5. Collapses the section, marks it green, moves on.
- Pacing is configurable (`?speed=fast|normal|slow`) — default normal (~1.5s per section).
- The "+ Cliente demo" button gets a sibling **"+ Demo guiado"** that creates the client with the JSON fields *empty* and triggers `?demo=play` so we actually see the fill-in animation. The plain "+ Cliente demo" stays as today (instant).

## Phase 3 — Auto-advance to the planner

When all sections are complete, the orchestrator:
- Clicks "Generate plan" (the existing CTA on the client page).
- Polls plan generation status (`workout_plans.generation_status`) and surfaces phase progress in a small overlay ("Brief → Blueprint → Microcycle → Progressions → Bulk-fill").
- On completion, navigates to `/plans/:planId` and triggers Phase 4.

## Phase 4 — AI Judge ("post-mortem")

New server function `judgeDemoRun` in `src/server/demo-client.functions.ts`:
- Inputs: `clientId`, `planId`, `expected_red_flags` (from the archetype, stashed in `clients.notes` or a new `extended` field on the assessment).
- Builds a compact payload: persona summary + assessment red-flag fields + the generated plan (weeks, exercises, RPE/load progressions).
- Calls Lovable AI (`google/gemini-3-flash-preview`) via tool-calling with this rubric (extracted as structured JSON):
  - `safety_violations[]` — e.g. axial-loading prescribed despite `no_axial_loading` flag
  - `progression_realism` — week-to-week deltas plausible? RPE ramp coherent?
  - `agonist_antagonist_balance` — push/pull and quad/posterior chain ratios
  - `volume_appropriateness` — given experience level + session minutes
  - `equipment_adherence` — exercises only use `available_equipment`
  - `goal_alignment` — does the plan move toward `smart_specific`?
  - `overall_grade` (A–F) + `top_3_friction_points` (free-text the trainer should prioritise)
- Persist the verdict to a new column `workout_plans.demo_critique jsonb` (migration) so we can review trends.

## Phase 5 — Findings drawer

A small slide-over UI on `/plans/:planId` that appears only when `demo_critique` exists, showing:
- Overall grade pill (toned A=success, F=danger via `status-tone.ts`)
- Each violation grouped by severity
- "Top 3 friction points" as the prioritised backlog for our next iteration

This is the loop closure: the judge tells us what to fix, we fix it, run again.

---

## Technical notes

- **Why no LLM for the persona itself**: deterministic templates + per-field jitter is faster, cheaper, and lets us assert "this archetype must produce flag X" — an LLM persona makes the rubric non-falsifiable.
- **Pacing without `setTimeout` spaghetti**: orchestrator is a single async function using a `step(ms)` helper, driven by a Zustand-style local state machine (`idle → opening → typing → saving → next`). Easier to pause/resume than scattered timers.
- **Persistence during fill**: the route already has section-level save handlers; the orchestrator just calls them — no new write paths.
- **Judge cost**: ~1 call per run, gemini-flash, structured tool output. Negligible.
- **No new tables**: critique stored on `workout_plans.demo_critique`, expected flags stored on `assessments.extended.demo_meta`.

## Out of scope this round

- Past-workout seeding (Phase D from the deferred list) — still queued.
- Auto-fixing what the judge complains about. The judge only diagnoses; we drive the fixes.
