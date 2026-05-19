## Goal

Make the focused assessment have **a single navigation bar** at the top — always visible, easy to click — that combines:

`← Anterior   ·   [GROUP] / Section title   ·   01/15   ·   ⋯ menu   ·   Próxima →`

Today (`src/routes/clients_.$clientId.tsx`, around lines 4838–5013, inside the focused `<SectionBlock>` renderer) there are two separate strips:

- **Top sticky header** with `01/15` + group eyebrow + section title + jump-to menu.
- **Bottom sticky strip** with `← Anterior`, `1/15`, `Próxima →`.

Result: the user sees `1/15` twice and has to scroll the section to reach Anterior/Próxima.

## Changes

### 1. Unify the top bar (mobile branch, ~lines 4842–4922)

Replace the current top sticky header layout with a single horizontal row:

```text
[← Anterior]   [GROUP eyebrow / Section title]   [01/15]   [⋯ jump]   [Próxima →]
```

- `← Anterior`: ghost icon button. `disabled` when `activeIdx === 0` (goes grey with `opacity-40 pointer-events-none`). Calls `goPrev`.
- Middle title column: keeps the existing group eyebrow + `t("sections.${activeId}")` title (truncate, `min-w-0 flex-1`).
- `01/15`: same pill used today (`String(activeIdx + 1).padStart(2, "0")/…`).
- `⋯ jump`: existing `<Sheet>` trigger, unchanged.
- `Próxima →`: small button. On last step becomes the amber "Concluir" CTA (reuses the same `isLast ? onConclude : goNext` logic, `concludeBusy` spinner, amber styling, `pulseKey` pulse). Hidden/disabled cleanly when there's no `onConclude` on the last step.

Keep the thin progress bar (`h-0.5` gradient) above the row.

### 2. Remove the bottom sticky footer (mobile branch, ~lines 4936–4972)

Delete the whole `<div className="sticky bottom-0 …">` block. The body keeps document scroll; `missingPanel` and `extras` remain where they are. `paddingBottom: env(safe-area-inset-bottom)` is no longer needed since there's no bottom bar.

### 3. Apply the same unification to the desktop branch (~lines 4976–5013)

Today desktop has no top step header — only the bottom prev/next strip at lines 4985–5013. Make it match: render the same unified top bar (above the section body) and remove the bottom strip. This way both viewports behave identically and the "Anterior/Próxima" controls are always reachable without scrolling. The existing focused-mode tab strip (lines 4789–4836) stays — it's a different surface (chapter tabs).

### 4. i18n

Reuse existing keys: `assessment:previous`, `assessment:next`, `assessment:finish`, `assessment:jump_to`. No new strings.

### 5. Out of scope

- No changes to `SECTIONS`, completeness logic, `goPrev/goNext`, `pulseKey`, `onConclude`.
- No changes to the assessment progress strip on the StageCard header (the "Auto-Avaliação · X%" eyebrow above the focused area).
- No changes to `MobileStepHeader.tsx` (it's a separate component used elsewhere — leaving it untouched).

## Acceptance

- Only one `1/15` is visible in the focused assessment.
- `← Anterior` and `Próxima →` are always reachable at the top, no scrolling needed.
- `← Anterior` is greyed out on step 1; `Próxima →` becomes the amber "Concluir" CTA on the last step with the existing pulse animation.
- Jump-to (`⋯`) sheet still opens the same section picker.
- Behaviour identical on viewport widths above and below 1024 px.
