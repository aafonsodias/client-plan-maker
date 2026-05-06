
# Step 4B — Clarity & framing pass (no schema, no engine changes)

## What's already done (from earlier rounds)

- `BriefEditor` already renders `inferTier` chip under "Experiência de treino" and `inferSplit` chip under "Divisão", both wired to `RationaleChip` with `mode`-aware visibility. No payload/engine writes.
- `/knowledge` already compares each card to `SYSTEM_DEFAULT_RULES` via `volumeRationale / intensityRationale / recoveryRationale / progressionRationale` and feeds the result into `RationaleChip`. `diffCount` has a `try/catch` → safe fallback to "default" on JSON failure.
- `IntensityCockpit` already shows preset summary chip + a single "Controlo manual" toggle. **No per-knob dots** — already compliant.

## What this step actually changes

### 1. Copy rename (i18n only)

`src/i18n/locales/pt/common.json` → `ux.rationale.labels`:
- `"override_default": "Sobrepor default"` → `"Personalizar regra"`

`src/i18n/locales/en/common.json` → `ux.rationale.labels`:
- `"override_default": "Override default"` → `"Customize rule"`

`manual_control` / `hide_manual_control` already correct in both locales — leave as-is.

The `editLabel={t("ux.rationale.labels.override_default")}` call sites in `src/routes/knowledge.tsx` (4 cards) automatically pick up the new copy. No code changes needed there.

### 2. Verification (no edits)

Confirm and report:
- Tier chip visible in Lab mode for every `confidence` value; in Quick mode only when `assumed`.
- Split chip visible in Lab mode always; in Quick mode only when coach diverges from the recommendation.
- Knowledge cards: chip says "default" for system match, "pkl" when card differs, "manual" only when the user just edited but hasn't saved (current code returns `pkl` for any non-default — acceptable; "manual" surfacing is reserved for the in-flight edit case which the current schema doesn't track separately).
- Cockpit knob grid still hidden until "Controlo manual" is toggled and `mode === "lab"`.
- 375px viewport: BriefEditor inference rows wrap; `RationaleChip` PopoverContent uses `max-w-[calc(100vw-2rem)]` — no overflow risk.

### 3. Out of scope (explicitly not touched)

- No Quick/Lab toggle changes
- No auto-approval
- No schema/migration
- No engine, payload, or generation prompt edits
- No logbook persistence
- No cockpit per-knob dots

## Files to edit

- `src/i18n/locales/pt/common.json` (1 string)
- `src/i18n/locales/en/common.json` (1 string)

That's it. Two-line change.

## Risks

- Translation key `override_default` semantically drifts from its name (key says "override", value says "personalize"). Acceptable — renaming the key would touch 4+ call sites and the schema-readiness audit for Step 5 may want to keep stable. Note for follow-up.
- ES/HI locales fall back to EN per the supported-locales rule — they will pick up "Customize rule" automatically.

## What ships in 4C

- Decide whether `inferLogbookMode` chip should appear on session pages (display-only).
- Decide whether to surface "Manual control" copy uniformly across cockpit + knowledge cards.
- Optional: rename the `override_default` i18n key to `customize_rule` once we're sure no external surface depends on it.

## Acceptance check

- ✅ UI more explainable, not more complex (only label copy changes).
- ✅ No new automatic decisions persisted.
- ✅ PT-PT no new English.
- ✅ Knowledge comparison fallback safe (existing `try/catch` in `diffCount`).
- ✅ Mobile 375px clean (no layout touched).
