
## Scope

Pure UI/UX refactor of the command area shown in the screenshot (`/clients/$clientId`), which is built from two cooperating components:

- `src/components/ThisWeekHero.tsx` — plan title row, W1–W4 chips (`MacroIndexStrip`), Avaliação · PDF, PDF · Sem. N, Registar treino
- `src/components/PlanEditorSurface.tsx` (rendered in `embedded` mode at line 2044 of `src/routes/clients_.$clientId.tsx`) — "Detalhes & acções do plano" details, View/Edit/Log/Resultados/Progresso tabs, Configurar mesociclo button, Table/Cards toggle, and `MesocycleTableView` (TSV/MD/Detailed)

No backend, schema, RLS, auth, quota, billing, AI generation, assessment, logging or PDF internals are touched. Existing handlers and i18n keys are preserved.

## New component: `PlanCommandDeck`

New file: `src/components/PlanCommandDeck.tsx`. Pure presentational; receives plan metadata + callbacks. Renders five compact rows on top of the table:

```text
┌─ Identity row ────────────────────────────────────────────┐
│ 📄 Hypertrophy Foundation: Clinical… · B1 · S1/4 · BASE  ⋯│
├─ Primary action row ──────────────────────────────────────┤
│ [ ▶ Registar treino ]   [ ⬇ PDF · SEM. 1 ]               │
├─ Week selector (segmented) ───────────────────────────────┤
│  [W1•] [W2] [W3] [W4]  [Todas]                            │
├─ Navigation (segmented) ──────────────────────────────────┤
│  [View] [Edit] [Log] [Resultados]   (Progresso in ⋯)      │
├─ Secondary toolbar (just above the table) ────────────────┤
│  [Tabela|Cards]              ⚙ Mesociclo   ⋯ More         │
└───────────────────────────────────────────────────────────┘
```

Behavior per row:

1. **Identity**: title (truncate), one-line meta `Bloco N · Sem. X/Y · TAG`, three-dot menu containing Avaliação · PDF (sky chip moved here), Share, Save as Template, Re-ancorar RPE, Import log, Delete. Built with the existing `DropdownMenu` shadcn primitive.
2. **Primary action**: Registar treino is the loud `Button variant=default`. PDF · SEM. N is a smaller emerald outline button next to it; label updates with `selectedWeek` (`PDF · SEM. ${selectedWeek}` or `PDF · MESOCICLO` when "Todas" is selected → still downloads `selectedWeek=1` if no week chosen, but the chip says all).
3. **Week selector**: replaces `MacroIndexStrip` chips with a single segmented control (`bg-muted/40 rounded-full p-0.5`, active pill `bg-primary/15 text-foreground`). Includes `Todas` (`null` value). Current week (from `planLatestWeek` if available, else default) gets a subtle `•` dot.
4. **Navigation**: segmented control reusing the existing 5 modes; the rarely-used `Progresso` mode is moved into the identity ⋯ menu so the segmented control shows only View/Edit/Log/Resultados (4 fits 375px without horizontal scroll). On screens wider than `sm:`, all 5 fit. Removes the current "-mb-px overflow-x-auto" tab strip that draws the ugly nested scrollbar.
5. **Secondary toolbar**: collapses TSV/MD/Detailed into a single "⋯ More" `DropdownMenu` (icon-only on mobile). Table/Cards stays as a small segmented toggle. "Configurar mesociclo" becomes a quiet ghost button that switches `mode` to `edit` (same handler as today).

The "Detalhes & acções do plano" details block is preserved but only contains the *legacy* surfaces that don't fit on the deck (Summary editor, demo seed banner, NextBlockCard/NextWeekCard, ValidationReport, legacy-plan banner). Its summary chip stays collapsed by default and uses smaller text.

## State lifting

`selectedWeek` (1..N or `null` for All) is currently local to `ThisWeekHero` and only drives the PDF download. The week chips must also drive the table.

- Lift `selectedWeek` into `clients_.$clientId.tsx` (around the `heroPlan` block, lines 1907–2046).
- Pass `selectedWeek` + `onSelectedWeekChange` to a new `<PlanCommandDeck />` rendered just above `<PlanEditorSurface embedded selectedWeek=… />`.
- Add a new optional prop `selectedWeek?: number | null` to `PlanEditorSurface`. When set, the `MesocycleTableView` receives a filtered `plan` with only `plan.weeks.filter(w => selectedWeek === null || w.week_number === selectedWeek)`. Filtering happens in the wrapper, not inside `MesocycleTableView` itself, so its existing W1-as-baseline delta logic still works (when only one week is shown, deltas naturally collapse to "no progression" — acceptable since the trainer asked for that single week).
- `ThisWeekHero` keeps working on the standalone `/plans/$planId` route. We swap it for `<PlanCommandDeck />` only inside the embedded client view; the standalone plan route also gets `<PlanCommandDeck />` mounted at the top of `PlanEditorSurface` when not embedded, so the same chrome reduction applies everywhere. `ThisWeekHero` becomes thin (or is removed entirely from the embedded path) — the deck takes over its visual role.

## Files touched

- **Add** `src/components/PlanCommandDeck.tsx` (~250 LOC, presentational)
- **Edit** `src/routes/clients_.$clientId.tsx` — replace `<ThisWeekHero …/>` + the trailing `<PlanEditorSurface embedded />` with `<PlanCommandDeck …/> + <PlanEditorSurface embedded selectedWeek=… hideOwnChrome />`. Lift `selectedWeek` state.
- **Edit** `src/components/PlanEditorSurface.tsx` —
  - accept `selectedWeek?: number | null` and `hideOwnChrome?: boolean` props
  - when `hideOwnChrome`, suppress the duplicate header (lines 360–617 — title, action buttons), the Summary block (lines 619–700), the mode tabs row (lines 795–841), and the "Configurar mesociclo" CTA. Mode + table/cards toggle are now driven by props from the deck.
  - filter `data.weeks` by `selectedWeek` before passing to `MesocycleTableView` and `ViewMode`
  - move Table/Cards out of `ViewMode`'s internal toolbar into a prop, OR keep `ViewMode` rendering it but hide it via prop — simpler: keep internal Table/Cards toggle but adjust it to a smaller pill row that visually belongs to the deck's secondary toolbar
- **Edit** `src/components/MesocycleTableView.tsx` — wrap TSV / MD / Detailed in a `DropdownMenu` triggered by a single `⋯` icon button (still keyboard accessible). No logic change.
- **Edit** `src/i18n/locales/{en,pt}/{common,plan}.json` — add the few new strings needed (`deck.weeks.all`, `deck.more`, `deck.menu.*`); reuse existing labels for everything else.

No changes to: `MesocycleTableView` data flow, `downloadPlanById`, `renderAssessmentPdf`, server functions, `IntensityCockpit`, `RegenerateWithFeedbackDialog`, routes other than the client detail.

## Mobile-first visual targets

- Deck total height @375px ≤ ~220px (currently ~480px → −55%).
- One loud CTA ("Registar treino"); everything else is `text-[11px]` chips, `h-8` segmented controls, `px-2.5` padding.
- No nested horizontal scrollbar: navigation segmented control wraps to 2×2 grid below `sm` if needed.
- Touch targets ≥ 36px; segmented active state uses `bg-primary/15 ring-1 ring-primary/30 text-foreground`.
- Preserves dark amber/emerald accents; no new colors outside `src/styles.css` tokens.

## Acceptance checks

1. Red area on mobile (375px) is at least 35% shorter; the `MesocycleTableView` first row appears above the fold.
2. All existing actions reachable: Registar treino, PDF weekly, Avaliação PDF, View/Edit/Log/Resultados/Progresso, Configurar mesociclo, Table/Cards, TSV, MD, Detailed, Detalhes & acções, Share, Save as Template, Re-ancorar RPE, Delete, Import log.
3. Clicking W2/W3/W4 shows only that week in the table; "Todas" shows the full mesocycle. PDF chip label and download both follow `selectedWeek`. Avaliação · PDF still works from the ⋯ menu.
4. Build passes; no nested scrollbar; desktop layout unchanged in spirit (deck just has more room).
