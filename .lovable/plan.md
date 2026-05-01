---

**Goal**

Replace the 48-call sequential generation with a 5-stage gated flow: Brief → Microcycle skeleton → Day 1 (gate) → Days 2–N → Progression deltas → deterministic Week 2–N fill. Total: ~5–7 AI calls per plan, every stage visible in seconds.

The Stage 1 brief route already exists. This plan finishes the pipeline.

---

**Flow**

```
[Pre-Stage 0]   per-section background analyses  (already wired, async)
                          ↓
[Stage 1] BRIEF           ← /plans/:id/brief        (exists; gate ✓)
                          ↓
[Stage 2] BLUEPRINT       ← /plans/:id/blueprint    (NEW; gate)
   week × day archetype matrix, NO exercises yet
                          ↓
[Stage 3a] DAY 1          ← /plans/:id/microcycle   (NEW; first quality gate)
   single AI call, full session, coach approves
                          ↓
[Stage 3b] DAYS 2..N      ← same route
   server-side bounded concurrency (max 3 in flight), appear via realtime
   coach can stop / regen single day
                          ↓
[Stage 4] PROGRESSIONS    ← /plans/:id/progressions (NEW; gate)
   ONE AI call → delta table (load/reps/RPE per exercise per week)
                          ↓
[Stage 5] BULK FILL       deterministic, server-side, <500ms
   Week 1 × N copies + delta apply → workout_plan_days rows
                          ↓
                    /plans/:planId  (existing view, byte-compatible)

```

---

**What gets built**

**1. Stage 2 — Blueprint (skeleton, no exercises)**

`src/server/phased/stage2-blueprint.functions.ts`

- `generateBlueprint({ planId })` — reads plan.brief, calls Haiku with BlueprintSchema tool. Output: archetypes (e.g. `{id:"lower_squat", focus:"Lower — Squat"}`) + week_to_session_map + progression model proposal. Writes workout_plans.blueprint, advances state to blueprint.
- `approveBlueprint({ planId, blueprint })` — persists edits, advances to microcycle, clears downstream.

`src/routes/plans.$planId.blueprint.tsx`

- Grid: rows = weeks, cols = days, cells = archetype dropdown.
- Editable archetype list (rename/add/remove).
- Progression model selector (linear / undulating / block).
- "Approve blueprint → generate Day 1".

---

**2. Stage 3 — Microcycle with Day 1 quality gate**

Reuse FORGE day schema from `src/server/plan.server.ts` (DaySchema/PlanDayContent) so output is byte-compatible with existing plan view.

`src/server/phased/stage3-microcycle.functions.ts`

- `generateDay({ planId, dayIndex })` — one Sonnet call, takes brief + blueprint + chosen archetype for that day, returns one PlanDayContent. Writes one workout_plan_days row (week=1, day=dayIndex, status='done').
- `generateMicrocycleDays({ planId, dayIndices })` — server-side function that runs a bounded concurrency pool (max 3 in flight) across the provided day indices. Each day is written to workout_plan_days immediately on success, or marked status='error' on failure. A single day error does not block the rest of the batch — remaining days continue. This runs entirely server-side so closing the tab does not abort generation.
- `regenerateDay({ planId, dayIndex })` — same as generateDay, replaces existing row.
- `approveMicrocycle({ planId })` — advances state to progressions.

`src/routes/plans.$planId.microcycle.tsx`

- Subscribes to workout_plan_days realtime for plan_id=eq.<id> AND week_number=eq.1.
- Day 1 first: route auto-fires `generateDay({dayIndex:1})` on mount if missing. Renders Day 1 in FORGE day card. "Approve Day 1" button → only then fires `generateMicrocycleDays` for days 2..N (one server call, client subscribes to realtime for results).
- Days appear as their realtime row arrives. No client-side Promise pool — all concurrency is managed server-side.
- Per-day "Regenerate" button for days with status='error'. "Stop all" button.
- "Approve microcycle" enabled once all N days have status='done'.

---

**3. Stage 4 — Progression deltas (one AI call)**

`src/server/phased/stage4-progressions.functions.ts`

- `proposeProgressions({ planId })` — one Haiku call, takes blueprint + Week 1 exercise list (extracted server-side from workout_plan_days where week=1) + progression model. Returns ProgressionPlanSchema (1 row per exercise × dimension, week_2/3/4 deltas). Writes workout_plans.progression_plan.
- `approveProgressions({ planId, progressionPlan })` — advances to complete-pending and triggers Stage 5.

`src/routes/plans.$planId.progressions.tsx`

- Editable table: rows = exercises, cols = Week 2 / Week 3 / Week 4 deltas + dimension + rationale.
- "Approve & build remaining weeks" button.

---

**4. Stage 5 — Deterministic bulk fill (NO AI)**

`src/server/phased/stage5-bulkfill.server.ts` + thin `.functions.ts` wrapper

- Pure JS: load Week 1 days, for each week 2..N clone day content, apply deltas per exercise (delta DSL: +2.5kg, +1rep, +0.5rpe, -5%).
- Bulk insert workout_plan_days rows via single `.insert([...])`.
- Updates generation_state.stage = "complete", generation_status = "complete".
- Target <500ms. Logged in generation_log with model_used="deterministic".
- On success route navigates to existing /plans/:planId.

---

**5. Glue**

- `src/routeTree.gen.ts` — auto-regen on new route files.
- Resume support: each new route checks generation_state.stage on mount; if user lands on /microcycle but state is still brief, redirect back.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_plan_days;` (migration). Replica identity full.

---

**Cost & speed targets**


| Stage          | Calls                | Model  | Wall time                           |
| -------------- | -------------------- | ------ | ----------------------------------- |
| 1 Brief        | 1                    | Haiku  | ~3s                                 |
| 2 Blueprint    | 1                    | Haiku  | ~3s                                 |
| 3a Day 1       | 1                    | Sonnet | ~6s                                 |
| 3b Days 2..N   | N-1 (server-side ×3) | Sonnet | ~10–15s for 4-day week              |
| 4 Progressions | 1                    | Haiku  | ~4s                                 |
| 5 Bulk fill    | 0                    | —      | <500ms                              |
| **Total**      | **5–7**              | &nbsp; | **~25–35s coach-perceived (gated)** |


vs. current ~25–45 min for 48 sequential calls.

---

**Constraints**

- No AI for Weeks 2..N — ever. Stage 5 is pure data.
- Stage 1 reads only section_analyses, never raw assessment.
- Stage 3 day output uses existing FORGE DaySchema → /plans/:planId view unchanged.
- Behind phased_generation_enabled flag — old "Quick generate" untouched.
- Each stage is independently revertible.
- Day-level realtime so coach sees days appear as they complete; no full-response buffering on the client.

---

**Out of scope**

- PDF / design changes.
- i18n sweep beyond strings introduced by new routes.
- Editing Stage 3 exercises inline (review-only; existing /plans/:planId is the editor).

---

**Acceptance**

- Coach with flag on: brief in <5s, blueprint in <10s, Day 1 in <20s, full Week 1 in <40s, full plan persisted in <45s.
- generation_log shows: 1 brief + 1 blueprint + N day rows + 1 progressions + 1 bulkfill (deterministic).
- Re-editing brief invalidates blueprint + microcycle + progressions; coach must re-walk gates.
- A single errored day shows a per-day Retry button and does not block the rest of the batch.
- Old flow (flag off) byte-identical to today.