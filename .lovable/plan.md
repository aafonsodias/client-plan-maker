# Round 4 — Forward-adapting transitions + background demo generations

Two parallel workstreams. First addresses the simulation engine (Round 4 proper). Second addresses the UX request: demo runs must continue while the trainer navigates the app and notify them when done.

---

## Part A — Forward-adapting block transitions

Today `archivePlanAndStartNextBlock` (src/server/blocks.functions.ts) re-runs the phased pipeline tagged with `block_number+1` but does not feed the *prior* block's adherence/RPE/volume reality back into the new prescription. The next block reuses default landmarks instead of adapting to what actually happened.

**Changes**
- **`src/lib/block-feedback.ts`** (new): pure function `summarizePriorBlock(plan, sessions)` returning per-muscle realised volume, mean RPE, adherence %, and a verdict (`under_recovered` | `on_target` | `under_loaded`) per muscle, using thresholds:
  - mean RPE ≥ 9 OR adherence < 70% → `under_recovered` → next block starts at `MEV` (not the curve default), shorter accumulation.
  - mean RPE 7–8.5 AND adherence ≥ 85% → `on_target` → continue MEV→MAV→MRV curve.
  - mean RPE ≤ 6.5 → `under_loaded` → start at `MEV+2`, push faster toward MRV.
- **`src/lib/prescribe-volume.ts`**: extend `prescribeMesocycle()` to accept an optional `priorBlockSummary` argument; per muscle it shifts the start landmark and slope based on the verdict.
- **`src/server/blocks.functions.ts` (`archivePlanAndStartNextBlock`)**: before kicking off the next phased run, fetch prior plan + sessions, call `summarizePriorBlock`, and pass the result through pipeline context so stage 2 + stage 3 prompts receive the adapted landmark table. Persist the verdict map onto `workout_plans.block_transition_summary` so the UI can show *why* the new block looks different.
- **`src/components/BlockTransitionDialog.tsx`**: add a compact "Adaptado a partir do bloco anterior" section listing per-muscle verdicts with tone chips (success/warn/danger via `src/lib/status-tone.ts`).

No new tables; reuses existing `workout_plans` / `workout_sessions` / `block_transition_summary`.

---

## Part B — Background demo runner (navigate-while-generating)

Today `DemoLabPanel` owns the polling loop. Closing the dashboard kills `setInterval`, the toast never fires, and the user can't tell whether the run is still alive.

**Architecture**
```text
RootComponent
 └─ DemoRunsProvider          (new context, mounted once, survives navigation)
      ├─ tracks runId(s) in state + localStorage
      ├─ polls getDemoRun every 1.5s for each active run
      ├─ fires sonner toasts on completion / failure
      └─ exposes { activeRuns, startRun, cancelRun }
 └─ <DemoRunsIndicator/>      (new floating chip, bottom-right, only when runs active)
 └─ <Outlet/>
```

**Changes**
- **`src/contexts/DemoRunsContext.tsx`** (new): provider + `useDemoRuns()` hook. Persists `{ runId, durationWeeks, startedAt }[]` to `localStorage` keyed by user id so a hard refresh resumes polling. On `done` → `toast.success` with an *Abrir plano* action that navigates to `/plans/$planId`. On `failed`/`cancelled` → appropriate toast. Cleans up storage entry on terminal state.
- **`src/components/DemoRunsIndicator.tsx`** (new): small amber pill fixed bottom-right showing current stage label + spinner + count if >1, click opens a popover with per-run progress (reuses the GATE_LABELS list) and a *Parar* button. Hidden when no active runs.
- **`src/routes/__root.tsx`**: mount `<DemoRunsProvider>` inside `AuthProvider`, render `<DemoRunsIndicator/>` next to `<Toaster/>`.
- **`src/components/DemoLabPanel.tsx`**: gut the local polling. `runInstant` now calls `useDemoRuns().startRun({ durationWeeks })` and returns immediately. The inline gate list still renders but reads its state from the context (so the dashboard view shows progress when user is there, and the floating indicator shows it everywhere else). Cancel button delegates to `cancelRun(runId)`.
- **No server changes needed** — `startDemoClientFull` is already fire-and-poll, which is exactly what this needs.

**Behaviour the user gets**
- Click *Instant: cliente + plano + logbook* → toast "Simulação iniciada em segundo plano".
- Navigate to /clients, /plans, /settings — amber pill stays visible bottom-right, updates stage live.
- When done → success toast with *Abrir plano* button; pill disappears.
- Hard refresh mid-run → pill comes back, polling resumes from localStorage.

---

## Files

**Created**
- `src/lib/block-feedback.ts`
- `src/contexts/DemoRunsContext.tsx`
- `src/components/DemoRunsIndicator.tsx`

**Edited**
- `src/lib/prescribe-volume.ts`
- `src/server/blocks.functions.ts`
- `src/components/BlockTransitionDialog.tsx`
- `src/components/DemoLabPanel.tsx`
- `src/routes/__root.tsx`

Approve to implement both parts in one pass?
