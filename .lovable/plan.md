# Measurement consolidation — remaining phases

Round 3 + 3.1 closed the backend half of the audit recommendation: the 12th `autonomic_regulation` domain seeded, idempotent backfill in place, AI reads (pre-stage anthro, ACSM screening, Stage 2/3) redirected through `client_capacity_snapshots` with assessment fallback, demo seeders writing snapshots, dead helpers moved out of `measurements.functions.ts`.

Two phases remain. Each is a self-contained round prompt, copy-pasteable into a new turn.

---

## Round 3.2 — UI swap + legacy hide (non-destructive)

### Goal
Surface the consolidated capacity data in the trainer client view, retire `RealInsightsCard` in favour of a snapshot-backed deltas component, and hide `ReassessmentSheet` behind a feature flag so it stops being the obvious "add measurement" path. **No tables dropped, no files deleted.**

### Scope

1. **New component `CapacityDeltasCard`** (`src/components/CapacityDeltasCard.tsx`)
   - Reads `client_capacity_snapshots` for the client, last 90 days, grouped by `domain_slug`.
   - Renders Δ chips per domain that has ≥2 snapshots: latest vs previous, raw delta + % change, tone via `src/lib/status-tone.ts` (improvement = success, regression > 5% = warn, else neutral).
   - Empty state: short copy + button "Adicionar medição" that dispatches the existing `open-add-snapshot` window event (same contract `BriefEditor` uses).
   - i18n keys under `capacityDeltas.*` in `common.json` (en, pt-PT). ES/HI fall back to EN per locale policy.

2. **Replace `RealInsightsCard` mount** in `src/routes/clients_.$clientId.tsx` (line ~1661): swap import + JSX for `<CapacityDeltasCard clientId={...} />`. Do **not** delete `RealInsightsCard.tsx` yet (Phase B).

3. **Feature-flag `ReassessmentSheet`**
   - Read `import.meta.env.VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET === "true"` (default false).
   - When false: skip the import + the mount at line ~2958 + any CTA that opens it. The `open-reassessment` window dispatcher (if any) becomes a no-op — do not remove the listener, just gate the render.
   - When true: render exactly as today (escape hatch for the trainer who needs chest/arm/thigh/calf girths until snapshot tests cover them).
   - Add the flag (commented, default off) to `.env.example` if that file exists; otherwise document in the PR description.

4. **Capacity Map: add the missing tests surfaced by Phase A**
   - `AddSnapshotSheet` already iterates `capacity_domains.tests`. Confirm the 6 new `autonomic_regulation` tests appear and that their i18n labels resolve (verifier already passes). No code change expected — verify in browser at `/clients/$id`.
   - Add `body_composition` shortcuts for `waist_cm`, `hip_cm`, `body_fat_pct` if they are not already in the seed (check `capacity_domains` row for `body_composition.tests`; if missing, add a small migration that appends them with `unit` + `direction='lower_better'` for waist/bf, neutral for hip).

5. **Verification**
   - Run `bunx tsx scripts/verify-consolidation-phase-a.ts` — must still pass.
   - 375×667 mobile smoke on `/clients/$id`: CapacityDeltasCard renders, empty state works, Add measurement opens the sheet.
   - With flag off: no "Reavaliação periódica" surface anywhere on the client page. With flag on: legacy sheet still works.
   - Demo seeder regression: `loadDemo` for a fresh client should produce visible deltas in CapacityDeltasCard within the same Block 1 (because seeders now write snapshots).

### Out of scope
- Deleting `RealInsightsCard.tsx`, `ReassessmentSheet.tsx`, `measurements.functions.ts`.
- Dropping `client_measurements` / `client_measurement_prefs` tables.
- Dropping `assessments.waist_cm/hip_cm/body_fat_*` columns.
- Touching the public intake form's anthropometry section (still writes to `assessments` — fallback path is intentional this round).

### Risks
- `RealInsightsCard` i18n keys (`insights.*` in `plan.json`) become orphaned. Leave them — Phase B removes both component and keys together.
- If `body_composition` tests are missing from the seed, the Add Measurement button from the empty state will land on a domain with no test options. Hence the small additive migration in step 4.

### Notes
- One concern per round. Bugs in adjacent code → `.lovable/backlog.md`.
- Mobile-first; verify the deltas card fits the existing client page rhythm without inner scroll on 375px.

---

## Round 3.3 — Phase B: destructive cleanup (after 1–2 weeks burn-in)

### Pre-flight (must all be true before starting)
- [ ] `verify-consolidation-phase-a.ts` passes on prod backup snapshot.
- [ ] `select count(*) from client_measurements` on prod = 0 OR every row has a matching backfilled snapshot (run `backfill_measurement_snapshots_phase_a()` once more, log the diff).
- [ ] No production trainer has flipped `VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET=true` in the last 14 days (check build env / ask user).
- [ ] DB backup taken in the same session as the migration.

### Goal
Remove the deprecated surface entirely: code, server fns, tables, columns, i18n keys, demo writes that still target legacy.

### Scope

1. **Delete components**
   - `src/components/ReassessmentSheet.tsx`
   - `src/components/RealInsightsCard.tsx`
   - All remaining imports / mounts / dispatchers in `src/routes/clients_.$clientId.tsx`. Remove the feature-flag block from Round 3.2 (no longer needed).

2. **Delete server fns**
   - In `src/server/measurements.functions.ts`: drop `recordMeasurement`, `listMeasurements`, `getMeasurementPrefs`, `updateMeasurementPrefs`. Confirm the file is then empty (helpers were moved in 3.1) and delete the file.
   - Grep for any remaining import; delete callers that became dead.

3. **Drop database objects** (single migration, idempotent guards)
   - `drop table if exists public.client_measurements cascade;`
   - `drop table if exists public.client_measurement_prefs cascade;`
   - `alter table public.assessments drop column if exists waist_cm, drop column if exists hip_cm, drop column if exists body_fat_pct, drop column if exists body_fat_method;` — only after verifying `pickSectionPayload("anthro", …)` and `preparticipation.server.ts` no longer touch them (they shouldn't after 3.1, double-check).
   - Drop `backfill_measurement_snapshots_phase_a()` — its job is done.
   - Keep `daily_activity_log` alone; orphan-table decision is a separate backlog item.

4. **Update demo seeders**
   - `src/server/demo-client.functions.ts`: stop writing the deprecated `assessments` anthro columns (write only to snapshots — already true after 3.1, but the columns won't exist after this migration so the writes will hard-fail if missed).
   - `src/server/demo-sessions.functions.ts`: confirm the `client_measurements` block from 3.1 is gone.

5. **i18n cleanup**
   - Drop the `insights.*` and `reassessment.*` key blocks from `src/i18n/locales/{en,pt,es,hi}/plan.json`.
   - Drop `capacityDeltas.*` keys that turned out unused (sweep with a grep before delete).
   - Re-run `bunx tsx scripts/verify-capacity-i18n.ts` — must pass.

6. **Verifier extension**
   - Add 4 checks to `scripts/verify-consolidation-phase-a.ts` (or a sibling `phase-b.ts`):
     - `client_measurements` table absent.
     - `client_measurement_prefs` table absent.
     - `assessments.waist_cm` column absent.
     - No `src/` file imports `ReassessmentSheet` or `RealInsightsCard`.

### Out of scope
- The `daily_activity_log` orphan table (separate decision: ship a UI or drop it).
- Movement-screen jsonb on `assessments` — structural intake, not periodic measurement, stays.
- Any AI prompt copy changes beyond what 3.1 already shipped.

### Risks
- If a production assessment row has anthro values that never made it into a snapshot (e.g. legacy data inserted between 3.1 backfill and Phase B), dropping the columns destroys it. Mitigation: re-run `backfill_measurement_snapshots_phase_a()` inside the same migration, before the `drop column`, and assert `select count(*) from assessments where waist_cm is not null and not exists (select 1 from client_capacity_snapshots s where s.client_id = assessments.client_id and s.domain_slug = 'body_composition' and s.test_used = 'waist_circumference')` returns 0.
- Public intake form (`src/routes/intake.$token.tsx`) currently writes to `assessments.waist_cm` etc. **Must be updated to write a `body_composition` snapshot instead, or those four anthro fields removed from the intake form, in the same PR as the column drop.** Otherwise client intake submissions hard-fail.

---

## Sequencing summary

```text
Round 3.0 ✅  domain seed + backfill function + i18n
Round 3.1 ✅  AI reads + helpers refactor + demo seeders
Round 3.2 ⏭   UI swap (CapacityDeltasCard) + flag ReassessmentSheet
              → burn-in window (≥1 week, ideally 2)
Round 3.3 ⏭   Phase B destructive: delete components, server fns,
              tables, columns, i18n keys; intake form swap
```

After 3.3, the system has one measurement surface (`client_capacity_snapshots`), one writer (`AddSnapshotSheet` + intake), one AI reader path (already redirected), and zero dead code.
