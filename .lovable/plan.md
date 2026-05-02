## What's broken / missing (from your screenshots & message)

1. **Microcycle stuck at "1/2 done"** — the green "Aprovar microciclo" button lit up while Day 2 hasn't been generated. The gate logic only checks `doneCount === sessionsPerWeek`, so when only `day1` exists in `days[]` for a 2-day plan, the count looks complete the moment Day 1 finishes — but only because we never created the Day 2 row to mark it `pending`. Result: false "ready" state, no Day 2 visible.
2. **No auto-advance after approving a day** — `approveDay1AndContinue()` just flips a flag; trainer still has to click "Generate Day 2".
3. **`<UNKNOWN>` everywhere in Movement Competency** — root cause: the demo pipeline (`runDemoPlay`) jumps straight from `createDemoClient` → `startPhasedPlanDraft` (Stage 1) without ever calling `analyzeAssessmentSection` for the per-section pre-stages. Stage 1 reads `assessments.section_analyses` and finds it empty, so the AI has nothing to merge for `movement_competency_summary` → emits "<UNKNOWN>" placeholders. Same reason equipment looks under-filled in the brief rail.
4. **Bots have no place to complain, and no way for real users to do the same** — `client_feedback` JSONB is being written by the seeder but never rendered anywhere.
5. **Equipment list is 8 hard-coded items** — needs to grow to a real searchable library used by both intake and the client edit form.
6. **i18n audit** — you already have the polished prompt; I'll just make sure we don't regress while doing the other work.

## Plan

### 1. Fix the microcycle gate + auto-advance (`src/routes/plans.$planId.microcycle.tsx`)

- Replace the `allDone` calculation: it must require **`doneCount === sessionsPerWeek` AND `days.length >= sessionsPerWeek`**. Missing rows (no DB record yet) count as "not done", not "done". This kills the false-ready state.
- After Day 1 is approved (`approveDay1AndContinue`), immediately fire `regenDay(2)`; when Day 2's realtime payload lands as `done`, fire `regenDay(3)`; etc. — one queued auto-generation triggered by the previous day's success. Trainer still has to **approve** each subsequent day before the next one fires (cheap insurance against a chain of bad days). Add a small per-day `approveDay(n)` affordance that mirrors the Day 1 approve button.
- Keep "Regenerate" available per-day; never auto-fire if a day is already `pending`/`done`.

### 2. Fill `movement_competency_summary` for demo personas

The honest fix is to **run the per-section pre-stage analyses inside `runDemoPlay` before Stage 1**, not to fake the brief output. That makes the demo represent the real flow.

- In `src/server/demo-play.functions.ts`, between `createDemoClient` and `startPhasedPlanDraft`, loop over the 7 assessment sections (`anthro`, `goal`, `history`, `lifestyle`, `mobility`, `posture`, `screen`, `parq`, `risk`, `training`) and call `analyzeAssessmentSection({ assessmentId, section })` for each (parallelized). This is what real trainers trigger when they fill the form; the demo should too.
- Add a step `"section_analyses"` to the `StepKey` enum + HUD so the orchestrator shows it.
- Cost note: this adds ~10 fast Haiku calls per demo client. Acceptable for a founder-only Dev Lab tool.

### 3. Bot + user feedback / complaints surface

A two-way "Feedback" tab so bots and humans complain in the same place.

- New table `plan_feedback` (separate from per-session `client_feedback` so general "the app feels X" comments aren't tied to a workout):
  ```
  id, client_id, plan_id (nullable), author ("client"|"trainer"|"bot"|"system"),
  category ("pain"|"question"|"complaint"|"praise"|"app_bug"|"ux"),
  body text, status ("open"|"acknowledged"|"resolved"),
  created_at, resolved_at, metadata jsonb
  ```
  RLS: trainer can read/write rows for clients they own; bots write via service role inside `seedDemoSessions` and the new "tick".
- Update `seedDemoSessions` and `advanceSimulation` to insert into `plan_feedback` (not just inside `workout_sessions.client_feedback`) when the persona has a relevant grievance — once per generation event, archetype-flavoured.
- Render a **Feedback** panel:
  - On the client detail page (`src/routes/clients_.$clientId.tsx`) as a new tab/section showing all `plan_feedback` for that client + a "Add note as client" textarea (so trainers can simulate / log a real complaint they heard verbally).
  - Aggregate view at `/forge` (existing leaderboard route) — top-N open complaints across all bots, so you spot patterns ("3 bots complained about Day 3 being too long").
- Surface per-session `client_feedback` inline in the logged session row on the plan page (small chip + tooltip) so bot grievances don't hide in the JSON.

### 4. Searchable equipment library

- New file `src/lib/equipment-catalog.ts` with ~40 items grouped by category: Free weights (barbell, EZ bar, dumbbells, kettlebells, weight plates, hex bar), Machines (cable machine, smith machine, leg press, hack squat, leg curl, leg extension, lat pulldown, seated row, chest press, pec deck, calf raise), Racks/benches (squat rack, power rack, flat/incline/decline bench, GHD), Bodyweight/accessory (pull-up bar, dip station, parallettes, rings, TRX, ab wheel), Conditioning (rower, ski erg, assault bike, treadmill, stationary bike, jump rope), Mobility (bands, foam roller, lacrosse ball, slam ball, med ball), Misc (bodyweight only). Each: `{ id, en, pt, category, aliases[] }`.
- Replace the 8-item `EQUIPMENT_OPTIONS` in `clients_.$clientId.tsx` and the `EQUIPMENT_IDS` in `intake.$token.tsx` with a shared `<EquipmentMultiSelect>` component (Command/cmdk popover with search across `en`, `pt`, and `aliases`, grouped by category, multi-select with chips).
- Demo personas: keep their human-readable strings; intake stores stable IDs for new clients but the brief AI normalizes both shapes.
- Demo seed: now picks 6–10 items per archetype from the catalog (not 4–6) so the brief panel feels populated.

### 5. i18n audit handoff

- I won't touch `clients_.$clientId.tsx` strings this turn (2800-line file, mechanical task — your Opus prompt is the right tool). I'll add a `// TODO(i18n-audit)` marker at the top of the file pointing to `mem://constraints/i18n-audit` so we don't lose track.
- Save a memory note recording that the audit is delegated and the assessment namespace is the target.

### 6. Out of scope this turn (unless you say otherwise)
- Concierge AI route navigation chip improvements
- Assessment-form collapse on the client page (still deferred — risk of regression while feedback surface lands)
- Stripe/quota changes

## Technical details

- **Files touched**: `plans.$planId.microcycle.tsx`, `demo-play.functions.ts`, `demo-sessions.functions.ts`, `clients_.$clientId.tsx` (equipment select + feedback panel only), `intake.$token.tsx` (equipment select), `forge.tsx` (complaints widget), new `lib/equipment-catalog.ts`, new `components/EquipmentMultiSelect.tsx`, new `components/FeedbackPanel.tsx`, new migration for `plan_feedback`.
- **Migration**: create `plan_feedback` with RLS (`trainer owns client`), index on `(client_id, created_at desc)`, FK to `clients.id` cascade.
- **Auto-advance loop**: implemented as a `useEffect` watching `days` — when the highest-numbered approved day's `n+1` row is missing AND we've hit "approve" for `n`, kick `regenDay(n+1)`. Re-entrancy guarded by `generatingSet`.

## What you'll see when this ships

- Margarida's plan generates Day 1 → you click Approve → Day 2 starts immediately, no extra click. Movement Competency rail shows real Portuguese sentences instead of `<UNKNOWN>`.
- Equipment list in intake/edit is a searchable popover with 40+ items.
- New "Feedback" tab on each client showing bot complaints + your own notes; `/forge` shows the top open complaints across the whole demo population.

Reply **continua** to ship it, or tell me which numbered item to drop / reprioritise.