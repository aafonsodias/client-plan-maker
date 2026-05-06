# Step 4C Audit — Findings & Proposed Fixes

## Verdict
Step 4C is honest: `mode` is purely local UI state, no payload/schema/engine touchpoints. Two minor a11y issues and one cosmetic risk. Safe to proceed to **Step 4D after the fixes below are applied**.

## Confirmed clean

- **Local-only state**: `useState<"quick" | "lab">("quick")` lives only in `BriefEditor`. Not read by any `setPv`, `set`, `onChange`, `onProgrammingChange`, `onAccommodationsChange`. No reference to `mode` reaches `src/server/*`, `supabase`, mutation payloads, or `programming_variables`.
- **No engine drift**: `IntensityCockpit` uses `mode` only to gate the "Controlo manual" toggle visibility and chip rendering. `apply()`/`applyPreset()`/`onChange` are not called from the mode branch.
- **Quick default**: initial render = `"quick"`. Defensive optional chaining (`brief.sessions_per_week?.recommended ?? 0`, optional `programmingVariables`) already guards old plans.
- **Aplicar still explicit**: the recommendation row and its "Aplicar" button render only when `programmingVariables.training_split !== systemSplit.value`, and the click handler is the only mutation path. Toggling mode never auto-applies.
- **i18n**: only matches for "quick"/"lab"/"Caminho rápido"/"Modo laboratório" outside locale files are the new code paths in `BriefEditor`, `IntensityCockpit`, `RationaleChip`, all routed through `t("ux.mode.*")`. No hardcoded visible strings.

## Issues found (ordered by severity)

### P1 · A11y · Wrong ARIA role pattern on segmented control
`BriefEditor.tsx` lines 52–80 use `role="tablist"` + `role="tab"` + `aria-pressed`. WAI-ARIA tabs require:
- `aria-selected` (not `aria-pressed`) on each `role="tab"`
- a `role="tabpanel"` referenced by `aria-controls` / `id`
- arrow-key navigation between tabs

Since this control toggles **density only** (no panel swap), the cleaner fix is to drop the tab pattern and use a **toggle group**: `role="group"` on the wrapper, plain `<button aria-pressed>` children. Screen readers announce "pressed/not pressed" correctly and keyboard Tab/Enter just works.

### P2 · A11y · No visible focus ring on segmented buttons
The buttons rely on browser default focus only. Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40` to match the rest of the app's amber focus convention (matches `RationaleChip`).

### P3 · Cosmetic · Empty `aria-label` reference
`aria-label={t("ux.mode.aria_label")}` becomes meaningless once the wrapper is no longer a `tablist`. After the role change, keep `aria-label` so the group is announced as "Modo de configuração, dois botões".

### Non-issues verified
- Hiding `confident`/`manual` chips in Quick Path does not hide safety-critical content. Tier "remedial" / "conservative" rows surface as `confidence: "assumed"` with `tier_remedial_flags` / `tier_conservative` reasons → still visible in Quick Path. Confirmed in `src/lib/auto-infer.ts`.
- `RationaleChip` returns `null` cleanly (no empty wrapper) when suppressed; surrounding flex containers only render their other children, no orphan gaps observed.
- `IntensityCockpit` knob values are untouched by `mode`. `showKnobs = mode === "lab" && showKnobsPref` is read-only; `showKnobsPref` localStorage write is only triggered by the manual button click (which itself is hidden in Quick Path → no accidental writes).
- Switching Quick → Lab → Quick re-renders with the same `brief` and `programmingVariables` references; no setter is called from the mode branch.

## Proposed fix (single small patch)

`src/components/BriefEditor.tsx` lines 52–80:

```tsx
<div
  role="group"
  aria-label={t("ux.mode.aria_label")}
  className="rounded-2xl border border-border bg-card p-2 shadow-sm"
>
  <div className="grid grid-cols-2 gap-1">
    {(["quick", "lab"] as const).map((m) => {
      const active = mode === m;
      return (
        <button
          key={m}
          type="button"
          aria-pressed={active}
          onClick={() => setMode(m)}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ${
            active
              ? "border border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "border border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(m === "quick" ? "ux.mode.quick_path" : "ux.mode.lab_mode")}
        </button>
      );
    })}
  </div>
  <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
    {t(mode === "quick" ? "ux.mode.quick_description" : "ux.mode.lab_description")}
  </p>
</div>
```

Diff vs current:
- `role="tablist"` → `role="group"`
- removed `role="tab"` from each button
- added `focus-visible:ring-*` classes
- everything else unchanged

## Files that would change
- `src/components/BriefEditor.tsx` (one block, ~6 lines effective)

## What stays untouched (confirmed)
No schema, no migration, no `programming_variables` field, no Stage 1–5 prompt, no `generation_meta`, no PDF export, no logbook, no edge function, no persistence, no onboarding modal.

## Recommendation
Apply the segmented-control a11y fix above, then **Step 4D can proceed**. Persistence of mode preference should land as a `profiles.ui_mode` column (or `localStorage` key only — debate in 4D), not on plans/clients.
