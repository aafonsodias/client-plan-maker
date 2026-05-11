
## Problem

On `/clients/$clientId`, the approved-plan branch renders TWO stacked cards:

1. `<ThisWeekHero bare … />` — plan title link, W1–W4 chips, Avaliação PDF, weekly PDF, Registar treino.
2. `<PlanWithDeck>` (the new `PlanCommandDeck`) right below — repeats title, week chips, weekly PDF, Registar treino.

Result: two identity rows, two week selectors, two PDF buttons, two CTAs. The deck did not replace the hero; it stacked under it. Plus `PlanCommandDeck` itself still has a standalone "Configurar mesociclo" row that the user wants tucked into More.

## Fix — one card, no duplicates

### A. `src/routes/clients_.$clientId.tsx` (approved-plan branch only)

When `allApprovedLocal && heroPlan` is true:

- **Stop rendering `<ThisWeekHero …/>`** in that branch. Keep it for the onboarding/zero-state branches (no plan yet) where it acts as the "Próximo passo" card.
- Pass the work it was doing into `<PlanWithDeck>` via new props:
  - `primaryAction` = the "Registar treino" secondaryAction object already built in this file.
  - `assessmentPdf` handler (already passed).
  - `currentWeek` (already passed).

So the heroPlan path becomes a single card: `<PlanWithDeck …/>`.

### B. `src/components/PlanWithDeck.tsx`

Accept and forward:

- `primaryAction?: { label; onClick?; busy? }` — surfaced as the loud "Registar treino" button in the deck.
- Keep `onAssessmentPdf` (already supported) — surfaces inside the deck's ⋯ menu.

Drop the standalone `onRegister` / `registerBusy` props in favour of `primaryAction` (single source of truth, label comes from caller).

### C. `src/components/PlanCommandDeck.tsx`

Tighten to exactly five compact elements, total height ≈180px @375px:

```text
┌─ Identity (h≈32) ──────────────────────────────────────┐
│ 📄 Plan title…              Bloco 1 · Sem. 1/4 · BASE ⋯│
├─ Action (h≈36) ────────────────────────────────────────┤
│ [ ▶ Registar treino                  ] [ ⬇ PDF S1 ]   │
├─ Weeks (h≈30) ─────────────────────────────────────────┤
│ [W1•] [W2] [W3] [W4] [Todas]                           │
├─ Nav (h≈30) ───────────────────────────────────────────┤
│ [View] [Edit] [Log] [Resultados]                       │
└────────────────────────────────────────────────────────┘
```

Changes vs current deck:

- **Remove Row 5** ("Configurar mesociclo" link) entirely. Move it into the ⋯ menu as `Configurar mesociclo` (calls `onModeChange("edit")`).
- **⋯ menu (Identity row)** now contains, in order:
  - Avaliação · PDF (existing)
  - Configurar mesociclo (new — only when `mode !== "edit"`)
  - Progresso (switches mode → "progress", existing)
  - Detalhes & acções do plano (scrolls to `<details>` inside `PlanEditorSurface` and opens it — uses `id="plan-details-actions"` we add to that `<details>`)
  - Existing `menuItems` (Share / Save Template / Re-ancorar RPE / Delete / Import log when wired)
- **Identity row**: drop the duplicate "Sem. X/Y" inside the meta line — keep one only. Single line, smaller padding (`p-2.5`), border-only (no amber gradient — user asked to reduce competing amber outlines). Use `border-border/70 bg-card`.
- **Action row**: `Registar treino` becomes `h-9` (not `h-10`), `PDF S{n}` chip becomes `h-9` outline button matching the primary's height for visual symmetry. Label format `PDF S1 / S2 / S3 / S4` on mobile, `PDF · MESOCICLO` when `Todas` selected.
- **Week selector**: keep segmented; ensure chips don't trigger PDF (they already don't — they only set `selectedWeek`). Tighter `py-1`.
- **Nav**: 4 segments only (View/Edit/Log/Resultados). Progresso lives in ⋯ menu.

### D. `src/components/PlanEditorSurface.tsx`

- Add `id="plan-details-actions"` to the existing `<details>` summary block (line ~398) so the deck's "Detalhes & acções" menu item can scroll/open it via `el.open = true; el.scrollIntoView()`.
- No other change. `hideOwnChrome` already suppresses the duplicate tabs/header. `MesocycleTableView` already collapses TSV/MD/Detailed into its own ⋯ dropdown.

### E. ThisWeekHero usage

- Keep the file (still used by zero-state and the standalone `/plans/$planId` route via PlanEditorSurface? — check: no, ThisWeekHero is only referenced in `clients_.$clientId.tsx`. Still needed for the **non-approved hero path** in that same route, which renders the "Próximo passo" CTA card. Do not delete.

## Files touched

- `src/routes/clients_.$clientId.tsx` — remove the `<ThisWeekHero/>` render from the approved-plan branch only; pass `primaryAction` to `<PlanWithDeck>`.
- `src/components/PlanWithDeck.tsx` — add `primaryAction` prop, forward to deck.
- `src/components/PlanCommandDeck.tsx` — drop Row 5; expand ⋯ menu (add Configurar mesociclo, Detalhes & acções, keep Avaliação PDF and Progresso); tighten paddings/heights; quieter border.
- `src/components/PlanEditorSurface.tsx` — add stable `id="plan-details-actions"` to the collapsed details block.

No backend, schema, RLS, auth, quota, billing, AI, assessment, logging, PDF or i18n changes.

## Acceptance

- One card above the table; ~180–220px tall on a 391×844 viewport (current preview).
- Plan title appears once. Week chips appear once. Weekly PDF button appears once.
- "Registar treino" is the single loud CTA; weekly PDF chip is to its right and updates with the selected week.
- W1–W4 filter the table; "Todas" shows full mesocycle (already wired via `PlanWithDeck → selectedWeek → PlanEditorSurface.filteredData`).
- Avaliação PDF, Configurar mesociclo, Progresso, Detalhes & acções, Share/Save/Delete reachable from the ⋯ menu.
- TSV/MD/Detailed remain inside `MesocycleTableView`'s own ⋯ menu.
- Build passes; no nested scrollbars.
