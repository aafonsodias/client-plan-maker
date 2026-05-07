## R71 — Demo Mesocycle Simulator (audit + minimal safe build)

### Audit results

| # | Question | Finding |
|---|---|---|
| 1 | Demo client seed system? | Yes — `src/server/demo-client.functions.ts` + `demo-oneshot.server.ts` |
| 2 | `clients.is_demo`? | Yes (boolean default false) |
| 3 | `workout_plans.is_demo`? | Yes |
| 4 | `demo_runs` table? | Yes (with stage/status/cancelled) |
| 5 | Demo-year seeding? | Yes — `seedDemoYearForPlan` (13 archived blocks) |
| 6 | Rotate +1 year? | Yes — `rotateDemoYear` |
| 7 | Demo Lab surface? | Yes — `DemoLabPanel` (founder-only, gated to `aafonsodias@gmail.com`) |
| 8 | Global progress indicator? | Yes — `DemoRunsContext` + `DemoRunsIndicator` |
| 9 | Safe tables | `workout_sessions`, `client_bookings`, `client_measurements`, `client_packs` (via trigger) |
| 10 | Sessions seeded? | Yes — `seedDemoSessions` (capped at `plan.duration_weeks`, all `done`, persona-aware) |
| 11 | Measurements seeded? | **No** — gap |
| 12 | Feedback seeded? | Yes — `client_feedback` JSON via `maybePersonaFeedback` inside session rows |
| 13 | Bookings seeded? | **No** — gap (schedule/packs stay empty for demo clients) |
| 14 | 8-12 weeks possible without schema change? | Yes |
| 15 | Cleanup/reset? | Yes — `wipeDemoContent` (founder dashboard) |

**Chosen path: A** — extend existing demo seeders. The demo infra is mature; the only missing pieces are `client_bookings` and `client_measurements` plus a way to spread sessions over more weeks with realistic missed/no-show entries.

### Scope (deterministic, founder-gated, no AI)

Add **one** demo-only server fn `simulateDemoMesocycle({ clientId, weeks })` in the existing `src/server/demo-sessions.functions.ts` (extends an established demo-only pattern; no new file needed beyond i18n). The handler:

1. Refuses unless `clients.is_demo = true` AND `clients.trainer_id = userId` (returns `not_demo` error).
2. Picks the client's most recent ready plan (any block).
3. Generates **bookings** spanning the past `weeks` (default 12, range 4-12), at the pack's `weekly_frequency` (or 3/week fallback). Status mix per week, deterministic from `(clientId, weekIdx)` hash:
   - ~85% `done`
   - ~10% `no_show`
   - ~5% `cancelled`
   - skip 1 random week (low-adherence pocket)
   - never seed future bookings
4. For every `done` booking, also writes a matching `workout_sessions` row using the existing `fabricateEntry` + persona profile + `loadForWeek` (with mild week-over-week drift; week `Math.floor(weeks/2)` flagged as "harder", last week as "deload" if weeks ≥ 6).
5. Inserts `client_measurements` rows (weekly): `weight_kg` with small downward drift + noise, `waist_cm` slight reduction. Only if a prior measurement schema fits — uses `values` JSONB + `cadence='weekly'` (existing columns).
6. Pack accounting flows through the existing `bump_pack_sessions_used` trigger (no manual maintenance).
7. Returns `{ inserted: { bookings, sessions, measurements }, weeks, adherencePct }` for a real-counts toast.

### UI (extends DemoLabPanel only)

Add a third action row in `src/components/DemoLabPanel.tsx`:
- Segmented `4 / 8 / 12` weeks selector
- Button **"Simular 12 semanas"** / **"Simulate 12 weeks"**
- Client picker = most recent demo client (auto-pick; no UI list)
- Confirm dialog if the demo client already has bookings: PT "Isto vai adicionar histórico demo. Continuar?"
- After completion: toast with real counts: *"12 semanas · 34 sessões · 3 falhas · 4 medições · adesão 87%"*
- Permanent demo-data warning chip already present in panel header; reinforce in the toast description: *"Dados demo. Não usar em clientes reais."*

No new route. No new dependency. No AI call. No schema change.

### i18n (PT/EN; ES/HI mirror EN)

New `common.json` keys under `demo.sim.*`: `cta`, `running`, `weeks_label`, `confirm_replace`, `summary`, `summary_partial`, `warning`, `no_demo_client`, `error_not_demo`.

### Files touched

- `src/server/demo-sessions.functions.ts` — append `simulateDemoMesocycle` (~120 lines)
- `src/components/DemoLabPanel.tsx` — add weeks selector + button + confirm + summary toast
- `src/i18n/locales/{pt,en,es,hi}/common.json` — `demo.sim.*` keys
- `mem/features/demo-year.md` — append note about the new simulator
- `.lovable/r71-simulator.md` — short audit + run notes

### Verification

- `tsc --noEmit` clean
- Run on a demo client → check `/schedule` shows past bookings with mix; `/clients/$id` shows measurements; pack `sessions_used` matches `done` count via trigger
- Refuse on a non-demo client (manual smoke)
- 375px Demo Lab layout intact

### Out of scope (deferred)

- New insights/analytics
- Reset of just-this-client demo history (use existing `wipeDemoContent` for full reset)
- Adapting `programNextWeek` to the synthetic logbook
- Recurrence/cron
