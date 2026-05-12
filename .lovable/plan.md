## Scope

Refine only the `InjuryEditor` overlay so the registration panel opens **top-aligned on mobile** instead of as a bottom sheet, with safe-area-aware sizing, internal-only scroll, and visible action buttons. Tighten copy/labels and verify the rest of the flow (markers, summary cards, edit/delete, persistence) already meets the checklist via existing components.

## Files to change

1. **`src/components/InjuryEditor.tsx`** — primary change. Replace bottom-sheet positioning with top-aligned card on mobile; centered modal kept on `sm+`. Add safe-area padding, max-height with internal scroll, sticky action bar, `role="dialog"` + focus trap basics, ESC-to-close. Add edit-vs-create label (`Guardar alterações` / `Registar lesão`) driven by `row` prop.
2. **`src/components/InjuriesBodyMapBlock.tsx`** — minor: tighten empty-state copy to match spec ("Sem lesões registadas" / "Toque numa zona…"), ensure summary list copy `{zone} · severidade {n}/5`, no other structural change. Already wires markers via `BodyMap badges` and persists via `injuries.functions` server fns.
3. **`src/i18n/locales/pt/assessment.json`** & **`src/i18n/locales/en/assessment.json`** — add only missing keys: `injuries.empty_title`, `injuries.empty_hint`, `injuries.save_changes_cta`, refined `injuries.notes_placeholder`. Keep existing `injuries.*` keys in `common.json` untouched (used by intake slide); read these new keys from `assessment` namespace in `InjuriesBodyMapBlock` only where they replace existing strings — fall back to `common` keys for anything else to avoid breaking the public intake slide.
4. **`src/components/intake/InjuriesSlide.tsx`** — no logic change, but it shares `InjuryEditor`, so it inherits the new top-aligned panel. Verify no regression.

## InjuryEditor positioning (the actual fix)

Replace the current container:

```tsx
// before: bottom sheet on mobile
<div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur sm:items-center">
  <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
```

With:

```tsx
// after: top-aligned on mobile, centered on sm+
<div
  className="fixed inset-0 z-50 overflow-y-auto bg-background/70 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] sm:flex sm:items-center sm:justify-center"
  onClick={onCancelBackdrop}
  role="dialog" aria-modal="true" aria-labelledby="injury-editor-title"
>
  <div
    onClick={(e) => e.stopPropagation()}
    className="mx-auto w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-xl
               max-h-[calc(100dvh-2rem)] flex flex-col"
  >
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* header, severity, chips, notes (unchanged) */}
    </div>
    <div className="sticky bottom-0 flex gap-2 border-t border-border/60 bg-card/95 backdrop-blur p-3">
      <Button className="flex-1">{row ? t("injuries.save_changes_cta") : t("injuries.save_cta")}</Button>
      <Button variant="ghost" onClick={onCancel}>{t("injuries.cancel_cta")}</Button>
    </div>
  </div>
</div>
```

Key points:
- `pt-[max(env(safe-area-inset-top),1rem)]` puts the panel near the top on mobile, not centered low.
- `max-h-[calc(100dvh-2rem)]` + inner `overflow-y-auto` keep title/severity row visible immediately and prevent clipped buttons.
- Sticky footer means `Cancelar` / `Registar lesão` are always reachable.
- `sm:flex sm:items-center` preserves desktop centered modal.
- Backdrop click and ESC both call `onCancel`.
- Edit mode primary CTA switches via `row ? save_changes_cta : save_cta`.

## Empty state, markers, summary card

Already correct in `InjuriesBodyMapBlock` + `BodyMap`:
- `BodyMap` renders amber-tinted zone fill + numeric severity badge per zone via `badges={zoneId: severity}` — meets the "small marker with severity number" requirement.
- Summary list under map already supports edit (`Pencil`) and delete (`Trash2`) calling `update`/`remove` server fns.

Only copy adjustments:
- empty state → `t("injuries.empty_title")` + `t("injuries.empty_hint")`.
- list line → `{zone} · {t("injuries.severity_label").toLowerCase()} {n}/5`.

## Persistence

No change. Existing `addInjury` / `updateInjury` / `removeInjury` server fns already persist to the dedicated `injuries` table tied to `assessmentId`. No schema change, no DB types touched, no local-only state.

## Body-part labels

Out of scope to remap all zone labels. The body-zone i18n keys already render via `t(zone.label_key)` — if any sound awkward (e.g. "Bicípite direito"), adjust the corresponding values in the existing PT/EN body-zone i18n files **only for the few names listed by the user** (Anca, Ombro, Bíceps, Joelho). One-line value edits, no key renames.

## Out of scope

Bottom-nav redesign, full assessment refactor, schema/migrations, generated Supabase types, body-map SVG rebuild, multi-select chips (kept single-select since current model is single `injury_label`), AI diagnosis, image uploads.

## Acceptance verification

After edits run `bunx tsc --noEmit` and manually smoke at 390px:
- Tap a zone → panel appears near top, title + severity row visible without scrolling, `Cancelar` visible.
- Save → panel closes, amber marker with severity number on the zone, summary card below.
- Edit → same panel reopens prefilled, primary CTA reads "Guardar alterações".
- Delete → marker and card disappear, persisted.
- Desktop (≥640px) still shows centered modal, no clipping.
- Public intake slide (`/intake/$token`) still works since it shares `InjuryEditor`.

## Risks / TODOs

- `100dvh` on older iOS Safari may fall back; acceptable since we also cap with inner scroll.
- If the `injuries.*` keys in `common.json` differ from the new `assessment.json` keys in tone, do a follow-up unification pass — not in this scope.
- Body-zone label rewording is value-only; if more zones sound awkward beyond the four listed, leave for a separate copy pass.
