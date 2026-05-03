## Round 5C — Tour reliability + background-runner hardening + PT sweep continued

Three follow-ups to the work just shipped, ordered by user impact.

### 1. Tour reliability (the most likely thing to break first)

The tour was wired up but not exercised — it relies on `data-tour` anchors existing on every step's route, and on Joyride finding them after a route change. Risks to fix:

- Add a small wait/retry: when the controlled `stepIndex` changes, verify the target exists in DOM after navigation; if not within ~1.5s, advance to the next step instead of letting Joyride sit on a missing target.
- Year view target — file is `src/components/YearView.tsx` mounted at `/clients/$clientId/year`; verify the route loader doesn't gate-render the `data-tour` element behind a loader. If it does, anchor moved one level up.
- Plan route step: when the demo client has no plan yet (rare but possible if seed failed mid-flight) the tour navigates to `/clients/$clientId` instead — already handled, but the next step's `data-tour="plan-block-chip"` won't exist there. Detect this and skip the plan-related steps.
- "Take tour" button: currently disabled implicitly via `!demoClient`. Add an explicit toast if user clicks it before seed finishes.

### 2. Background-runner hardening (Direction C from earlier)

`DemoRunsContext` already persists run ids to localStorage and resumes polling on mount, but a few rough edges remain:

- After hard refresh, the resumed run's `stage` says "client" until the first poll lands. Seed `stage` from the persisted snapshot so the indicator doesn't regress visually.
- Cap concurrency: if 3+ runs are in-flight, batch poll them in a single server function call (add `getDemoRunsBatch` server fn) instead of N parallel `pollFn` calls — small win, but matters once a founder kicks off several.
- The "remove on completion after 4s" timer races with the popover. Hold completed runs in the indicator for the popover's lifetime when it's open.
- Surface a real "Stop" outcome — today the toast says "a pedir para parar" but the run never visibly transitions; consume the `cancelled` flag to flip the indicator chip to red immediately.

### 3. PT-PT sweep, round 2

Last round only swept demo + landing-adjacent strings. Highest-traffic remaining surfaces with mixed tu/você or hardcoded PT-BR-ish forms:

- `src/i18n/locales/pt/plan.json` — flag and rewrite any "tu/teu/contigo" forms to formal.
- `src/i18n/locales/pt/assessment.json`, `pt/intake.json`, `pt/manual.json` — same sweep.
- Component-level hardcoded PT in `BlockTransitionDialog.tsx`, `BlockAdaptationCard.tsx`, `ResultsPanel.tsx` (mentioned a "Demo Lab" string), `clients_.$clientId.tsx` (free-text headers like "A carregar histórico…").
- Add an EN-only smoke pass: switch language to EN and visually confirm no PT leaks on the dashboard, clients list, plan page, year view.

### Out of scope this round

- Real (non-demo) `workout_sessions` feeding `block-feedback` (Direction B) — bigger piece, separate.
- Custom tour tooltips matching the brand (amber underglow). Keep stock styling for now.

### Files (expected)

- `src/contexts/TourContext.tsx` (retry/skip logic)
- `src/components/DemoClientBanner.tsx` (toast on early tour click)
- `src/contexts/DemoRunsContext.tsx` (batch polling, cancel UX, hold-on-popover)
- `src/server/demo-oneshot.functions.ts` (new `getDemoRunsBatch`)
- `src/i18n/locales/pt/{plan,assessment,intake,manual}.json` (voice sweep)
- `src/components/{BlockTransitionDialog,BlockAdaptationCard,ResultsPanel}.tsx` + `src/routes/clients_.$clientId.tsx` (move literals through `t()`)

Approve to implement.