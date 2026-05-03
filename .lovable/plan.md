## Round 5B — Tour, jobs indicator, demo click-through, PT-PT/EN consistency

Four asks from the user, ordered by impact:

### 1. Demo "Cliente demo pronto" must be clickable + actually start a tour

Today the banner shows the demo client name as plain text and the only CTA is "Abrir plano demo". Clicking the name does nothing, and there is no guided tour anywhere — the "demo client" is just a seeded record.

**Build a real product tour**:

- Add `react-joyride` (Worker-safe, pure React, no native deps).
- Create `src/components/DemoTour.tsx` — a `<Joyride/>` driver tied to a `tourActive` flag in a small `TourContext`. Steps:
  1. Dashboard demo banner — "Este é o teu cliente demo com 1 ano de dados."
  2. Open client page (programmatic navigate) — show the assessment + photo + history.
  3. Open latest plan — show the multi-block "evoluiu de Bloco N-1" chip with the new adaptation popover.
  4. Inside plan: Volume section (MEV/MAV/MRV table + the new ↘ ajustado markers).
  5. Year view — adherence chart + "Adaptação" column (the just-built Round 5A surface).
  6. Demo Lab (founder only) — "Aqui podes correr novas simulações sem afetar a tua quota."
- Make the demo banner CTA actually launch this:
  - Whole banner becomes clickable → opens client page.
  - Add explicit **"Fazer tour"** button (sparkles icon) that sets `tourActive=true` and starts at step 1.
  - "Abrir plano demo" stays as the secondary action.
- Persist "tour seen" flag in localStorage so it doesn't auto-replay; banner keeps the button so the user can re-trigger anytime.

### 2. Unified background-jobs indicator (corner pill)

Right now only `DemoRunsContext` has a corner pill. Other long-running jobs (initial demo seed in `DemoClientBanner`, plan generation polling, block transitions) each render their own ad-hoc loaders.

**Generalise the indicator**:

- Rename `DemoRunsContext` → `BackgroundJobsContext` (keep a thin re-export shim so existing call sites compile during the swap).
- Job shape: `{ id, kind: "demo_seed" | "demo_lab" | "plan_generation" | "block_transition" | "year_advance", title, stage, totalStages?, status: "running"|"done"|"failed"|"cancelled", error?, openLink? }`.
- `BackgroundJobsIndicator` (renamed from `DemoRunsIndicator`) shows the count of active jobs as a tiny number badge on a single floating pill; click → popover lists each job with its stage + a "Abrir" link if `openLink` set + a "Parar" button if `cancelable`.
- Migrate existing producers:
  - `DemoClientBanner` seed run → register as `kind: "demo_seed"` instead of polling locally; remove its inline loader strip in favour of the global pill (banner still shows a "Abrir cliente"/CTA once `done`).
  - `DemoLabPanel` already uses the context — no change beyond rename.
  - `rotateDemoYear` button in the banner → register as `year_advance` so it gets the same indicator instead of just a toast.
- Keep the existing icon language: amber/loader while running, emerald/check when done, red/X on failure.

### 3. PT-PT vs EN consistency pass

Today `pt/common.json` mixes "tu" and "você" (`"no seu período"` next to `"remove quando quiseres"`), and many components hard-code PT strings (e.g. `DemoLabPanel`, `DemoClientBanner`, `BlockTransitionDialog`, `BlockAdaptationCard`). Result: switching to EN leaves user-facing PT strings on screen.

**This round (foundational, not the whole app)**:

- Decide voice once and document in memory: **PT = você** (formal/neutral), **EN = neutral 2nd person**. Memory rule added.
- Sweep `pt/common.json` to standardise on "você": rewrite all "tu/teu/contigo" forms to formal. Affected keys spotted: `dashboard.no_plans_hint`, `actions.continue_with_google`, plus a handful in `plan.json`.
- Move all hardcoded strings in the demo surface into `common.json` under a new `demo.*` namespace, EN + PT, and replace literals in:
  - `DemoLabPanel.tsx`
  - `DemoClientBanner.tsx`
  - `DemoRunsIndicator.tsx` / `BackgroundJobsIndicator.tsx`
  - `BlockTransitionDialog.tsx`
  - `BlockAdaptationCard.tsx`
  - `DemoTour.tsx` (new)
- Out of scope this round: full app sweep (assessment, intake, blueprint forms — they already largely use `t()` and would balloon the diff). Tracked as follow-up.

### 4. Memory updates

- "PT voice = você (formal). Never mix tu/você in the same surface. EN = neutral 2nd person."
- "All long-running work registers a job in BackgroundJobsContext so the corner pill is the single source of truth — no per-component spinners for jobs that outlive a click."
- "Demo client banner is the entry point to the product tour (react-joyride). Tour replays on demand via the banner button."

### Files

**Create**: `src/contexts/BackgroundJobsContext.tsx` (replaces DemoRuns), `src/components/BackgroundJobsIndicator.tsx`, `src/components/DemoTour.tsx`, `src/contexts/TourContext.tsx`.

**Edit**: `src/components/DemoClientBanner.tsx`, `src/components/DemoLabPanel.tsx`, `src/routes/__root.tsx` (mount providers + indicator), `src/contexts/DemoRunsContext.tsx` (re-export shim), `src/i18n/locales/pt/common.json`, `src/i18n/locales/en/common.json`, `src/components/BlockTransitionDialog.tsx`, `src/components/BlockAdaptationCard.tsx`.

**Add dependency**: `react-joyride`.

### Out of scope (separate rounds)

- Full app PT-PT sweep (only the demo + transition surfaces this round).
- Wiring real (non-demo) `workout_sessions` into `block-feedback` (Direction B from the prior plan).
- Hardening of the background runner across hard refreshes (resume polling) — separate.

Approve to implement.