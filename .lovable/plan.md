# Plan — fix items 1, 2, 3 (no work on 4–17)

## 1. Inline brief review on the client detail page

Goal: "Generate plan draft" never navigates. After synthesis, the brief renders directly below the button as an editable, collapsible card with an "Approve brief" action. When approved, the card collapses into a thin strip and a placeholder for Stage 2 appears below it. Each subsequent stage will follow this same stacking pattern.

Architecture decision — generic StageCard wrapper

Do not hand-roll the collapse/expand/approve UI on the brief panel only. Build a reusable <StageCard> component now so Stages 2–5 drop in without rewriting layout logic.

src/components/StageCard.tsx (new file)

- Props: stageNumber, title, status ("generating" | "ready" | "approved"), onApprove, onRegenerate, onExpand, defaultCollapsed, children.

- Renders three states:

  - generating: spinner + "Generating…" placeholder, no children.

  - ready (expanded): full card with title, children (the editor), Regenerate + Approve buttons.

  - approved (collapsed): thin strip "Stage N — {title} approved ✓" with a chevron to re-expand.

- Click on the collapsed strip re-expands children in read-only mode (no Approve button when already approved, but Regenerate still available — regenerating reverts approval state and invalidates downstream stages, server-side already handles this via clearDownstream).

src/routes/clients_.$clientId.tsx

- Remove the toast-based "Review brief →" banner (briefReady state and the Link block at lines 1454–1475).

- Add new state: stages: { brief: { planId, data, approved } | null, blueprint: null, microcycle: null, progressions: null }.

- Replace the "Generate plan draft" click handler:

  - Call startPhasedPlanFn with a loading toast.

  - On success, fetch workout_plans.brief for the returned planId. Parse with BriefSchema. Set stages.brief = { planId, data, approved: false }. Success toast (no link).

  - On failure, error toast.

- On mount, if there is an in-progress phased plan for this client (reuse the same query startPhasedPlanFn uses), hydrate stages from the DB so reloading the page restores the inline view exactly where the coach left off. This is required — without it, refreshing loses the stack.

- Below the action row, render the stages stacked vertically:

  - <StageCard stageNumber={1} title="Brief"> wrapping <BriefEditor>

  - <StageCard stageNumber={2} title="Blueprint" status="placeholder"> — empty stub until Stage 2 ships

  - same for 3, 4

src/components/BriefEditor.tsx (new file)

- Move BriefEditor, Card, Field, NumInput helpers and the <style> block from src/routes/plans.$planId.brief.tsx into this shared component. Default export BriefEditor.

- BriefEditor takes brief, onChange, onApprove, onRegenerate, busy as props — does NOT manage its own approve/regenerate buttons. Those live on the StageCard wrapper.

src/routes/plans.$planId.brief.tsx

- Keep the route functional but make it a thin wrapper that fetches the brief and renders <StageCard><BriefEditor /></StageCard>. Useful for direct links / resumed drafts.

Result: Coach stays on /clients/$clientId for Stage 1. No navigation. Stages stack vertically with consistent collapse/expand UX. Refresh restores state. Stages 2–5 plug in by adding their editor and changing the StageCard status from "placeholder" to "ready".

## 2. Visible Pre-Stage 0 post-processing per section

**Goal:** Every section that has a Pre-Stage 0 analysis displays a small post-processing card after autosave. If the AI returned nothing meaningful for that section, show "No flags from this section."

### Changes

`**src/routes/clients_.$clientId.tsx**`

- Extend the section-coverage fetch: in addition to `briefCoverage` (done/total counts), also fetch and store the per-section analysis bodies. Update `getSectionAnalysisCoverage` to return `analyses` map alongside the existing `sections` array — see server change below.
- Store the result in new state: `sectionAnalyses: Record<string, SectionAnalysis | null>`.
- After every successful pre-stage call inside `triggerSectionAnalyses`, refresh `sectionAnalyses` from the coverage call (already happens once at the end; keep that, also re-fetch after the loop).
- In each `<SectionBlock>` render, append a small footer card (below children, above existing `footer` prop) that reads from `sectionAnalyses[sectionId]`:
  - **Loading state** (signature changed since last fetch but no analysis yet): muted "Analyzing…" with a spinner.
  - **Has analysis with content** (any of `red_flags`, `contraindication_notes`, `notes_for_next_stage`, `primary_goal`, etc.): render a compact list of the populated fields. Reuse the `CompletionStrip` visual style.
  - **- Has analysis but all fields empty/omitted:** render a small neutral card "Section noted — no flags or actions for the AI." Avoid the word "nothing" — empty fields are still useful signal.
  - **No analysis at all** (phased flag off, or section never analysed): render nothing.

`**src/server/phased/pre-stage.functions.ts**`

- Update `getSectionAnalysisCoverage` to also return the full `analyses` object so the client can render each section's post-processing card without an extra round-trip:
  ```ts
  return { ok, total, done, sections, analyses };
  ```
  &nbsp;

- Add a per-section "Analysing…" indicator that fires on save and clears when the analysis returns. The current flow is silent during the round-trip — the coach sees no feedback between save and analysis appearing. Use a small inline pulse next to the section title while the request is in flight.

**Result:** Every section with an analysed payload gets a visible post-processing card after save. Silence is replaced with explicit "No flags" messaging.

## 3. Ghost-plan cleanup + per-card delete button

### Changes

**Database cleanup (one-shot migration):**

```sql
DELETE FROM workout_plans
WHERE title LIKE '%Phased Plan%'
  AND generation_status != 'complete'
  AND brief IS NULL;
```

The `brief IS NULL` guard preserves valid in-progress drafts that already have a synthesized brief. Report the deleted row count back to the user.

`**src/routes/clients_.$clientId.tsx**`

- In the Plans list (lines 1538–1568), restructure each row from a single `<Link>` into a flex row containing: the existing link (clickable area) + a trailing trash icon button.
- Trash button: opens an `AlertDialog` "Delete this plan?" with confirm/cancel. On confirm, runs `await supabase.from("workout_plans").delete().eq("id", p.id)`, removes from local `plans` state, toasts success.
- Use `Trash2` from `lucide-react` (already imported).
- RLS already restricts deletion to the trainer's own rows.

**Result:** Today's ghost rows wiped. Coach can manually delete any future stragglers from the UI.

## Order of work

1. Build src/components/StageCard.tsx — the generic stacking wrapper.

2. Move BriefEditor into src/components/BriefEditor.tsx (no buttons inside, just the editor body).

3. Wire inline brief panel using StageCard + BriefEditor on the client page; remove toast-link banner. Add hydration-on-mount so refresh restores the stack.

4. Add Stage 2/3/4 placeholder StageCards beneath the brief.

5. Extend getSectionAnalysisCoverage to return analyses map.

6. Add per-section analysis cards + "Analysing…" indicator.

7. Run cleanup SQL and report row count.

8. Add per-card trash button with confirm dialog.

## Out of scope

Items 4–17 from the user's message. Stages 2–5 generation logic is untouched — only a passive UI placeholder slot is added so the eventual stacking flow has a home.