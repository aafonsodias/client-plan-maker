## Goals

Fix six issues, ordered by impact:

1. After **bulk-fill** ("Approve & build remaining weeks") the user lands on the legacy editor showing "Summary (empty) / No weeks yet" because the new phased flow stores days in `workout_plan_days`, not in `plan_data.weeks`. We need a real "plan complete" view that reads from `workout_plan_days`, lets the user export PDF, and is what the redirect lands on.
2. The assessment page in `clients_.$clientId.tsx` (line 1745) still says **"Continuar para Blueprint"** even when the plan is past Stage 4. Button should reflect the *actual* current stage of the inline brief's plan (Blueprint / Microcycle / Progressions / Open plan).
3. **Progression deltas** — most rows render in the default muted color. Only `d3_pull_ups` pops because its sparkline goes up. Make every delta input + sparkline visually meaningful: color-code positive vs zero vs negative deltas and bold the input value.
4. **Exercise nametags** (`d1_barbell_bench_press`) are technical IDs. Render a friendly name (e.g. "Day 1 · Barbell Bench Press") with the slug as a smaller subtitle.
5. Add a **"How to read these deltas" guide** at the top of the Progressions page (collapsible info panel, PT/EN).
6. **Auth page** — square logo: add the platinum/fiery effect *behind* the logo block (a glowing/translucent square plate), not on the symbol. Add a clear **"Back to home"** button on the auth page.
7. Landing page header: replace the **"Preço"** text link with a small `$` icon button (still anchors to `#pricing`).

## Technical Plan

### 1. Real "plan complete" view (highest priority — unblocks PDF export)

Edit `src/routes/plans.$planId.tsx`:

- Extend the stage redirect map so `"complete"` does **not** redirect away — the base `/plans/$planId` route IS the complete view.
- When `generation_state.stage === "complete"` (or `generation_status === "complete"`), bypass the legacy "weeks from plan_data" rendering and instead:
  - Load from `workout_plan_days` ordered by `week_number, day_number`.
  - Build a `PlanData` object on the fly: `{ weeks: [{ week_number, focus, days: [{ day_label, focus, exercises: content.exercises }] }] }`.
  - Feed that synthesized `data` into the existing `ViewMode` and `exportPdf` so PDF export works again.
- Keep the existing legacy editor for plans where `generation_state` is null.

Also: in `stage5-bulkfill.functions.ts` we already set `generation_state.stage = "complete"`. Double-check the toast on the progressions page navigates to `/plans/$planId` (it does) — no change needed there.

### 2. Dynamic CTA on assessment page

In `src/routes/clients_.$clientId.tsx` around line 1738, replace the hard-coded `"Continuar para Blueprint"` with a function that picks label + route from `inlineBrief.stage` (or refetched `generation_state.stage`):

```text
brief        → "Continuar para Blueprint"  → /plans/$id/blueprint
blueprint    → "Continuar para Microciclo" → /plans/$id/microcycle
microcycle   → "Continuar para Progressões" → /plans/$id/progressions
progressions → "Rever progressões"          → /plans/$id/progressions
complete     → "Abrir plano"                → /plans/$id
```

Add EN equivalents to `i18n/locales/{pt,en}/plan.json` under `generate.continue_to_*`.

### 3. Color-coded progression deltas

In `src/components/ProgressionExerciseCard.tsx`:

- Compute sign of each parsed delta. Apply a class on the `<input>`:
  - positive → `text-emerald-400 font-semibold`
  - negative → `text-rose-400 font-semibold`
  - zero/empty → `text-muted-foreground`
- Make the sparkline color match the cumulative trend direction (up=green, down=red, flat=muted) instead of dimension color, so trend is the dominant signal.
- Bump input from `text-xs` → `text-sm` and tabular-nums for alignment.

### 4. Friendly exercise names

In `ProgressionExerciseCard.tsx` accept a `displayName` prop. In `plans.$planId.progressions.tsx`, when grouping rows by `exercise_id`, also resolve a display name by looking up the original Week-1 exercise (the page already loads them implicitly via the brief rail — we'll just parse the slug):

- Slug format is `d{N}_{snake_case_name}`. Split → "Day N · Title Case Name".
- Render at the top of the card: bold "Day N · Bench Press" with the raw slug below in a tiny mono muted line (so power users still see the ID).

### 5. "How to read these deltas" guide

Add a collapsible info panel at the top of the Progressions page:

```text
- W2/W3/W4 = the change applied that week vs Week 1.
- "+2.5kg" = add 2.5kg to the working load.
- "+1rep" = aim for one extra rep per set.
- "+0.5rpe" = push 0.5 RPE harder (closer to failure).
- "" (empty) = no change that week (deload or hold).
- Conservative > aggressive: when in doubt, lower the delta.
- The trend sparkline shows cumulative change W1→W4.
```

Localize PT/EN under a new `progressionsGuide` block.

### 6. Auth page square plate + Back to home

In `src/routes/auth.tsx`:

- Add a Back-to-home link in the top-left corner of the page (small ghost button with `ArrowLeft` icon, label "Voltar à página inicial" / "Back to home", `<Link to="/">`).
- Move the platinum/fiery effect from around the logo symbol to a **square plate** behind the logo: replace the circular halo with a rounded-square gradient surface (~120×120) carrying the conic platinum sheen + soft amber glow; the symbol sits cleanly on top with its own current drop-shadow only.

### 7. Landing header `$` button

In `src/routes/index.tsx` (header nav, line ~37): swap the `Preço` text anchor for an icon-only button: a `DollarSign` lucide icon inside a `ghost` `size="icon"` Button that anchors to `#pricing`, with `aria-label` from the existing `pricing.nav_link` translation.

### Files touched

```text
src/routes/plans.$planId.tsx                  (synthesize PlanData from workout_plan_days when complete)
src/routes/clients_.$clientId.tsx             (dynamic CTA per stage)
src/routes/plans.$planId.progressions.tsx     (guide panel + friendly names)
src/components/ProgressionExerciseCard.tsx    (color-coded deltas, friendly title)
src/routes/auth.tsx                           (back button + square plate effect)
src/routes/index.tsx                          ($ icon nav button)
src/i18n/locales/pt/plan.json                 (continue_to_*, progressionsGuide)
src/i18n/locales/en/plan.json                 (same)
src/i18n/locales/pt/common.json               (back_to_home)
src/i18n/locales/en/common.json               (back_to_home)
```

No DB migrations, no schema changes, no new packages.

Approve and I implement in one pass, starting with #1 (the blocker for PDF export).