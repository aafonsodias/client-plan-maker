
# Step 4B — Inference Visible, Auditable, Reversible

Strict scope: **display-only**. No DB writes, no schema migrations, no engine changes, no auto-mutation of form state.

## 1. BriefEditor — inference chips (read-only)

File: `src/components/BriefEditor.tsx`

- Import `inferTier`, `inferSplit`, `inferWaveModel`, `inferDeloadFreq`, `inferCockpitPreset` from `@/lib/auto-infer` and `RationaleChip`.
- Compute inferences derived from current `brief` + `programmingVariables`:
  - `tier` ← `{ red_flags: brief.red_flags, training_age_band, manual: null }` (display-only, no stored "tier" field exists in Brief — chip is purely informational beside the experience selector).
  - `split` ← `{ sessions_per_week: brief.sessions_per_week.recommended, manual: programmingVariables?.training_split }` — chip beside the "Divisão de treino" Field.
  - `wave_model` ← `{ primary_goal, current: programmingVariables?.wave_model }` — already covered in the cockpit summary; do not duplicate in BriefEditor.
  - `deload_frequency` ← `{ tier: inferred tier value, current: programmingVariables?.deload_frequency }` — covered in cockpit; no duplicate.
  - `cockpit_preset` already done in cockpit.
- Place a `<RationaleChip inference={…} />` beside each summary value the chip refers to. No state writes.
- "Manually overridden" badge: when an inference returns `confidence === "manual"`, the chip already renders a foreground dot + "definido por si" — that satisfies the distinction. No extra UI required.

## 2. Auto-snap — visual recommendation only

In the "Divisão de treino" Field, when `programmingVariables?.training_split` does not match `inferSplit(...).value`, render a small subtle row beneath the select:

> "Recomendado: {label}  ·  Aplicar"

Clicking "Aplicar" calls the existing `setPv("training_split", inferred)` — explicit user action only. No silent writes.

Same pattern can be added later for other knobs; for 4B do it ONLY for `training_split` to validate the pattern. Acceptance criteria are met because no auto-write occurs.

## 3. Knowledge cards — compare against `SYSTEM_DEFAULT_RULES`

File: `src/routes/knowledge.tsx`

Replace the four hand-written `*Rationale` helpers with a single comparator that, per card, checks each relevant field against `SYSTEM_DEFAULT_RULES`:

- **Volume**: `Object.keys(rules.volume.landmarks).length === 0` → `source: "default", confidence: "confident", reason_key: "card_matches_default"`. Otherwise → `source: "user", confidence: "manual", reason_key: "card_user_override"` with `count` param.
- **Intensity**: compare `rpe_ceiling_by_tier` + `intensity_volume_tradeoff_default` to defaults. Match → default. Differs → `source: "pkl", confidence: "confident", reason_key: "card_pkl_override"`.
- **Recovery**: same logic for `deload_frequency` + `deload_style`.
- **Progression**: same for `wave_model_default`, `autoreg_strictness_default`, and `increments_kg_by_category`.

Add new reason keys (PT + EN) under `ux.rationale.reasons`:
- `card_matches_default` → "Igual ao default do sistema." / "Matches the system default."
- `card_pkl_override` → "Personalizado no seu perfil de conhecimento." / "Customized in your knowledge profile."
- `card_user_override` → "{{count}} valor(es) personalizado(s)." / "{{count}} custom value(s)."

If the card's data shape can't be safely compared, fall back to `confidence: "assumed"`, `reason_key: "fallback"` (existing key reused via the `fallback` string).

## 4. Replace "Editar"/"Afinar" copy on default-controlling actions

- `IntensityCockpit.tsx`: change the toggle label `"Afinar" / "Ocultar detalhes"` → `"Controlo manual" / "Ocultar controlo manual"` (PT). Stays one-button toggle.
- `knowledge.tsx` `RuleSummary`: change the `Editar` button label to `Sobrepor default`. Icon stays `Pencil`.
- Do NOT touch unrelated edit buttons (client identity, plan name, notes, etc.). Confirm by ripgrepping only the two files above.

EN equivalents added under `ux.rationale.override_default` and `ux.rationale.manual_control`, but for now the strings are PT-only inline (project is PT-first; EN strings still added to common.json for future use).

## 5. Confidence dots in cockpit knobs

`IntensityCockpit.tsx` — when the knobs grid is shown, add a tiny `<RationaleChip>` (or just the dot variant) beside each knob's label:

- Wave: `inferWaveModel({ primary_goal: primaryGoal, current: value.wave_model })`
- Deload: `inferDeloadFreq({ current: value.deload_frequency })` (no tier available here — pass `undefined`).
- RPE / tradeoff / autoreg: no inference function available; render a static "manual" dot via `RationaleChip` with an envelope `{ confidence: "manual", source: "cockpit", reason_key: "cockpit_manual" }` (new key).

Each dot inherits `aria-label` from `RationaleChip` (`t("ux.rationale.aria")` → "Ver justificação"). No layout jump (`inline-flex`, no width changes). Accessibility preserved.

Add reason key `cockpit_manual` (PT: "Controlado manualmente no cockpit." / EN: "Controlled manually in the cockpit.").

## 6. i18n additions

Append to `ux.rationale.reasons` in both `pt/common.json` and `en/common.json`:

```
card_matches_default
card_pkl_override
card_user_override
cockpit_manual
```

And add a small sibling block `ux.rationale.labels`:
```
inferred / recommended_default / based_on_current_inputs
manually_overridden / override_default / manual_control
recommended_apply
```

No hardcoded strings in components — use `t()` everywhere new strings appear.

## 7. Non-goals (explicit)

No changes to: prompts, engine, schema, migrations, PDF, demo flow, blueprints, generation-telemetry. No persistence of inferred values. No logbook persistence. No cockpit redesign.

## 8. QA after implementation

- `/clients/$id` (workbench) with a complete brief: split chip + recommendation row appear; clicking "Aplicar" updates the select and the chip flips to "manual".
- `/clients/$id` with `primary_goal` change: cockpit preset chip and summary update visually; no DB writes (verify via Network tab — no POST/PATCH).
- `/knowledge`: edit one MEV value → save → re-open → Volume card chip flips to `user_override`; reset → flips back to `default`.
- 375px Mobile Safari: popovers anchored `align="start"` already; verify no horizontal scroll.
- PT/EN toggle: all new keys translate; `defaultValue` fallback works for missing.
- Old plans without `brief.primary_goal`: `inferCockpitPreset` falls through to `moderate_recomp` default — no crash.

## Files touched

- `src/components/BriefEditor.tsx`
- `src/components/plan/IntensityCockpit.tsx`
- `src/routes/knowledge.tsx`
- `src/components/ux/RationaleChip.tsx` (no API change; only a small `dotOnly` variant if needed)
- `src/i18n/locales/pt/common.json`
- `src/i18n/locales/en/common.json`

No new files. No server-side changes. No migrations.
