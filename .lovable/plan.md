## Round 5A — Close the feedback loop visually

The pipeline already stamps `generation_meta.block_feedback` (a `BlockSummary` from `summarizePriorBlock`) onto every Block N+1. Today this data is invisible: the only surface is the free-text `block_transition_summary`. This round exposes the verdicts, adherence, and resulting volume shifts inside the existing UI.

### What the user will see

1. **Block report card** inside `BlockTransitionDialog` — shown above the editable summary when computing the suggestion. Lists per-muscle: prior adherence %, mean RPE, verdict chip (sob-recuperação / no alvo / sub-carregado), and the prescribed shift ("MAV teto 14 → 11").
2. **Adaptation strip on the plan header** for any plan with `prior_plan_id` set. Compact row of muscle chips coloured by verdict, click opens a popover with the same report card (read-only).
3. **VolumeStatusTable annotations** — when the active plan was downshifted on a muscle, the row gets an amber "↓ ajustado por bloco anterior" badge and the tooltip explains why.
4. **YearView block boundaries** — the block-map table gains a "Adaptação" column with the verdict mix (e.g. "3 sob-rec · 5 alvo · 2 sub-carga"); chart x-axis ticks at block boundaries get an amber/emerald dot matching the dominant verdict.

### Files to create

- `src/lib/block-adaptation.ts` — pure helpers:
  - `computeAdaptationShift(verdict, landmark)` returning `{ startSets, ceilingSets, inflection }` (mirrors logic already in `prescribe-volume.ts` so the UI shows exactly what the prescription used).
  - `summarizeAdaptation(blockFeedback)` returning per-muscle `{ muscle, verdict, adherencePct, meanRpe, priorMAV, newCeiling, delta }`.
  - `dominantVerdict(blockFeedback)` for the YearView dot colour.
- `src/components/BlockAdaptationCard.tsx` — presentational card consuming `summarizeAdaptation` output. Two variants via prop: `compact` (chip strip) and `full` (table with shifts and tooltips). Reuses `toneChip`/`toneDot` from `status-tone.ts`.

### Files to edit

- `src/components/BlockTransitionDialog.tsx` — fetch prior plan's feedback (extend `computeTransitionSummary` server fn to also return `blockFeedback`) and render `<BlockAdaptationCard variant="full" />` above the textarea.
- `src/server/blocks-manual.functions.ts` — `computeTransitionSummary` returns `{ summary, blockFeedback }` (additive; existing callers ignore extra field).
- `src/routes/plans.$planId.tsx` — when `plan.prior_plan_id` exists, render the existing "Bloco N · evoluiu" chip with a popover trigger that shows `<BlockAdaptationCard variant="full" />` populated from `plan.generation_meta.block_feedback`.
- `src/components/volume/VolumeStatusTable.tsx` — accept optional `adaptation?: ReturnType<typeof summarizeAdaptation>` prop; when a row's muscle has `verdict === "under_recovered"` or `"under_loaded"`, append the badge + extend the tooltip text. Backward compatible (prop optional).
- Callers of `VolumeStatusTable` (likely in `plans.$planId.tsx` / blueprint view) — pass the adaptation summary when available.
- `src/components/YearView.tsx` — extend the block-map table with the "Adaptação" column; add the verdict dot to the block-boundary annotations on the adherence chart.

### Technical notes

- No DB migration needed — `block_feedback` already lives in `workout_plans.generation_meta`.
- `computeAdaptationShift` must stay in lockstep with `prescribe-volume.ts`. Extract the shared shift math into `block-adaptation.ts` and have `prescribe-volume.ts` import from it (single source of truth) — silently divergent UI vs prescription would be worse than no UI at all.
- All copy in PT-PT, matching existing tone ("sob-recuperação", "sub-carregado", "no alvo").
- No new colours — verdicts map onto the existing `status-tone` palette: `under_recovered → warn`, `on_target → success`, `under_loaded → neutral` (it's not a problem, it's headroom).
- Compact strip on the plan header is purely additive; if `block_feedback` is missing on a legacy plan, it falls back to the current "evoluiu" chip without the popover.

### Out of scope (separate rounds)

- Wiring real (non-demo) `workout_sessions` into `block-feedback` (Direction B).
- Background runner hardening (Direction C).
- Quota policy for Block N+1 (Direction D).

Approve to implement.