# Plan-page polish + demo "Results" view

Four focused changes, all in service of: **a finished demo should land on a flashy, filled-up results view — not on the empty daily logbook.**

## 1. Table is the default plan view

In `src/routes/plans.$planId.tsx` (`ViewMode`):

- Change `useState<"cards" | "table">("cards")` → `("table")`.
- Reorder the toggle so **Table** is the first/left button (matches image 3 mental model).
- Persist last choice in `localStorage("planLayout")` so a user who prefers cards isn't fought every visit.

## 2. Color-graded RPE + visible day spacing in `MesocycleTableView`

In `src/components/MesocycleTableView.tsx`:

- **RPE color ramp** — replace the plain `@x` text with a small pill whose background interpolates by RPE value:
  - ≤ 5 → emerald/40, 6 → lime, 7 → amber, 8 → orange, 9 → red/80, 10 → red.
  - Use `parseRpe()` (already exists) → map to a tailwind class table. Keeps semantic palette (success → warn → danger).
  - Pill renders in every week column so the eye can scan the intensity wave horizontally.
- **Day separators** — between day blocks (the `dayGroups.map`), insert a `tr` with a 12-px transparent spacer + a thin `border-t border-border/30`. Today they're glued together.
- **Day-header row** gets a subtle `bg-muted/20` band so each day reads as its own card inside the table.

## 3. Persona-aware RPE progression in seeded sessions

Today `seedDemoSessions` always bumps RPE by `+0.3 / week`. That's flat and ignores the persona. Update `fabricateEntry` in `src/server/demo-sessions.functions.ts`:

- Accept `archetype` and pass it through from `seedDemoSessions` / `advanceSimulation`.
- Lookup table (in `src/lib/demo-personas.ts`):

  ```ts
  // baseline RPE + weekly delta + ceiling, tuned per persona
  rpeProfile: {
    postpartum:  { base: 5.0, delta: 0.2, cap: 7.5 },
    deskbound:   { base: 5.5, delta: 0.25, cap: 8.0 },
    masters:     { base: 5.0, delta: 0.15, cap: 7.5 },
    youth_athlete:{ base: 6.5, delta: 0.4, cap: 9.5 },
    return_to_lift:{ base: 5.5, delta: 0.3, cap: 8.5 },
    stressed_exec:{ base: 5.0, delta: 0.2, cap: 7.5 },
    default:     { base: 6.0, delta: 0.3, cap: 9.0 },
  }
  ```

- RPE then **always increases week-to-week** (clamped at the cap, deload week subtracts 1.0).
- Weight ramp also keys off persona (`youth_athlete` +5kg/wk, `masters` +1kg/wk, etc.).
- Notes get a persona-flavored line ("Sessão calma, foco em técnica" for masters; "Empurrei mais hoje" for youth_athlete).

## 4. The missing piece — `Results` tab + auto-route to it for finished demos

The user's core complaint: after demo seeding they still land on an empty daily logbook. We add a **Results** view per plan that surfaces what the bots produced.

**New route**: `src/routes/plans.$planId.results.tsx`

Pulls `workout_sessions` for the plan and renders:

```text
┌─────────────────────────────────────────────────────────────┐
│  Results · 14 sessions logged · adherence 87% · avg RPE 6.8 │
├─────────────────────────────────────────────────────────────┤
│  [LineChart]  Weekly RPE trend (per session, colored dots)  │
│  [BarChart]   Weekly volume (total reps × load)             │
│  [LineChart]  Top-5 lifts: load progression                 │
├─────────────────────────────────────────────────────────────┤
│  Logbook table — one row per session, columns:              │
│    date · day_label · sets · reps · load · RPE pill · 💬    │
│    expandable to per-exercise actuals                       │
├─────────────────────────────────────────────────────────────┤
│  Client feedback feed (from workout_sessions.client_feedback│
│   + plan_feedback) — chips by category, oldest → newest     │
└─────────────────────────────────────────────────────────────┘
```

- All charts use the existing `recharts` setup (`src/components/ui/chart.tsx`).
- RPE dots reuse the same color ramp from §2 — visual continuity between plan and results.
- The logbook section IS the table-format filled logbook the user asked for: when sessions exist, render compact table; when empty, render the inline daily-log card view (image 1) for live entry.
- "Top-5 lifts" picks exercises by frequency in `entries`, plots first-set load over time.

**Routing into it**:

- Add `Resultados` tab to the plan header next to Brief / Blueprint / Microcycle / Progressions.
- In `src/routes/plans.$planId.tsx`, when the plan loads: if `sessions.length >= 3`, **auto-redirect** to `/plans/$planId/results` on first arrival (use `sessionStorage` flag so back-nav still works).
- Demo plans created via `createDemoClientFull` always have ≥ 8 seeded sessions, so they'll land directly on Results — exactly the "finished demo" experience the user described.

## Out of scope (intentionally deferred)

- Equipment-tier branching (least → most equipment, regressions). Big enough to deserve its own pass once Results is live and we can see what the bots actually struggle with.
- Concierge AI deep-routing. Already shipped basic version.

## Files touched

- `src/routes/plans.$planId.tsx` — default-table, auto-redirect when seeded.
- `src/components/MesocycleTableView.tsx` — RPE pill + day spacing.
- `src/server/demo-sessions.functions.ts` — persona-keyed RPE ramp.
- `src/lib/demo-personas.ts` — `rpeProfile` table + helper.
- `src/routes/plans.$planId.results.tsx` — **new**, the filled results view.
- `src/components/AppShell` plan tabs — add Resultados link.
- `src/lib/rpe-tone.ts` — **new**, single source of truth for the RPE color ramp (reused by table + results charts).

Reply **continua** to ship.