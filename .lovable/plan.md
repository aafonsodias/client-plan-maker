
# Round 37 — Stage 5 inline, honest empty states, polished finale

You're hitting four real bugs and several copy/UX rough edges. The biggest one explains the rest:

**Why "A gerar Progressions…" never finishes and Stage 5 never opens**
`/plans/$planId/progressions` was converted to a redirect-back-to-client shell in R34 (no UI left there). But Stage 5 still tries to *navigate* to it after generation — so the panel bounces back to the client page, the loading toast clears, and the new `progression_plan` is silently in the DB with no surface to view. The "deltas waiting for approval — open to review" copy then lies (there's no review screen). Inlining Stage 5 the same way Stages 3 & 4 are inlined fixes all three symptoms at once.

## Scope

### A. Inline Stage 5 (Progressions) — kills the bounce-redirect bug

- New `src/components/ProgressionsPanel.tsx` mirroring `MicrocyclePanel`'s shape:
  - Loads `workout_plans.progression_plan` + Week-1 `workout_plan_days`.
  - If empty: "Gerar progressões" CTA → `proposeProgressions({planId})`.
  - Renders one row per Week-1 exercise using existing `ProgressionExerciseCard` (W2/W3/W4 deltas, RPE, rationale).
  - Per-row "regenerate this exercise" stays out-of-scope (R38).
  - Bottom CTA "Aprovar progressões" → `approveProgressions({planId, progressionPlan})`. On success calls `onApproved()`.
- In `clients_.$clientId.tsx` Stage 5 `StageCard`:
  - Add `expanded` / `onToggleExpanded` / `expandedBody` exactly like Stage 4.
  - `expandedBody` mounts `<ProgressionsPanel planId onApproved={...}/>`.
  - `onApproved`: refetch via `openPhasedDraft(planId, "complete")`, `void refreshPlans()`, auto-collapse Stage 5.
  - Once `progressionsApproved`: the collapsed amber strip shows; below the stages we render a new emerald **"Plano pronto · Descarregar PDF"** CTA card.
- Remove the four `navigate({to:"/plans/$planId/progressions"...})` calls from the Stage 5 / runStage paths. The `plans.$planId.progressions.tsx` redirect file stays (back-compat for old bookmarks) but is no longer reached from in-app code.

### B. Honest progress + no PT/EN mix

- Replace the `"A gerar Progressions…"` toast literal with `t("plan:detail.stage.toast.generating_progressions", "A gerar progressões…")` and add equivalent EN key. Same for Blueprint / Microcycle toasts that still mix languages.
- The `StageCard` "generating" state already has a slow indeterminate progress bar (R36). We extend it: while `stageBusy === "progressions"`, surface step labels via `progressLabel` that walk through `"A ler microciclo…" → "A escrever ondas RPE…" → "A validar volume…"` on a 6s rotation (pure cosmetic; the underlying call is one shot but the user explicitly asked for honest, slow-feeling progress).

### C. Single Assessment row, unified expanded look

Today the page renders two amber rows: the merged AssessmentSection chip ("Assessment · 86% completo … VER SÍNTESE") **and** the standalone `"Avaliação parcial · 86% — brief aprovado com dados incompletos"` strip below it. They say the same thing.

- Delete the standalone "Avaliação parcial" strip block (around L2255-2259). The "X% completo" already lives in the merged chip.
- When expanded, the AssessmentSection currently uses one border but its inner sub-cards (PAR-Q+, Risk strat., …) are styled with their own heavy borders and a separate "Show all / Collapse Assessment" header that visually feels like a second card. Tighten the inner styling so the whole expanded form sits inside a single amber-bordered shell:
  - Drop the inner `border` on each section block; keep just a `border-b border-border/40` divider.
  - Move the "Collapse Assessment" toggle into the header row of the same outer card (right side, ghost button) instead of floating as a second pill.
  - When collapsed, the chip is visually identical to today (already pretty).

### D. Plans section: don't render when empty, dignified naming, finale CTA

Today "Plans" + "New plan (manual)" + "Evoluir do último (IA)" header always renders, even with zero plans, and even when the only plan is the still-in-progress phased draft.

- Hide the entire `<section>` (header + grid) when `plans.length === 0`.
- Rename header `"Plans"` → `t("plan:detail.plans.finale", "Plano final")` (PT) / `"Final plan"` (EN). One plan = one header word; "Plans" felt like a list of drafts.
- Rename `"Evoluir do último (IA)"` → **"Gerar próximo bloco (IA)"** with hover tooltip `"Arquiva o plano atual e usa-o como base para gerar o bloco seguinte com IA."` Same handler.
- For each plan row whose `generation_state.stage === "complete"`, replace the right-side `STAGE: PROGRESSIONS` chip with an emerald **"Descarregar PDF"** button (existing `renderPlanPdf` flow).
- Above the finale section, when `progressionsApproved && plans.length > 0`: show a one-liner emerald banner card "Plano pronto para entregar — descarrega o PDF abaixo." (single source of joy, replaces the misleading "deltas waiting for approval" copy which is gone with point A).

### E. Backlog hygiene

- Mark R37 closed in `.lovable/backlog.md`.
- Move to P1: drag-and-drop in WeekMatrix, AI inline comments, FITT-VP backbone (#45), per-row "regenerate this exercise" in ProgressionsPanel.

## Out of scope (parked for R38)

- Desktop weekly-cycle matrix (D1) — still parked.
- Per-row regenerate inside ProgressionsPanel.
- PDF richness footer using `assessment_completion_pct`.
- Verified-trainer badge (R36 D was deferred and stays deferred).

## Files touched

- **new** `src/components/ProgressionsPanel.tsx`
- `src/routes/clients_.$clientId.tsx` — Stage 5 inlined, drop `Avaliação parcial` strip, rename Plans section, hide when empty, finale CTA, "Gerar próximo bloco (IA)" rename, drop progressions-route navigate calls.
- `src/components/StageCard.tsx` — accept rotating `progressLabel` array (cosmetic walk-through).
- `src/i18n/locales/{pt,en}/plan.json` — new keys: `detail.plans.finale`, `detail.plans.evolve_help` (rewrite), `detail.stage.toast.generating_progressions|blueprint|microcycle`, `detail.stage.progressions_steps[]`, `detail.finale.ready_banner`, `detail.finale.download_pdf`.
- `.lovable/backlog.md`

## Acceptance checklist

1. Approve Stage 4 → Stage 5 expands inline, no navigation, no white screen on refresh.
2. Click "Gerar progressões" → progress bar + rotating labels → panel renders deltas → Approve → emerald collapsed strip + "Plano pronto · Descarregar PDF" appears.
3. Refresh page mid-generation: lands back on the same client page (no white screen, no /progressions redirect bounce).
4. Page with zero plans renders no "Plano final" section.
5. Only one Assessment row exists at all times (collapsed = chip, expanded = unified amber shell).
6. No PT/EN mixed strings in toasts or stage labels.
7. Hovering "Gerar próximo bloco (IA)" shows the new tooltip.
