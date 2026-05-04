## Round 34 — Honest microcycle, single-page flow, week-at-a-glance

Three tracks. Track A & B ship in this round; Track C (drag-and-drop volume rebalancer) gets scaffolded but the full live-metrics editor lands in R35 because it touches volume math, AI critique and DnD all at once and you said "looks → function → ease, beautiful over fast" — better to do it once well.

---

### Track A · Stop the white-screen, restore the journey thread

**A1. White screen on refresh**
Likely cause: `useEffect` in `MicrocyclePanel.kickWeek()` fires server fn on mount when no day rows exist, and any throw inside the auto-kick (no try/catch around `generateAllDaysFn`) kills the route during SSR hydration. Wrap `kickWeek` in try/catch + toast. Also harden `clients_.$clientId.tsx` derived state (`expandedStage` reads, `inlineBrief?.approvedStages`) against partial loads with optional chaining + null guards. Add a top-level error boundary inside the route's component so a component throw renders a "Something went wrong — Reload" card instead of a blank page.

**A2. Persist & restore where you are**
Add `expandedStage` to `localStorage` keyed by `clientId` (`forge:lastStage:{clientId}`). On mount: if a draft exists for the persisted stage, expand it. Otherwise auto-pick the deepest non-approved stage (brief → blueprint → microcycle → progressions). No more "open and hunt for the thread" after refresh.

**A3. Sections sidebar collapses with the assessment**
Move the `<aside>` sections nav (lines 1582–1597) **inside** `<AssessmentSection>` so it lives under the same collapse. When assessment is collapsed → sidebar disappears with it. When expanded → sidebar reappears. The grid becomes single-column when collapsed.

**A4. Auto-collapse assessment once brief is approved (default)**
`AssessmentSection.defaultCollapsed` already supports `readyPlanForAssessment`. Tighten it: **once `inlineBrief.approved === true`, default to collapsed always** (currently keyed only on `readyPlanForAssessment`). Persist user override in localStorage so if they manually expand, it stays expanded for that session.

**A5. Auto-collapse-and-advance chain**
Already partially wired in onApproved callbacks. Audit + complete:
- Brief approved → collapse Stage 1, expand Stage 2, kick blueprint generation
- Blueprint approved → collapse Stage 2, expand Stage 3, kick microcycle generation
- Microcycle approved → collapse Stage 3, expand Stage 4, kick progressions
- Progressions approved → collapse Stage 4, scroll to PDF download

**A6. Restore "Stage 1 — Brief approved" title format**
In `StageCard.tsx` the emerald collapsed strip currently reads `${title.toLowerCase()} · approved`. Change for `tone="stage"` to `Stage ${stageNumber} — ${title} approved` (same shape as brief), keeping the emerald colour + dot prefix. Brief stays amber (already correct).

---

### Track B · Honest, week-at-once microcycle

**B1. Drop the day-1 gate, generate the whole week at one click**
In `MicrocyclePanel.tsx`: remove `day1Approved` / `approveDay1AndContinue` / `approveDay` / `approvedDays` state + the cascading `useEffect`. The week is one unit. Render all `sessionsPerWeek` day cards simultaneously, each in `pending → generating → done` state. Single bottom CTA: "Approve microcycle" enabled when all days are `done`.

**B2. Honest progress, slow but truthful**
Today: counter jumps 0 → 5 because Promise.all resolves all at once, and the UI shows "0 / 5" until the bulk fn returns. Fix:
- Server side: `generateMicrocycleDays` already calls `markPending` then `runDay` per worker, with realtime push from `workout_plan_days`. Add a `console.log` per finished day so logs are useful.
- Client side: stop pre-filling `generatingSet` for all days at start. Instead, derive UI state purely from rows: row exists + status `pending` = generating, status `done` = done, missing = "queued". The realtime channel already updates rows as each day finishes → bar moves day-by-day, not 0→100.
- Replace fake `etaSec` with a measured ETA: track timestamp of first `pending`, compute average seconds per completed day, multiply by remaining. Falls back to 15s/day prior.
- Show "Day 3 ready" toasts as each finishes. No more blank "Day 1 — generating…" while 5 are actually running in parallel.

**B3. Autosave & resume**
Already half-there: the server upserts each day to `workout_plan_days` as it finishes. Add a "Retry failed days" button that re-runs `generateMicrocycleDays` with `dayIndices` = only the `error`/missing ones, instead of re-doing the whole week. If you refresh mid-generation, the realtime channel + status query immediately rehydrates exactly where it stopped.

**B4. Week-at-a-glance grid (desktop) + swipe (mobile)**
New component `WeekGrid.tsx`:
- Desktop (`lg+`): CSS grid `grid-cols-{sessionsPerWeek}`. Each column = one day. Rows = exercise rows (name + sets×reps + RPE chip). Click a cell → opens a side `<Sheet>` with full DayCardEditable (warm-up, activation, rationale, swap controls). Compact, dense, scannable.
- Mobile (`<lg`): horizontal snap-scroll (`overflow-x-auto snap-x snap-mandatory`), one day per viewport width. Native swipe. Day pager dots at the top.
- Reuses `DayCardEditable` for the detail sheet so we don't re-implement editing.

**B5. Approve button on individual day cards — nicer**
In `DayCardEditable`, the per-day approve button is currently muted gray. Swap to amber-gradient pill (matches brief tone — "approve this artifact") with subtle hover lift. Keep the final microcycle approve button emerald (already done) so tone hierarchy reads: amber per-day → emerald commit-the-week.

---

### Track C · Live volume rebalancer (scaffold now, ship R35)

This is the headline feature you described (drag exercises between days, MEV/MAV chips update live, AI critiques the change). Scope is real: drag library, volume diff math, AI streaming critique, undo. Doing it half = doing it badly.

**This round (scaffold only)**:
- Add a read-only `<WeekVolumePanel/>` above the WeekGrid showing current per-pattern volume vs MEV/MAV/MRV with status dots (uses existing `src/lib/volume-compute.ts` + `volume-landmarks.ts`).
- Render it always so trainers immediately see "this week is 18 sets chest, 6 sets legs — overcooked / undercooked". No DnD yet, but the math is visible and honest.

**R35 (next round)**:
- DnD via `@dnd-kit/core` between WeekGrid columns
- Live recompute on optimistic state, autosave on drop
- Streaming AI critique panel ("you moved bench from D2 to D4 — D4 now has 22 sets pressing, that's above MAV for novice; consider moving DB row to D2 instead") via existing `ask-forge` server fn
- Undo stack
- Add to backlog as P0 for R35.

---

### Files to touch

`src/components/MicrocyclePanel.tsx` (B1, B2, B3, A1), `src/components/DayCardEditable.tsx` (B5), `src/components/StageCard.tsx` (A6), `src/routes/clients_.$clientId.tsx` (A3, A4, A5, A1, A2 + mount WeekGrid + WeekVolumePanel), `src/components/WeekGrid.tsx` (new — B4), `src/components/volume/WeekVolumePanel.tsx` (new — C scaffold), `src/server/phased/stage3-microcycle.functions.ts` (B2 logging), `.lovable/backlog.md` (R35 items), `mem/principles/honest-progress.md` (new memory: "Never display fake 0→100 jumps; counters reflect real persisted state from realtime channel").

### Out of scope this round

- Full DnD live-rebalancer (R35, scaffolded only)
- Adding nutrition/mobility to drag pool
- Per-exercise alternative suggestions (R36)

