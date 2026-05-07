# R71 — Demo Mesocycle Simulator

Path A (extend existing demo seeders).

## What shipped
- `simulateDemoMesocycle` server fn in `src/server/demo-sessions.functions.ts`
  - Refuses unless `clients.is_demo = true` AND `trainer_id = userId`
  - Generates 4/8/12 weeks of past `client_bookings` (mix done/no_show/cancelled, 1 low-adherence pocket, never future)
  - Mirrors `done` bookings into `workout_sessions` via existing `fabricateEntry`/persona profile (harder mid-block, deload last week if ≥6w)
  - Weekly `client_measurements` (weight + waist drift + noise, deterministic per clientId+week)
  - Pack accounting flows through `bump_pack_sessions_used` trigger
- DemoLabPanel: new "Mesocycle simulator" sub-card (4/8/12 selector + CTA + warning + summary toast w/ real counts)
- i18n keys `demo.sim.*` PT/EN; ES/HI mirror EN

## Safety
- Founder-gated UI (panel hidden unless email match)
- Server fn double-checks is_demo + ownership
- Confirm dialog before insert
- All rows tagged `notes: "[demo]"`

## Deferred
- Per-client demo reset (only full `wipeDemoContent` exists)
- Inserting failed sessions into `workout_sessions` (only `done` are mirrored; missed bookings live only in schedule)
- Adapting `programNextWeek` to consume the synthetic logbook

## Not touched
schema · migrations · routes · deps · AI calls · real clients · billing · engine
