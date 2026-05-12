## Scope
Two targeted fixes inside `src/routes/clients_.$clientId.tsx` (+ `src/lib/assessment-phase.ts`). No PDF redesign, no slides sync, no profile photo work.

---

## A) Movement Screen completion gate

### Current rule (wrong)
`screen` is complete only when every pattern is either `screen_not_assessed[p] === true` **or** has `formScore(fc) >= 3`. That treats a deliberately-saved low score (0–2 of 5) as "missing" and blocks Finish.

### New rule
A pattern counts as **handled** when any of:
1. `screen_not_assessed[p] === true`, **or**
2. `Object.keys(a[`${p}_form_criteria`] ?? {}).length > 0` (the trainer toggled at least one criterion — true *or* false — meaning the pattern was deliberately assessed), **or**
3. `a[`${p}_capacity`]` has any populated value (capacity tested counts as assessment evidence).

`screen` is complete when **all** patterns in `PATTERN_IDS` are handled by the above. `formScore` is no longer involved in completion — it only feeds the implication generator.

Optional capacity fields (strict push-ups, OHP 1RM, lunge reps, BSS 1RM, Cooper, Rockport, etc.) and any "Show advanced fields" content remain purely optional and never gate completion.

### Files
- `src/lib/assessment-phase.ts` — replace the `case "screen":` predicate with the rule above (helper `isPatternHandled(p, a)`). Single source of truth — sidebar and Finish both call this.
- `src/routes/clients_.$clientId.tsx` — update the `CompletionStrip` line at L3409 so the count uses *handled* patterns (not `formScore >= 3`). Update missing-items behaviour: if `screen` is reported missing, the `MissingItemsPanel` reason key resolves to a sentence that names which patterns are still unhandled (we add a small `describeMissingScreen(a)` helper that lists pattern ids).

### Acceptance
- Pattern with form score 0/5, 1/5, 2/5 (criteria touched) → handled, doesn't block Finish.
- Pattern with all criteria explicitly unchecked → handled (object has keys).
- Empty optional capacity fields → never block Finish.
- Untouched pattern not marked "Not assessed" → still blocks, and the missing-items panel names exactly which pattern.
- Sidebar checkmark and Finish CTA agree.

---

## B) Standardise Prescription Implications across all 15 sections

### Current state
`RxImplications` already exists and is rendered for **10** sections: parq, risk, training, goal, anthro, readiness, lifestyle, nutrition, screen, performance. Each has a `buildRxItems_*` deterministic builder that always returns at least one card (positive/neutral fallback included). Visual shell is unified.

### Missing sections (5)
`injuries`, `history`, `meds`, `mobility`, `posture` currently render only a `CompletionStrip` whose secondary line is the raw i18n key `*_block.complete_meaning` (untranslated → shows raw key in the UI).

### Changes
1. **Add 5 builders** in the same file, mirroring the existing pattern (≤4 cards each, always one fallback):
   - `buildRxItems_injuries(a, injuriesCount)` — reads `assessment_injuries` count + `pain_areas` + `pain_notes` + `no_injuries`. Surfaces: regions affected → exercise pool restrictions; pain notes → ROM caveats; "no injuries" → green clear card; missing → "complete or mark as no injuries before final prescription".
   - `buildRxItems_history(a)` — reads `years_training`, `previous_program_style`, `max_lifts`. Surfaces: training age tier + load anchor (1RM available → use it; missing → estimate from RPE).
   - `buildRxItems_meds(a)` — reads `medications`, `med_flags[]`, `no_meds`. Surfaces: beta-blocker → HRR unreliable, use RPE; anticoagulant → no contact/impact; insulin → glycaemic window; "no meds" → clear; missing → "intensity zones less reliable".
   - `buildRxItems_mobility(a)` — reads the 6 `ext_mob_*` 1–5 scores. Cards for any score ≤2 (region-specific drill / load caveat); fallback "mobility within working range".
   - `buildRxItems_posture(a)` — reads `standing_posture_notes`, `known_imbalances`, `dominant_side`. Surfaces: imbalance → unilateral bias; dominant side → record asymmetry baseline; otherwise neutral.
2. **Extend `RxImplications` `sectionId` union** to include the 5 new ids and route them in the `switch`. For `injuries` accept an extra prop `injuriesCount` (lifted in the route the same way the validator already lifts it).
3. **Wire the 5 sections** in the route: replace each section's `footer={... <CompletionStrip .../>}` with a footer that renders `<RxImplications sectionId={...} ... collapsible summary={...} summaryDescription={...} />` whenever the section is complete (matches the existing `risk`/`screen` pattern). Section header copy (`*_block.complete`) stays the same — only the broken `complete_meaning` raw-key line is removed.
4. **Update `screen` builder** so a low-score pattern (0–2) generates a *prescription implication* (e.g. "Squat scored 1/5 — regress to box squat / partial ROM, no load progression until ≥3"). The existing "weak" branch already exists; we extend it to itemise 0/5 and 1/5 distinctly and add a "low_score_handled" note so users see a clear message instead of completion blocking.
5. **No new translation keys**. All implication titles/bodies are already inline strings (PT, matching the existing 10 builders). This eliminates raw-key leakage everywhere by construction.

### Acceptance
- All 15 listed sections render an `RxImplications` panel.
- Completed-but-unremarkable sections show a positive/neutral card (never silent).
- Missing data shows a useful "what's missing and why it matters" card.
- Low movement scores generate an implication card; they no longer block Finish.
- The `screen` implication names exactly which patterns are unassessed only when they're genuinely unhandled.
- No raw `*_block.complete_meaning` (or any `*.*` key) appears in the UI.
- Existing strong implications (risk, training, goal, etc.) untouched.

### PDF — what remains
`buildAssessmentImplications` (`src/lib/assessment-implications.ts`) already feeds the PDF and is unchanged. Future work (out of scope this round): port the new 5 builders into `assessment-implications.ts` so the PDF "Implications" section also covers injuries/history/meds/mobility/posture. Data shape is already compatible (`Implication[]`); only the rule bodies need to be moved/translated to i18n keys for the PDF renderer.

---

## Files changed
- `src/lib/assessment-phase.ts` — `case "screen"` rewrite + helper `isPatternHandled`.
- `src/routes/clients_.$clientId.tsx` — Movement Screen completion strip count fix; 5 new `buildRxItems_*` functions; extended `RxImplications` union; wire `<RxImplications>` into injuries/history/meds/mobility/posture sections; small `describeMissingScreen` helper.

No DB / migration / i18n file changes. Typecheck only.
