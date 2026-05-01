I checked the app state and database. The current problem is not that the brief is missing: the plan `819c0eef-b7d5-4a37-95c3-b8705a474615` has a valid `brief` JSON object, but it is also marked `generation_status = 'in_progress'` with legacy per-day metadata (`days_per_week: 6`) and an empty finished `plan_data.weeks`. That makes the client page show the old “generation in progress 1/24 days” banner and the plan list opens the finished-plan route (`/plans/:planId`), which is empty. Separately, the “Brief preview 8/14” badge is assessment-section analysis coverage, not the Stage 1 brief itself, and it is stuck partly because the pre-stage analysis fires many AI calls concurrently and hits rate limits.

Plan:

1. Fix the current stuck UI routing on the client page only
   - In `src/routes/clients_.$clientId.tsx`, make plan-list links for phased draft plans open `/plans/$planId/brief` instead of `/plans/$planId` when the row has `generation_state.stage === 'brief'` and a `brief` exists.
   - Expand the client page plan query to include `brief` and `generation_state` so it can make that decision.
   - This fixes “Ao abrir continua vazio” because the visible draft card will open the brief review screen, not the empty finished plan view.

2. Stop legacy resumable-plan UI from picking up phased Stage 1 plans
   - Update `detectResumablePlan()` to ignore any plan with `generation_state.stage` set to a phased stage (`brief`, `blueprint`, etc.).
   - Keep the legacy “generation in progress 1/24 days” banner only for legacy per-day generation rows.
   - This removes the incorrect “Geração anterior em curso — 1/24 dias feitos” banner for a phased plan.

3. Make “Começar de novo” actually clear phased stuck drafts too
   - Update `discardResumable()` so after deleting the current resumable plan it also refreshes the plan list from the database.
   - If the stuck row is a phased draft, surface it as a normal plan/brief link instead of legacy resume progress; no generation logic changes.

4. Fix the brief preview badge so it does not fire a burst of AI calls
   - Change `triggerSectionAnalyses()` from parallel `Promise.allSettled` fire-and-forget to a small sequential/limited loop so it does not exceed rate limits.
   - Keep it scoped to pre-stage coverage only; do not touch Stage 2, Stage 3, Stage 4, or Stage 5 generation.
   - The badge may still show less than 14 when fields are empty, but it should stop getting stuck because of request-rate failures.

5. One-time database cleanup for the current corrupted mixed-state row
   - Run a migration/update to normalize the current plan: keep the valid `brief`, but clear the legacy in-progress marker by setting its `generation_status` to a non-legacy value (e.g. `pending`) and removing legacy `generation_meta` if needed.
   - Do not delete the valid brief.
   - Confirm the row after the update: `id`, `generation_status`, `generation_state`, `has_brief`, and day-row count.

Files to touch:
- `src/routes/clients_.$clientId.tsx` only for UI/routing/resume detection and pre-stage throttling.

Database change:
- One targeted cleanup/update for plan `819c0eef-b7d5-4a37-95c3-b8705a474615` so the existing valid brief is reachable and the legacy resume banner disappears.