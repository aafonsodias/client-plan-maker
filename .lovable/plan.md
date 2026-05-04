## Round 36 — Close R35 leftovers, inline Stage 5, honest per-day lock

R35 shipped golden tone, merged Assessment button, Stage 4 auto-approve, and stage rename. What stayed open is what the user actually needs next: Stage 5 still pops a separate page, the microcycle loses approved-day state on regenerate, EN copy still says "Plano-mestre", and the desktop week-matrix never landed. R36 closes those, in this order.

### A. Stage 5 (Progressions) inlined — same pattern as Microcycle
Currently the Stage 5 StageCard's only action is `navigateToStage("progressions")`. Convert it to an inline expandedBody so the trainer never leaves `/clients/$id` from intake → PDF.

- Extract `ProgressionsPanel` from `src/routes/plans.$planId.progressions.tsx` (mirror of MicrocyclePanel: header optional, `onApproved` callback, no own routing).
- In `clients_.$clientId.tsx` Stage 5 block: add `expanded` / `onToggleExpanded` / `expandedBody` like Stage 4.
- `onApproved` for Progressions: `await openPhasedDraft(planId, "complete")`, `void refreshPlans()`, then auto-collapse and surface a single emerald "Plano pronto · Descarregar PDF" CTA (final-stage tone is the only emerald in the journey, per memory).
- Convert `src/routes/plans.$planId.progressions.tsx` to a redirect shell → `/clients/$clientId` (same as we did for brief/blueprint/microcycle in R33).

### B. Per-day approval lock (the "I lost my edits" bug)
Right now any "Regenerate Day N" silently overwrites a day even if the trainer reviewed it. Add an honest lock.

- Migration: `ALTER TABLE workout_plan_days ADD COLUMN approved_at timestamptz;`
- New server fn `approveDay({ planId, dayIndex })` in `src/server/phased/microcycle-edit.functions.ts` — sets `approved_at = now()`.
- New server fn `unlockDay({ planId, dayIndex })` — clears `approved_at`.
- `MicrocyclePanel`: each day-tab gets an amber `Approve day` button when `status==='done' && !approved_at`. Once approved, the regen button becomes `Unlock day` (confirm dialog) before allowing regenerate.
- Auto-approve-microcycle effect (already in R35) only fires when `every day has approved_at`, not just `status='done'`. Removes the silent jump to Stage 5.

### C. Persist & surface assessment richness
The merged Assessment button already shows `% completo`. Now persist that number so it follows the plan into the PDF and into AI prompts later.

- Migration: `ALTER TABLE workout_plans ADD COLUMN assessment_completion_pct int;`
- In `approveBrief` (server fn), compute current assessment coverage and store it on the plan row.
- Surface as a small muted chip on:
  - Plans-list row: `· dados 86%`
  - Plan PDF cover footer: `Riqueza dos dados: 86%`
  - Brief sheet header
- (R37 will use this as a prompt-conservatism factor — out of scope here.)

### D. EN i18n for the renamed stages
R35 renamed PT labels inline. EN still shows "Plano-mestre" / "Semana-tipo" because they were hardcoded.

- Add `plan.json` keys: `stage.label.{1..5}` and `stage.short.{1..5}` (PT + EN).
- Replace the 4 hardcoded `title="Plano-mestre"|"Semana-tipo"|"Progressão 12 sem."` strings in `clients_.$clientId.tsx` with `t("plan:stage.label.3")` etc.
- Update `MicrocyclePanel` header `Stage 4 — Semana-tipo` to use the same key.
- Sweep `lib/plan-status.ts` chip labels to use the new keys.

### E. Desktop weekly-cycle matrix (D1 from R35)
Mobile keeps the current swipe-tab UI. On `lg:` and up, render the matrix the user explicitly asked for.

- New `src/components/WeekMatrix.tsx`:
  - Columns = days (1..sessionsPerWeek), rows = unique exercise names across the week.
  - Cells = `4×8 @ RPE 7.5` or `—`.
  - Approved day column gets the golden gradient header + ✓ chip; per-day approve button at column footer.
  - Click a cell → opens the existing DayCardEditable in a right-side `<Sheet>` for that day, focused on that exercise.
- In `MicrocyclePanel`: render `<WeekMatrix>` inside a `hidden lg:block` wrapper, keep current swipe tabs in `lg:hidden`. Same source data, no duplication.
- Drag/superset, cross-day move, AI inline comments stay parked for R37 (we got burned scoping all of it last time).

### F. Verified-trainer badge (small, last)
- New `src/components/VerifiedBadge.tsx` — small blue check, same Lucide icon set.
- Show next to the trainer name in `/clients/$id` header when `profile.full_name && profile.logo_url && active_clients_count >= 1`. Founder pill stays separate.

### Files touched
- DB: migration adds `workout_plan_days.approved_at`, `workout_plans.assessment_completion_pct`
- `src/components/ProgressionsPanel.tsx` — NEW (extracted)
- `src/components/WeekMatrix.tsx` — NEW
- `src/components/VerifiedBadge.tsx` — NEW
- `src/server/phased/microcycle-edit.functions.ts` — `approveDay`, `unlockDay`
- `src/server/phased/stage3-microcycle.functions.ts` — auto-approve gated on `approved_at` not `status`
- `src/server/phased/stage1-brief.functions.ts` (or wherever `approveBrief` lives) — persist `assessment_completion_pct`
- `src/components/MicrocyclePanel.tsx` — per-day approve/unlock UI, WeekMatrix mount
- `src/routes/clients_.$clientId.tsx` — Stage 5 inlined, i18n keys swapped
- `src/routes/plans.$planId.progressions.tsx` — collapse to redirect shell
- `src/i18n/locales/{pt,en}/plan.json` — `stage.label.*`, `stage.short.*`
- `src/lib/plan-status.ts` — i18n keys
- `src/lib/pdf.ts` — richness footer
- `.lovable/backlog.md` — close R35 leftovers, open R37

### Out of scope (parked)
- Drag-and-drop / supersets in WeekMatrix (R37)
- AI inline comment-on-edit (R37)
- Cross-week duplication (R37)
- Using `assessment_completion_pct` to weight prompts (R37)
- FITT-VP backbone #45 (still parked at the top of P0 backlog — bigger round)
