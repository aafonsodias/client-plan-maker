# Polish phased plan flow: drafts, sync, save, layout, viz

The user surfaced ~10 distinct issues across 4 stages. Grouped into 5 themed steps so each is testable and reversible.

---

## Step 1 — "Draft exists" awareness on Stage cards (client page)

**Problem:** Stage 2 card always says "Gerar Blueprint" even when a draft already exists in DB. Same will apply to Stage 3 (microcycle days) and Stage 4 (progressions).

**Fix in `src/routes/clients_.$clientId.tsx` (around line 1909–2034):**
- When loading the plan, also pull `blueprint`, `progression_plan`, and a count of `workout_plan_days` rows.
- Compute three new flags per plan: `hasBlueprintDraft`, `hasMicrocycleDraft` (≥1 row), `hasProgressionsDraft`.
- Card label/CTA logic:
  - `approved` → "Abrir"
  - `draft && !approved` → "Ver draft" (secondary style) + small "Continuar" arrow
  - else → "Gerar Blueprint →" (current behaviour)
- Clicking "Ver draft" navigates to the same route but does NOT call `runStage()` (no regenerate).

**Acceptance:** Returning to the client page after partial work shows "Ver draft" on every stage that already has data, and clicking it goes to the existing draft without triggering a regenerate.

---

## Step 2 — Blueprint UX: matrix sync + better width + progression visualisation

**Problems:** (a) Reordering archetypes does not refresh the matrix labels; (b) Week × Day matrix scrolls horizontally needlessly; (c) Progression model is just a `<select>` with no explanation; (d) Right rail scrolls; (e) "Pedir à IA" + "Approve → Day 1" buttons stack badly in the header.

**Fix in `src/routes/plans.$planId.blueprint.tsx`:**

1. **Matrix sync** — already wired via state (selects re-read `blueprint.session_archetypes`); confirm by adding a `key` derived from `archetypes.map(a=>a.id).join('|')` to the `<tbody>` so React re-renders option lists after a drag. Also when an archetype `id` is renamed, run a one-shot pass on `week_to_session_map` to rewrite old IDs in place (so the matrix doesn't go red on rename).

2. **Vertical Week × Day** — replace the horizontal `Week | D1 | D2 | D3 | …` table with **one card per week**, each showing days stacked (label above select). Cards arranged as a responsive grid (`grid grid-cols-1 md:grid-cols-2`) so 4 weeks fit without horizontal scrolling.

3. **Progression model picker** — replace the `<select>` with three cards (Linear / Undulating / Block), each containing:
   - A small inline SVG diagram (load-vs-week trend) drawn as a tiny line chart (no external dep needed; ~30 LOC).
   - Two-line "When to use" + one-line "Why for this client" pulled from `blueprint.progression_model_proposal.rationale`.
   - Click to select (highlighted ring).

4. **Right rail compactness** — in `BriefContextRail.tsx` reduce vertical paddings, collapse the long "Movement competency" bullets into an accordion (closed by default), and bump rail width to `w-96` only on `2xl`. Goal: full content visible at 1611×984 without scrolling.

5. **Header layout** — move "Approve → Day 1" to its own row aligned right, with `Brief / Pedir à IA / Regenerate` in a secondary toolbar above. Use `flex-col gap-2 sm:flex-row sm:justify-between sm:items-start`.

6. **"Pedir à IA" affordance** — add tooltip + helper text inside the Sheet header: "Pede para reequilibrar volume, trocar archetypes, justificar o modelo de progressão, ou ajustar a matriz semana × dia."

**Acceptance:** Reordering an archetype updates the matrix selects immediately. The matrix no longer requires horizontal scroll at 1280px+. Three progression-model cards render with a load-vs-week sparkline and selectable rings. Right rail visible without scroll at the user's viewport. Header buttons no longer overlap.

---

## Step 3 — Microcycle: editable Day 1, one-day-at-a-time, persistence guarantee

**Problems:** (a) Day 1 fields are read-only when "approve gate" is shown; (b) clicking "Approve Day 1" generates ALL remaining days at once; (c) days sometimes vanish on reload.

**Fix in `src/routes/plans.$planId.microcycle.tsx`:**

1. **Editable Day 1** — extract a `DayCardEditable` view that allows inline editing of name/sets/reps/RPE/rest/cue/rationale per exercise (already saved to `workout_plan_days.content` via a debounced `supabase.update`). Always editable, regardless of `isGate`.

2. **One-day-at-a-time generation** — replace `approveDay1AndContinue` (which calls `generateMicrocycleDays` for ALL remaining days) with:
   - Approve Day 1 only marks Day 1 approved locally.
   - Render each subsequent day as a placeholder card with a "Gerar Day N" button.
   - Provide a separate "Gerar todos os restantes" secondary button for users who want the old batch behaviour.

3. **Persistence** — days are already persisted on insert in `upsertDayRow`. The "vanish" issue is from the auto-fire `useEffect` at lines 110–118 that re-kicks Day 1 if `days.find(...)` returns nothing during the brief load gap. Fix by waiting for the first realtime/load round-trip (track `daysLoaded` flag) before evaluating the auto-fire condition. Also add `await loadDays()` before kick to avoid double generation.

4. **Approve microcycle gate** — only enable `Approve microcycle` when `done` count equals `sessionsPerWeek` AND no day is `error`/`pending` (already the case for `done`, but add error guard).

**Acceptance:** Day 1 exercises are editable and edits persist (reload preserves them). Clicking "Approve Day 1" does NOT auto-generate Days 2–N; each day has its own Generate button. After full reload of the page, no day disappears or re-generates.

---

## Step 4 — Progressions: layout + delta visualisation

**Problems:** (a) Regenerate button overlaps the title; (b) only a sparse table is shown; (c) graphs are missing.

**Fix in `src/routes/plans.$planId.progressions.tsx`:**

1. **Header spacing** — same pattern as Step 2.5: stack `Regenerate` + `Approve & build remaining weeks` on their own row below the title with `flex-col gap-2 sm:flex-row`.

2. **Per-row mini graph** — for each `ProgressionRow` whose `dimension` is `load`/`reps`/`sets`/`intensity_rpe`, render a tiny inline sparkline (W1 baseline, W2/W3/W4 cumulative deltas parsed as numbers when possible — fall back to "qualitative" pill when not numeric). ~50 LOC SVG, no library.

3. **Group by exercise** — collapse rows by `exercise_id` so each exercise gets one collapsible card with all its dimensions inside (load + reps + RPE under one heading), and one combined chart per exercise.

4. **Sticky right rail consistency** — apply the same Step 2.4 compactness to this route (already shares `BriefContextRail`).

**Acceptance:** Regenerate button no longer touches the title at any viewport. Each exercise renders one card with a small per-week trend SVG plus the editable delta inputs. Page is meaningful even when deltas are qualitative ("+2.5kg" / "RPE+0.5").

---

## Step 5 — Auth page polish: language switcher placement

**Fix in `src/routes/auth.tsx`:** Move `<LanguageSwitcher />` from the top-right corner into the bottom-right of the auth card (or under the "Continuar com Google" divider as a small inline `pt | en` link). The corner placement is what bothers the user.

**Acceptance:** Language switcher is no longer in the top-right viewport corner; it lives near the auth card footer with the same functionality.

---

## Out of scope (acknowledged, deferred)

The user also flagged two **content-quality** issues that are NOT layout bugs:
- "Way too much volume for week 1 day 1" — needs a prompt/safety-rules tweak in `stage3-microcycle.functions.ts`.
- "Workouts are missing warmup/dynamic stretches/inhibition/activation/cooldown/vibrating plate/deadhang/time-stretching" — schema already has `warmup`/`activation`/`dynamic_stretches`/`cooldown`, so this is also a prompt issue.

I will NOT touch these in this loop because (a) prompt tuning needs its own evaluation pass, (b) the user said "we need to work on that later imho". I'll leave a TODO in the file header.

---

## Technical notes

- **Files edited:** `src/routes/clients_.$clientId.tsx`, `src/routes/plans.$planId.blueprint.tsx`, `src/routes/plans.$planId.microcycle.tsx`, `src/routes/plans.$planId.progressions.tsx`, `src/routes/auth.tsx`, `src/components/BriefContextRail.tsx`.
- **Files created:** `src/components/ProgressionModelPicker.tsx` (3 cards + SVG sparklines), `src/components/WeekMatrixGrid.tsx` (vertical week cards), `src/components/ProgressionRowChart.tsx` (per-exercise sparkline), `src/components/EditableDayCard.tsx` (editable Day 1 view).
- **No new deps** — sparklines drawn as raw SVG.
- **No DB migrations.** Drafts are detected via fields already on `workout_plans` and rows already in `workout_plan_days`.
- **Persistence fix** is a state-machine bugfix (`daysLoaded` guard) — safe and small.

## Rollback

Each step is in its own file/component. `git revert` the feature commit; no migrations to undo; remove the four new components if Step 2/3/4 visualisations need to be reverted.

---

## Optimised prompt (for future similar requests)

```
GOAL:
Polish the phased plan flow so drafts are visible, the Blueprint matrix
syncs with archetype edits, Day 1 is editable and generated one day at a
time, and Progressions show graphs.

CONTEXT:
- Stage card: src/routes/clients_.$clientId.tsx (StageCard list ~L1900)
- Routes:    src/routes/plans.$planId.{blueprint,microcycle,progressions,brief}.tsx
- Auth:      src/routes/auth.tsx
- Rail:      src/components/BriefContextRail.tsx
- Schemas:   src/server/phased/schemas.ts

TASK:
1. Stage cards on client page show "Ver draft" when DB already has draft.
2. Blueprint: matrix re-syncs on archetype reorder/rename; vertical week
   cards instead of horizontal table; progression model = 3 cards with
   SVG sparkline + rationale; right rail no-scroll; header buttons stack.
3. Microcycle: Day 1 editable; per-day Generate button (no auto-batch);
   guard against double Day-1 kick; ensure days persist across reload.
4. Progressions: header spacing fix; per-exercise card with SVG trend
   chart; group rows by exercise.
5. Auth page: move language switcher out of top-right corner.

CONSTRAINTS:
- No prompt/AI behaviour changes (deferred).
- No DB migrations.
- No new deps; sparklines as raw SVG.
- Reuse existing UI primitives.

ACCEPTANCE:
- "Ver draft" CTA on all stages with existing data.
- Matrix updates instantly after dnd reorder.
- Day 1 editable + saved; only requested days generate.
- Per-exercise trend chart on /progressions.
- Auth language switcher relocated.

ROLLBACK:
- git revert feature commits; no migrations.
```
