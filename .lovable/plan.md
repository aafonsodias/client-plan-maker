
# Diagnostic — Aspiringbaconeer plan `9e588c89…`

## Snapshot of the plan row

```
generation_meta = {"intensity_appetite": "padrao"}     ← no `cockpit`, no `tier`
programming_variables.wave_model = "undulating"        ← cockpit_preset = "custom"
programming_variables.tier        = (null)
brief.tier                        = (null)
brief.intensity_appetite          = "padrao"
brief.red_flags = 4 items (anticoagulant, beta-blocker, statin, ACSM moderate)
status = ready, generation_status = complete, progression_plan has 40 rows
```

The 4-week mesocycle was generated end-to-end (Stage 1→5), so all the failures are inside the deterministic pipeline, not the AI.

---

## PROBLEM A — RPE never moves across W1–W4

### Root cause: `proposeProgressions` collapses every exercise to ≤ 2 rows, killing RPE deltas and the deload

`src/server/phased/stage4-progressions.functions.ts` lines 138–157:

```ts
const dimPriority = ["load", "reps", "intensity_rpe", "sets"] as const;
const used = new Set<string>();
for (const dim of dimPriority) {
  ...
  if (used.size >= 2) break;     // ← hard cap of 2 dimensions per exercise
}
```

For a compound exercise the per-week deltas from `deltaForExercise` are:
- W2 (+volume): `reps +1`, `intensity_rpe +0.5`
- W3 (+intensity): `load +2.5kg`, `intensity_rpe +0.5`
- W4 (deload): `intensity_rpe −1.5`, `sets −1`

Iteration: `load` (W3 only) → row, `reps` (W2 only) → row, used == 2 → BREAK. The `intensity_rpe` and `sets` rows are never written.

DB confirms: progression_plan for `d1_goblet_squat` has exactly 2 rows (load, reps); zero `intensity_rpe`, zero `sets` rows. Across the whole plan, only 9/40 rows are `intensity_rpe` and 9/40 carry a non-empty W4 delta. The deload disappears.

### Confirmation in `workout_plan_days`

```
W1 rpe=7 reps=10-12 notes=… 
W2 rpe=7 reps=10-13 notes=…                      ← +1rep applied (reps row)
W3 rpe=7 reps=10-12 notes=… (+2.5kg)             ← load row appended to notes
W4 rpe=7 reps=10-12 notes=…                      ← W4 has nothing to apply
```

`MesocycleTableView.weekTotals` (lines 118–145) reads `ex.rpe` from `plan.weeks[wn]`. Since rpe is identical across all weeks the column header correctly renders "RPE 7" for every column — the header isn't lying, the underlying data is uniform.

A second smaller bug compounds it: even when an `intensity_rpe` row IS produced, `applyDelta` in `stage5-bulkfill.functions.ts` line 36 only mutates current rpe if it already contains the literal `"rpe"` substring. Stage-3 stores rpe as `"7"` (no unit), so the regex misses and the function falls through to the `(+0.5rpe)` append branch — giving us strings like `"7 (+0.5rpe)"` instead of `"7.5"`. That string then breaks `parseRpe` in the table.

### Minimal fix (Problem A)

1. `stage4-progressions.functions.ts` lines 139–156 — emit one row per dimension that has at least one non-empty delta across W2/W3/W4. Drop the `used.size >= 2` break; cap at 4 (one per dimension max). Keeps payload bounded but never silently drops the deload.
2. `stage5-bulkfill.functions.ts` line 36 — when the unit is `rpe` and the current value is a bare number, increment numerically instead of falling through to the append branch. Same for `kg`/`lb` if `notes` is the load carrier (already works for notes via the `(+x)` append, but Mesocycle ▲/▼ heuristic may mis-read it).

No DB migration. Re-run progressions+bulkfill on existing plans to backfill (banner already wired in `MesocycleTableView` lines 251–267).

---

## PROBLEM B — Week 1 set cap not applied

### Root cause: tier was resolved differently on every per-day call AND the run that produced the persisted day didn't trigger the cap log

`generation_log` for this plan:

```
stage3:day1:rpe_floor  tier=conservative  appetite=conservador  floors{main:6.5,acc:5,carry:5}
stage3:day2:rpe_floor  tier=conservative  appetite=padrao       floors{main:7,  acc:6,carry:5.5}
stage3:day3:rpe_floor  tier=advanced      appetite=padrao       floors{main:8,  acc:7,carry:6.5}
stage3:day5:rpe_floor  tier=advanced      appetite=padrao       floors{main:8,  acc:7,carry:6.5}
```

Three different tiers (and three different appetites) inside one plan generation. There is **zero** `stage3:dayX:set_cap` log line, so `enforceWeek1SetCap` either ran with `setsCapped == 0` or the eventually-persisted day came from a path that bypassed it.

Per `programming-tier.server.ts`:
- conservative cap: `{main:3, accessory:2, carry:1}`
- advanced cap: `{main:3, accessory:3, carry:2}`

DB shows every accessory at 3 sets, no `meta.week1_set_cap_applied` markers. For days 1–2 (conservative, accessory cap = 2) the persisted output is impossible if the cap had run. So the cap step was skipped on the run that won the upsert race, most likely because `resolveTierGuidelines` (line 722) returned `null` or a different tier on the second pass when it re-classified from scratch (no `meta.tier` and no `meta.tier_guidelines` were stamped from the first pass).

User's expectation of "remedial" is also off: with `red_flags.length = 4`, `classifyTier` (line 98) lands on **conservative** — remedial only triggers on `movementFailures >= 5 || prepart.clearance_required`. The reported tier should be conservative.

### Minimal fix (Problem B)

1. `stage3-microcycle.functions.ts` — once `resolveTierGuidelines` returns successfully on the first `runDay` call, persist the result to `workout_plans.generation_meta.tier` + `tier_guidelines` BEFORE spawning the per-day workers. This makes the resolver short-circuit on line 728 for every subsequent day and every regen, killing the per-day drift.
2. Inside `runDay` (lines 549–567) — log a `stage3:dayX:set_cap_inputs` row regardless of `setsCapped > 0`, so future debugging shows exactly what cap each day saw. Cheap.
3. Backfill: re-run microcycle for plans where `generation_meta.tier` is missing. Optional one-shot script.

No DB schema change.

---

## PROBLEM C — Card click goes to mobile logbook

### Finding: not actually a bug, mis-attribution

The plan card on `/clients/$id` has:
- Title (`<Link to="/plans/$planId">` line 124–132 of `ThisWeekHero.tsx`) → trainer editor. Correct.
- "Semana N · PDF" pill (line 139) → PDF download. Correct.
- `primaryAction` button — when `allApprovedLocal && heroPlan` (line 1939–1958 of `clients_.$clientId.tsx`) → `/log/$token`. Intentional.
- `secondaryAction` "Abrir editor" → `/plans/$planId`. Added last round.

`rg "/log/$token"` across `src/` returns exactly one navigate call (line 1953). No card-wide `onClick`, no nested `<Link to="/log">`. The card body is not clickable; only the explicit primary button is.

What the user is probably seeing: the big amber "Abrir logbook do cliente" CTA is the visually dominant element on the card, easy to read as "the card click". The click target is correct for its label.

### Minimal fix (Problem C)

Either:
- **A. None** — re-label only. Confirm the secondary "Abrir editor" is rendered (line 1959–1963 already does so) and consider promoting it visually (e.g., side-by-side same-size on desktop) so the trainer never feels the only action is the client one.
- **B. Swap intent** — make `/plans/$planId` the **primary** CTA on `/clients/$id` (trainer surface) and `/log/$token` the **secondary**, since this is the trainer's workspace. Keep the current order for the dashboard ClientCockpit if the audience is mixed.

Recommend **B** — it's one swap of `primaryAction`/`secondaryAction` in lines 1940–1963 and aligns with `mem://principles/no-stage-redirects`: trainer page → trainer surface first.

---

## Files that change (when implementation lands)

```
src/server/phased/stage4-progressions.functions.ts   (lines 139-156)
src/server/phased/stage5-bulkfill.functions.ts       (lines 36-49)
src/server/phased/stage3-microcycle.functions.ts     (resolveTierGuidelines persist, lines ~722-760, 549-567)
src/routes/clients_.$clientId.tsx                    (lines 1940-1963 — Problem C swap)
```

No DB migrations. No i18n changes. No breaking schema changes — all 3 fixes are additive on top of existing rows.

## Out of scope

- Re-classifying Aspiringbaconeer to remedial (would require re-evaluating classifyTier thresholds, separate round).
- Cockpit UI changes — the wave_model/preset values were correct; the bug is downstream.
- Renaming `/log/$token` or merging trainer + client logbooks.
