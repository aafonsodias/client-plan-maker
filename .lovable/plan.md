## What we're fixing

Three workstreams plus the in-flight tier/PDF/log work:

1. **Dashboard polish** — recent-plan rows are missing the delete icon and the status pill is colourless (READY/DRAFT both grey).
2. **Session view density** — vertical whitespace between Day header → Warmup → Activation → Main work and inside the Warmup list itself is too generous on a 700px viewport.
3. **Mesocycle table — the real fixes** — make it copy-pasteable, inline-editable, surface RPE clearly, and (most importantly) **diagnose & fix why W2–W4 are identical to W1**.

Then continue: compact log table, landscape PDF redesign, finish localising the progress strip.

---

## 1. Dashboard recent-plans list

`src/routes/dashboard.tsx` lines 116–133 render rows with only the plan title and a flat grey pill (`bg-secondary`).

- Replace the inline `<span>` with `planStatusInfo(p, t)` from `src/lib/plan-status.ts` — that helper already returns coloured chips (emerald for READY/finalized, neutral for draft, grey for in-progress stages). Same chip already used on the plan editor header.
- Add a `Trash2` icon button on the right (mirrors `src/routes/plans.index.tsx:146`) wired through an `AlertDialog` (don't use `window.confirm`). Place chip + delete in a flex row so the row layout is `title/client | chip | delete`.
- Card click still navigates to the plan; the delete button must `e.stopPropagation()` and `e.preventDefault()` so it doesn't bubble to the `<Link>`.

**"Add a chart/data?"** — keep it lean; the dashboard already has DropoffAlerts and stat cards. Proposing **one** small addition only: a *Plans by status* mini bar (Draft / Ready / Finalised) computed from the same recent fetch, rendered as three thin coloured bars under the stat cards. No new dependency. Skip if you'd rather defer.

## 2. Session/Day view spacing trim

`src/components/SessionDayView.tsx` — current rhythm:

- `header` `pb-3` then divider, then `mt-3` rationale → fine.
- `WARMUP/ACTIVATION/DYNAMIC` cluster: `mt-6 space-y-6` (96 + 96 px gaps).
- `Main work`: `mt-10` (40 px).
- Inside `PrepSection`: header → `ul mt-3` and `gap-2` items.

Tighten to:
- Cluster wrapper: `mt-4 space-y-3` (was `mt-6 space-y-6`).
- `MainSectionHeader` spacing: `mt-6` (was `mt-10`) and inner `mt-2` (was `mt-3`).
- `PrepSection` list: `mt-2 gap-1.5` (was `mt-3 gap-2`); reduce item `py-2` → `py-1.5`.
- `Cooldown` and `Optional finisher` blocks: `mt-6` (was `mt-10`).

Net effect: ~24–32 px shaved per section without crowding the heavy main-work block.

## 3. Mesocycle table — the meat

### 3a. Why W2–W4 look identical (root cause)

`src/server/phased/stage5-bulkfill.functions.ts` *does* apply progression deltas (load/reps/sets/rpe) when copying W1 sessions into W2…N. So if the table cells are identical across weeks for an existing plan, one of these is true:

1. The plan was finalised **before** Stage 4 (Progressions) ran or with an empty `progression_plan.rows` → bulkfill copied W1 verbatim.
2. The progression plan only changed `load`/`tempo` (which we don't show in the table — we only render `sets/reps/rpe/rest`).

**Fixes:**
- In `MesocycleTableView`, also display the `notes`/load delta when present (cell shows `3×8 @7 · +2.5kg` if the exercise's `notes` carries the load tag from `applyDelta`). Render load as a small chip.
- Add an empty-state banner above the table when every W2+ cell equals W1: *"No progression deltas were applied to this plan. [Re-run progressions]"* button → links to `/plans/$planId/progressions`. This makes the silent failure visible.
- Always render the RPE column even when blank — show a dim `@—` so the trainer sees the gap and can fill it in (today missing RPE is invisible).

### 3b. Make the table copy-pasteable

- Wrap the `<table>` so it's selectable as plain text (already is via browser select-all on the table). Add a small "Copy as TSV" button next to the Compact toggle that builds a tab-separated string `Day\tExercise\tW1\tW2\tW3\tW4` and writes to `navigator.clipboard.writeText`. Pasting into Sheets/Excel will land cleanly in cells.
- Also offer "Copy as Markdown" (pipe table) for trainers who paste into Notion/WhatsApp.

### 3c. Inline editing

Make every cell editable:
- Click the cell → it swaps to a tiny inline editor with three fields (sets, reps, rpe) and a rest input below; pressing Enter or blurring saves. Use the existing pattern from `DayCardEditable`.
- Persistence: call a new server fn `updateExerciseInWeek({ planId, weekNumber, dayLabel, exerciseIndex, patch })` that updates the matching row in `workout_plan_days.content.exercises[i]`. Keep it RLS-scoped.
- Add a thin "side panel" (Sheet) toggle: when open, the selected exercise shows full editable fields (tempo, notes, technique cues) — this gives the trainer the "instructions on the side" pattern they asked about.
- Dirty state: cells touched in the current session get a faint amber dot until saved.

### 3d. Other audit findings I noticed

- `dayGroups` matches W2+ exercises by `name`. If Stage 5 ever swapped a `complexity_variant` (e.g. "Goblet squat → Front squat W3"), the cell would show `—`. Fall back to index match (already done) but also surface a "(swapped)" tag when the resolved exercise's name differs from baseline.
- `weekTotals` reps math treats AMRAP as 0 → totals look artificially low for any AMRAP-heavy day. Treat AMRAP as 8 reps for estimation and show a `~` prefix (already prefixed, good — just fix the count).
- Deload heuristic is currently "last week of 3+". Pull the real `progression_plan.deload_week` if present in `blueprint.progression_model_proposal`; fall back to the heuristic.

## 4. Continuing the previously approved scope

Still owed from last turn:

- **`SessionLogTable`** — matrix view for the Log tab (one row per exercise, columns = sets done, reps done, RPE done, with quick-toggle done/partial/missed at the row level). Replace card view in Log mode (keep cards behind the Detailed toggle).
- **PDF rewrite** — `src/lib/pdf.ts` to landscape A4 with one mesocycle matrix per archetype + a single summary page; remove the per-session double pages.
- **i18n** — finish localising the progress strip strings in `src/routes/plans.$planId.microcycle.tsx` (currently has hard-coded PT) and add EN copies in `src/i18n/locales/en/plan.json`.

---

## Technical surface (file-level)

- `src/routes/dashboard.tsx` — chip via `planStatusInfo`, add delete `AlertDialog`, optional status mini-bar.
- `src/components/SessionDayView.tsx` — spacing tokens (`mt-*`, `space-y-*`, `gap-*`, `py-*`) only.
- `src/components/MesocycleTableView.tsx` — empty-deltas banner, always-show RPE column, load chip, "Copy TSV/MD" buttons, cell click → inline editor, side panel; AMRAP fix; swap tag.
- `src/server/phased/stage5-bulkfill.functions.ts` — no logic change; just a server fn `updateExerciseInWeek` added to `src/server/phased/microcycle-edit.functions.ts` (new file) so we don't bloat existing files.
- `src/components/SessionLogTable.tsx` — new.
- `src/lib/pdf.ts` — landscape rewrite, separate commit.
- `src/i18n/locales/{en,pt}/plan.json` — progress strip keys.

## Out of scope this round

- Tier override UI is already shipped; no further changes.
- Stage 2/3 prompt tweaks — leave alone unless the empty-deltas banner shows up on every plan, in which case we revisit Stage 4.
- Charts in dashboard beyond the optional mini-bar.

Reply **approve** to ship; or tell me which sections to drop (e.g. "skip the side panel, just inline cells" or "skip the dashboard mini-bar").