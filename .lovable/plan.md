## Goal

Stop bouncing to `/plans/$planId/blueprint` when the trainer clicks **View draft** / **Generate Blueprint** on the client page. Open the Stage 2 editor **inline, expanded right under the Stage 2 card** — same place the Brief lives — so the whole "Intake → Brief → Blueprint" flow stays on one page.

Same pattern stays available for Stage 3 (Microcycle) and Stage 4 (Progressions) in a follow-up, but this round only does Blueprint to keep the diff tight and the bug-surface small.

## What changes for the user

- On `/clients/:id`, clicking **Generate Blueprint** or **View draft** no longer navigates away. The Stage 2 card expands and renders the full Blueprint editor in place: Programming Tier chip, Session Archetypes list, Week × Day matrix, Progression Model picker, "Ask AI for changes", "Regenerate", "Approve → Day 1".
- The **Brief approved** rail stays visible on the right (where it already is), exactly as in the screenshot.
- After approving the blueprint, Stage 3 card auto-opens inline (or surfaces "Generate Microcycle"); no full-page redirect.
- A small "Open full page" link stays in the card header for users who prefer the dedicated route — the route keeps working for deep links.

## Technical plan

1. **Extract the editor body** out of `src/routes/plans.$planId.blueprint.tsx` into a reusable component:
   - New file: `src/components/BlueprintEditorPanel.tsx`.
   - Exports `BlueprintEditorPanel({ planId, onApproved?, compact? })`.
   - Contains all state + load/regenerate/approve logic currently in `BlueprintReview` (lines 48–343), minus the `AppShell` and the right-side `BriefContextRail` (the client page already shows brief context above).
   - `compact` removes the page-level title/back-link; the StageCard provides the chrome.
   - `onApproved` callback lets the host decide what to do next (client page → expand Stage 3; standalone route → navigate to microcycle).

2. **Slim down the route** `src/routes/plans.$planId.blueprint.tsx` to just render `<AppShell><BriefContextRail/> + <BlueprintEditorPanel onApproved={navigate microcycle}/></AppShell>`. Behaviour identical to today for anyone hitting the URL directly.

3. **Inline mount on the client page** in `src/routes/clients_.$clientId.tsx` (around line 2293, the Stage 2 `StageCard`):
   - Track local UI state `expandedStage: "blueprint" | "microcycle" | "progressions" | null`.
   - Replace the current `onApprove → navigateToStage("blueprint")` with `onApprove → setExpandedStage("blueprint")` when a draft exists or generation just succeeded. First-time generation still calls `runStage("blueprint", false)` but, on success, sets `expandedStage = "blueprint"` instead of navigating.
   - When `expandedStage === "blueprint"`, render `<BlueprintEditorPanel planId={planId} compact onApproved={() => { refreshPlans(); setExpandedStage("microcycle"); }} />` directly underneath the Stage 2 `StageCard`, inside the same vertical stack.
   - Keep a tiny "Open full page" link in the StageCard header for power users.

4. **Keep telemetry + fallback toast behaviour** that already lives in `runStage` (Founder telemetry panel, deterministic fallback message) — only the navigation step changes.

5. **i18n**: add two keys in `src/i18n/locales/{pt,en}/clients.json` (or the existing `detail.stage` namespace): `open_inline` ("Abrir aqui" / "Open here") and `open_full_page` ("Página completa" / "Full page").

6. **No DB / server function changes.** No migrations. No new dependencies.

## Out of scope (this round)

- Inlining Stage 3 (Microcycle) and Stage 4 (Progressions) — same refactor pattern, but each has its own quirks (day-by-day generation, exercise picker). Will land in the next round once Blueprint inline is validated on Mobile Safari 375px.
- Removing the standalone `/plans/$planId/blueprint` route — kept as a deep-link target.
- Any new model/cost work (Stage 2 already on `google/gemini-3-flash-preview` with deterministic fallback).

## Risk + QA

- **Risk**: the BlueprintEditor was written assuming it owns the page (max-w-4xl, p-6). In `compact` mode we drop the outer paddings and let the StageCard frame it. Visual smoke at 1696px desktop and 375px Mobile Safari before closing.
- **Risk**: two "Approve" buttons could appear if StageCard's footer is also rendered. Solution: when `expandedStage === "blueprint"`, hide StageCard's primary action and rely on the inline editor's own Approve.
- **QA checklist**: generate blueprint from scratch → editor expands inline; reload page → "View draft" reopens it inline; approve → Stage 3 card highlights and brief rail still visible; deep link `/plans/:id/blueprint` still works standalone.
