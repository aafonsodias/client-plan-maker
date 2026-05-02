I’ll fix this as an urgent “demo/logbook reliability + plan readability” pass. The goal is: clicking Instant should visibly progress through gates, produce a complete plan, fill logbook rows automatically, then show Results without you needing to babysit it.

Implementation plan:

1. Fix the Instant demo pipeline crash
- Update `createDemoClientFull` / `runDemoPlay` so `generateMicrocycleDays` is called with the required `dayIndices` array.
- Derive the exact day list from the generated blueprint/session frequency instead of assuming defaults.
- Make the one-shot path report the failing gate clearly instead of leaving a draft plan stuck in microcycle.
- Add rollback/cleanup for incomplete instant runs where possible, so failed demos don’t leave confusing half-created clients/plans.

2. Add visible processing gates under “Instant”
- Replace the single spinner with a compact progress panel in `DemoLabPanel`.
- Gates: Create client → Brief → Blueprint → Microcycle → Progressions → Finalize → Fill logbook → Results ready.
- Show each gate as pending/running/done/failed, with a stop/cancel control that stops the client-side chain from continuing.
- For reliability, I’ll move from one opaque server call to step-by-step orchestration from the panel, while still using the existing server functions.

3. Make logbook auto-fill actually happen
- Ensure `seedDemoSessions` runs after finalization and inserts realistic `workout_sessions` for at least the first 2 weeks.
- Add better return reporting: sessions inserted, sessions skipped, and any seeding error.
- Make Results auto-open after seeding and navigate directly to the generated plan/results state when Instant finishes.
- Add a “Fill demo logbook now” recovery button on plans with zero sessions, so existing broken demo plans can be populated without recreating everything.

4. Improve Results/logbook table usefulness
- Upgrade the Results logbook from a session summary into a table that shows plan-vs-actual: date, week/day, exercise, planned sets/reps/RPE/rest, actual sets/reps/load/RPE, estimated volume/tonnage, and feedback.
- Keep RPE pills color-coded using the existing `rpe-tone` scale.
- Add planned vs logged weekly volume comparison so the old “W1 ~561 reps” idea becomes a useful calculation instead of decorative noise.

5. Clean the mesocycle table header and editing confusion
- Remove the top week chips that currently show `W1 ~reps · RPE` because the week columns already show RPE context.
- Replace them with a subtle note or compact metric only when it’s meaningful for prediction/plan-vs-actual.
- Improve the cell editor: label the four fields clearly (`sets`, `reps`, `RPE`, `rest`) so it doesn’t look like “3 things but 4 values”.
- Make RPE coloring more obvious and consistent in table cells.

6. Cap preparation duration and stop 33-minute warmups
- Add a deterministic sanitizer for generated days before saving them.
- Preparation (`warmup + activation + dynamic stretches`) will be capped at 15 minutes maximum; normal default target will be 8–12 minutes.
- If AI returns too much prep, compress it into: 3–5 min general warmup, 2–4 min mobility/dynamic, 2–4 min activation/inhibition, then first-exercise potentiation.
- Apply the same sanitizer in bulk/finalization paths so new plans cannot keep inflated prep blocks.

7. Make RPE/progression less “snail-like” but still client-aware
- Adjust demo RPE/load profiles for athletic/intermediate personas like return-to-sport ACL so they don’t start like a frail beginner.
- Add missing archetypes (`returner_post_acl`, `advanced_powerlifter_cut`, `hypermobile_yoga_teacher`, `shift_worker_poor_sleep`, etc.) to the demo progression profiles.
- Update progression generation guidance so RPE progression depends on age, training age, stress, sleep, injuries, and current capacity: conservative only when the data justifies it.

8. Improve plan summary and default expansion
- Make the plan summary expanded by default.
- Add a compact client context strip in the summary: age, sex, training age/experience, main goal, injury/medical flags, recovery/stress/sleep markers, and key movement limitations.
- Fix the “no section analysis / UNKNOWN” issue for demo clients by building the brief from raw assessment data when section analyses are empty, instead of letting Stage 1 hallucinate an empty generic beginner profile.

Files I expect to touch:
- `src/components/DemoLabPanel.tsx`
- `src/server/demo-oneshot.functions.ts`
- `src/server/demo-play.functions.ts`
- `src/server/demo-sessions.functions.ts`
- `src/lib/demo-personas.ts`
- `src/server/phased/stage1-brief.functions.ts`
- `src/server/phased/stage3-microcycle.functions.ts`
- `src/server/phased/stage5-bulkfill.functions.ts`
- `src/components/MesocycleTableView.tsx`
- `src/components/ResultsPanel.tsx`
- `src/components/SessionDayView.tsx`
- `src/routes/plans.$planId.tsx`

No database schema change should be required for this pass; the needed `workout_sessions` and feedback structures already exist.