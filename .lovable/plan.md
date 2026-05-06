
# Step 4B Audit — Findings & Targeted Fixes

Scope confirmed: audit was read-only. No persistence, schema, engine, prompts, or PDF code is touched by the proposed fixes. Plan mode — no edits applied yet.

## Audit results

### 1. Display-only guarantee — PASS (with one nit)

Searched every call site of `inferTier / inferSplit / inferCockpitPreset / inferWaveModel / inferDeloadFreq / inferLogbookModeFromDayFocus`. Inferences are consumed only as:
- `RationaleChip` props (rendering)
- A comparator value in BriefEditor's split row (the only "Aplicar" button calls `setPv` — explicit user gesture, not auto-write)
- A label lookup in `log.$token.tsx` (read-only chip)

No `setState`/`save`/payload merge ever receives an inferred value. ✓

Nit: `inferTier(...)` is called twice in BriefEditor (lines 102 and 107) for the same arguments. Hoist to a const. Pure perf, no correctness impact.

### 2. "Recomendado · Aplicar" clarity — PASS

Only the small amber pill is a `<button>`. The "Recomendado: …" text is a plain `<span>`. No risk of mistaking the recommendation for an applied value. Layout wraps cleanly because the parent uses `flex flex-wrap`.

### 3. Manual override distinction — **P0 BUG**

In BriefEditor we call:

```ts
inferSplit({
  sessions_per_week: brief.sessions_per_week.recommended,
  manual: programmingVariables.training_split as any,
});
```

But `inferSplit` short-circuits the moment `manual` is truthy and returns `confidence: "manual"`. Since `programmingVariables.training_split` is always set (form has a default), the inference **always** returns the user's current value with `confidence: manual`. Consequence:

- `matches` is always `true`
- The "Recomendado · Aplicar" row never renders
- The chip permanently says "Sobreposto manualmente" even when the user has not overridden anything

**Fix**: compute two envelopes — a system pick with `manual: null`, plus the current value — and use the comparison between `systemPick.value` and the actual `programmingVariables.training_split` to drive both the chip label and whether the recommendation row appears.

### 4. Knowledge card source logic — PASS (with honest-label nit)

All four cards use the same `diffCount`-based comparator against `SYSTEM_DEFAULT_RULES`. Match → `default/confident/card_matches_default`. Differs → `pkl/confident/card_pkl_override`. Volume's `count` reflects landmark overrides via `Object.keys(...).length`, intensity/recovery/progression's `card_pkl_override` doesn't expose a count (acceptable — there's no honest cross-card count).

Note: calling the source `pkl` is honest because `/knowledge` IS the PKL editor. No "ambiguous source" branch is currently needed; no fake confidence is asserted.

### 5. Confidence dot accessibility — **P1**

- Dot is `aria-hidden` ✓
- Button has `aria-label="Ver justificação"` ✓
- Popover content carries text (`confidence.confident` / `assumed` / `manual`), so not color-only ✓
- **Issue**: tap target is `px-1.5 py-0.5` over 10px text → roughly 18×16px. Below WCAG 2.5.5 24×24 minimum on touch.

**Fix**: bump RationaleChip trigger padding to `px-2 py-1` and add `min-h-[24px]` so click target meets touch guidelines without changing visual weight materially.

### 6. RationaleChip mobile behavior — PASS

Radix Popover with `side="top"`, `align="start"`, `collisionPadding={12}`, `max-w-[calc(100vw-2rem)]`. Verified at 375px no overflow. Outside-click + Escape close handled by Radix. Not modal.

### 7. i18n completeness — PARTIAL

New i18n keys (`ux.rationale.labels.*` and `reasons.card_*`, `cockpit_manual`) are present in PT and EN. ✓

Hardcoded PT strings introduced by 4B (project is PT-first, so these are not breaking but should be tracked):
- `"Nível inferido:"` (BriefEditor)
- `"Recomendado:"` is i18n'd, but the split labels (`"Corpo inteiro"`, `"Empurrar / Puxar / Pernas"`, etc.) are still hardcoded inline
- `"Sobrepor default"` literal in `knowledge.tsx` — should use `t("ux.rationale.labels.override_default")` (the key already exists).
- `IntensityCockpit` toggle correctly uses `t(...)` with `ns: "common"`.

**Fix**: route the three above through `t()`, reusing existing keys where possible. No new keys required for "Nível inferido" — reuse `ux.rationale.labels.inferred`.

### 8. Old-plan compatibility — PASS (with one defensive guard)

- `inferTier`: red_flags optional → 0 fallback ✓
- `inferCockpitPreset`: undefined goal → `moderate_recomp` ✓
- `inferLogbookModeFromDayFocus`: handles `null/undefined` ✓
- `inferDeloadFreq` / `inferWaveModel`: undefined inputs → defaults ✓
- `inferSplit` in BriefEditor reads `brief.sessions_per_week.recommended`. If `sessions_per_week` ever lands as `null` on a legacy plan, this throws.

**Fix**: defensive optional chain `brief.sessions_per_week?.recommended ?? 0`.

### 9. Visual hierarchy — PASS

Primary value reads first, chip second, dot third. Cockpit knob chips sit top-right via `ml-auto`. No layout jump. No clutter at 375px.

## Fixes to apply

All localized to four files. No engine/schema/persistence touched.

**`src/components/BriefEditor.tsx`**
1. Hoist `inferTier({...})` to a single const, use it for both inference and label.
2. Defensive `brief.sessions_per_week?.recommended ?? 0`.
3. Replace the broken `inferSplit({manual: programmingVariables.training_split})` with:
   ```ts
   const systemSplit = inferSplit({
     sessions_per_week: brief.sessions_per_week?.recommended ?? 0,
     manual: null,
   });
   const matches = programmingVariables.training_split === systemSplit.value;
   const chipInf = matches ? systemSplit : inferSplit({ manual: programmingVariables.training_split as any });
   ```
   so the chip flips between `inferred` and `manually_overridden` honestly, and the "Recomendado · Aplicar" row only appears when the user's current pick differs from the system's recommendation.
4. Replace `"Nível inferido:"` literal with `t("ux.rationale.labels.inferred")`.

**`src/components/ux/RationaleChip.tsx`**
5. Bump trigger to `px-2 py-1 min-h-[24px]` to meet WCAG 2.5.5.

**`src/routes/knowledge.tsx`**
6. Replace literal `"Sobrepor default"` with `t("ux.rationale.labels.override_default", { ns: "common" })`. Add `useTranslation("common")` import (route doesn't currently use it).

**(Optional, deferred)** Translating the seven Portuguese split labels in BriefEditor is left for the broader i18n audit — they belong to a wider naming domain (`brief-labels`) and are not new strings introduced by 4B.

## Acceptance criteria after fixes

- Recommendation row appears iff `current_split !== systemPick`
- Chip honestly labels "Inferido" vs "Sobreposto manualmente"
- WCAG-compliant 24px tap target on every RationaleChip
- No hardcoded "Sobrepor default" / "Nível inferido" outside i18n
- Legacy plans missing `sessions_per_week` no longer crash BriefEditor
- Zero schema, engine, prompt, persistence, or PDF changes

## Explicitly deferred to Step 4C/4D

- Quick Path vs Lab Mode toggle
- Persisting any inferred value
- Translating split labels and other pre-existing PT-only strings
- Adding `inferTier`-driven recommendation rows for tier/wave/deload (only `training_split` gets the "Aplicar" pattern in 4B)
