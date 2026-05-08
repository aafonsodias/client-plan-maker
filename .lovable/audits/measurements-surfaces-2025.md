# Measurement surfaces audit — 2025

**Status:** report only. No code changes.
**Trigger:** Round 2.5. Three parallel measurement systems coexist; AI complains about missing anthropometry while the Capacity Map sits empty. Need consolidation map before refactor.

---

## 1. Inventory of measurement surfaces

### A. Capacity Map + AddSnapshotSheet  *(Round 1, current canonical)*
- **UI name:** "Capacity Map" / "Adicionar medição"
- **Files:** `src/components/CapacityMap.tsx`, `src/components/AddSnapshotSheet.tsx`, `src/server/capacity.functions.ts`
- **Routes:** `/clients/$clientId` (mounted at `clients_.$clientId.tsx:1621`)
- **Captures:** per-domain snapshot — `domain_slug`, `test_used`, `raw_value` + `raw_unit`, `normalized_score (0–100)`, `measured_at`, `notes`. 11 domains (cardiorespiratory, muscular_strength, muscular_endurance, flexibility, body_composition, power, agility, balance, coordination, speed, reaction_time).
- **Stores in:** `client_capacity_snapshots.*`
- **Reads from:** `capacity_domains` (templates) + `client_capacity_snapshots` (latest per domain).
- **Triggered by:** trainer (PT-side only). Cross-component contract: `window` event `open-add-snapshot` from BriefEditor recommended-assessment chips.
- **Frequency:** on-demand, additive (history preserved per domain).
- **AI reads it:** ✅ Stage 1 Brief (`stage1-brief.functions.ts:74,86`). Schema: `BriefSchema.capacity_profile` (`schemas.ts:134`).

### B. Reavaliação periódica (ReassessmentSheet)
- **UI name:** "Reavaliação periódica"
- **Files:** `src/components/ReassessmentSheet.tsx`, server: `src/server/measurements.functions.ts`
- **Routes:** `/clients/$clientId` (mounted at line 2958), opened from RealInsightsCard CTA.
- **Captures:** flat `values` jsonb with keys: `vo2max` (ml/kg/min), `rhr` (bpm), `dead_hang_s`, `active_hang_s`, `plank_s`, `box_squats_reps`, `bp_systolic`, `bp_diastolic`, `waist_cm`, `hip_cm`, `chest_cm`, `arm_cm`, `thigh_cm`, `calf_cm`. Plus `notes`.
- **Stores in:** `client_measurements.values` jsonb, `cadence='periodic'`.
- **Reads from:** N/A (write-only on save).
- **Triggered by:** trainer.
- **Frequency:** every 14 days (default `client_measurement_prefs.periodic_interval_days`).
- **AI reads it:** ❌ No `phased/*` stage queries `client_measurements`.

### C. RealInsightsCard ("Insights de capacidade")
- **UI name:** "Insights de capacidade"
- **Files:** `src/components/RealInsightsCard.tsx`
- **Routes:** `/clients/$clientId` (mounted at line 1661, immediately below CapacityMap).
- **Captures:** nothing — read-only surface. CTA opens ReassessmentSheet.
- **Reads from:** `client_measurements` rows where `cadence='periodic'` (last 60). Renders Δ chips for `vo2max`, `dead_hang_s`, `active_hang_s`, `plank_s`.
- **Triggered by:** trainer view.
- **AI reads it:** ❌

### D. Assessment — Section "Anthropometry"
- **UI name:** "Anthropometry" (part of full intake sections list)
- **Files:** `src/routes/clients_.$clientId.tsx` (section list line 185, fields 333–336 / 455–459, completion check `assessmentCompleteness.anthro` line 220), public intake form: `src/routes/intake.$token.tsx`.
- **Routes:** `/clients/$clientId` (PT trainer view) and `/intake/$token` (public client view).
- **Captures:** `waist_cm`, `hip_cm`, `body_fat_pct`, `body_fat_method` (skinfold | bioimpedance | dexa | navy_tape).
- **Stores in:** `assessments.waist_cm`, `assessments.hip_cm`, `assessments.body_fat_pct`, `assessments.body_fat_method`.
- **Reads from:** same.
- **Triggered by:** client (during intake) OR trainer (manual edit).
- **Frequency:** one-time per assessment row.
- **AI reads it:** ✅ Brief Stage 1 — via `pickSectionPayload("anthro", …)` in `src/server/phased/section-map.ts:67`. Also the ACSM screening logic (`src/server/screening/preparticipation.server.ts:192`) reads `waist`. Stage 2 Blueprint, Stage 3 Microcycle and pre-stage all `select * from assessments`.

### E. Assessment — fitness-test fields (cardio/strength/movement)
- **UI name:** sections "Cardiovascular", "Movement screen", "Resting BP", "Strength capacities"
- **Files:** `src/routes/clients_.$clientId.tsx` (line 141 onward — `cardio`, `movement`, `bp`, `lifts`), `src/routes/intake.$token.tsx`.
- **Captures:** `resting_heart_rate`, `submax_test` jsonb (rockport/1.5mi → vo2_estimated, hr_peak), `systolic_bp_mmhg`, `diastolic_bp_mmhg`, `bp_measured_at`, `squat_depth_score`, `overhead_reach_score`, `hip_hinge_score`, `single_leg_balance_score`, `*_capacity` and `*_form_criteria` jsonb (squat / hinge / push / pull / carry / lunge), `cardio_capacity`, `max_lifts`.
- **Stores in:** `assessments.*` (many columns).
- **Triggered by:** trainer or client (intake).
- **Frequency:** one-time per assessment.
- **AI reads it:** ✅ All `phased/*` stages.

### F. Body weight / age / sex on `clients`
- **UI:** Client edit form on `/clients/$clientId`
- **Captures:** `clients.weight_kg`, `clients.height_cm`, `clients.age`, `clients.sex`, `clients.date_of_birth`.
- **Stores in:** `clients.*`
- **AI reads it:** ✅ Brief / pre-stage.

### G. Daily activity log (steps)
- **UI:** none currently surfaced (table exists, no write surface in `src/`).
- **Stores in:** `daily_activity_log.steps` per date.
- **AI reads it:** ❌

### H. Demo seeders (synthetic — not user surfaces)
- `src/server/demo-client.functions.ts` writes `assessments.waist_cm/hip_cm/body_fat_*`.
- `src/server/demo-sessions.functions.ts:475-497` writes synthetic `client_measurements` rows.
- Relevant only because deletion of `client_measurements` would break demo seeders.

---

## 2. Database tables involved

| Table | Columns relevant to measurements | Rows in dev DB | Actively written by |
|---|---|---:|---|
| `client_capacity_snapshots` | `domain_slug, test_used, raw_value, raw_unit, normalized_score, measured_at, provenance, notes, evidence_url` | **0** | AddSnapshotSheet (A) |
| `capacity_domains` | template rows | 11 | seed only |
| `client_measurements` | `cadence, measured_on, values jsonb, notes` | **0** | ReassessmentSheet (B), demo seeder |
| `client_measurement_prefs` | `daily_fields, periodic_fields, periodic_interval_days, reassessment_interval_days` | **0** | `updateMeasurementPrefs` (no UI consumer found beyond defaults) |
| `assessments` | `waist_cm, hip_cm, body_fat_pct, body_fat_method, resting_heart_rate, submax_test, systolic_bp_mmhg, diastolic_bp_mmhg, *_capacity, *_form_criteria, max_lifts, cardio_capacity, …` | **2** | Assessment form (D, E), intake form |
| `clients` | `weight_kg, height_cm, age, sex, date_of_birth` | n/a | client edit form (F) |
| `daily_activity_log` | `steps, notes` | **0** | nothing in `src/` |

No standalone `reassessments`, `client_metrics`, or `body_measurements` tables exist.

---

## 3. Overlap matrix

Legend: ✅ canonical write · 👁 displayed read-only · ⚠️ duplicate write path · ❌ absent

| Concept | Capacity Map (A) | Reassessment (B) | RealInsights (C) | Assessment Anthro (D) | Assessment Fitness (E) | Clients (F) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| VO₂max | ⚠️ `cardiorespiratory` snapshot | ⚠️ `values.vo2max` | 👁 | ❌ | ⚠️ `submax_test.vo2_estimated` | ❌ |
| Resting HR | ❌ | ⚠️ `values.rhr` | ❌ | ❌ | ⚠️ `resting_heart_rate` | ❌ |
| BP sys/dia | ❌ (could be `cardiorespiratory`) | ⚠️ `values.bp_*` | ❌ | ❌ | ⚠️ `systolic_bp_mmhg`/`diastolic_bp_mmhg` | ❌ |
| Dead/active hang | ⚠️ `muscular_endurance`/`muscular_strength` | ⚠️ `values.dead_hang_s`/`active_hang_s` | 👁 | ❌ | ❌ | ❌ |
| Plank | ⚠️ `muscular_endurance` | ⚠️ `values.plank_s` | 👁 | ❌ | ❌ | ❌ |
| Box squat reps | ⚠️ `muscular_endurance` | ⚠️ `values.box_squats_reps` | ❌ | ❌ | ⚠️ `squat_capacity` jsonb | ❌ |
| Waist cm | ❌ (would fit `body_composition`) | ⚠️ `values.waist_cm` | ❌ | ⚠️ `assessments.waist_cm` | ❌ | ❌ |
| Hip cm | ❌ | ⚠️ `values.hip_cm` | ❌ | ⚠️ `assessments.hip_cm` | ❌ | ❌ |
| Chest/arm/thigh/calf cm | ❌ | ✅ only here | ❌ | ❌ | ❌ | ❌ |
| Body-fat % + method | ❌ (would fit `body_composition`) | ❌ | ❌ | ✅ only here | ❌ | ❌ |
| Movement screen scores (squat/hinge/OH/SLB) | ⚠️ `flexibility`/`balance` (conceptually) | ❌ | ❌ | ❌ | ✅ `*_score` cols | ❌ |
| Body weight | ❌ | ❌ (would make sense) | ❌ | ❌ | ❌ | ✅ `clients.weight_kg` |
| Steps / NEAT | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (only `daily_activity_log`, no UI) |

**Key finding:** every metric the ReassessmentSheet captures is duplicated either in the Capacity Map (conceptually, via the matching domain) or in the Assessment row (literally, same column). VO₂max is triple-stored. Waist/hip is double-stored. Chest/arm/thigh/calf girths are the only metrics with no other home.

---

## 4. Code references (blast radius)

### Capacity surface (A)
- `src/components/CapacityMap.tsx` (singleton on client detail)
- `src/components/AddSnapshotSheet.tsx`
- `src/server/capacity.functions.ts` — `getClientCapacityMap`, `addCapacitySnapshot`
- `src/components/BriefEditor.tsx:635-636` (dispatches `open-add-snapshot`)
- `src/server/phased/stage1-brief.functions.ts:74,86` (reads snapshots into Brief)
- `src/server/phased/schemas.ts:134` (`BriefSchema.capacity_profile`)
- `src/routes/clients_.$clientId.tsx:7,1621` (mount)
- `src/lib/capacity-thresholds.ts`, `src/lib/capacity-gain.ts`, `src/components/CapacityGainCard.tsx` (downstream consumers)

### Reassessment surface (B)
- `src/components/ReassessmentSheet.tsx`
- `src/server/measurements.functions.ts` (`recordMeasurement`, `listMeasurements`, `getMeasurementPrefs`, `updateMeasurementPrefs`)
- `src/routes/clients_.$clientId.tsx:79,2958` (import + mount)
- `src/server/demo-sessions.functions.ts:292,475-497` (demo seeder writes synthetic rows)

### RealInsightsCard (C)
- `src/components/RealInsightsCard.tsx`
- `src/routes/clients_.$clientId.tsx:80,1661`
- i18n keys `insights.*` in `src/i18n/locales/*/plan.json`

### Assessment Anthro (D) — feeds AI
- `src/routes/clients_.$clientId.tsx:141,185,220,333-336,455-459`
- `src/routes/intake.$token.tsx` (public form)
- `src/server/phased/section-map.ts:67-73` (anthro slice for pre-stage)
- `src/server/phased/pre-stage.functions.ts` (analyses anthro section)
- `src/server/screening/preparticipation.server.ts:192` (reads waist for risk)
- `src/server/demo-client.functions.ts:67-580,770-774`

### Assessment Fitness (E)
- `src/routes/clients_.$clientId.tsx` (multiple sections)
- `src/routes/intake.$token.tsx`
- `src/server/phased/section-map.ts` (cardio/movement/bp/lifts slices)
- `src/server/phased/pre-stage.functions.ts`, `stage1-brief.functions.ts`, `stage2-blueprint.functions.ts`, `stage3-microcycle.functions.ts`

---

## 5. AI prompt references

| Stage | File | Reads | Writes-back |
|---|---|---|---|
| pre-stage section analyses | `src/server/phased/pre-stage.functions.ts` | `assessments.*` (sliced via section-map) | `assessments.section_analyses[*]` |
| Stage 1 Brief | `src/server/phased/stage1-brief.functions.ts` | `assessments.*` + **`client_capacity_snapshots`** + `capacity_domains` | `BriefSchema.capacity_profile` (R2) |
| Stage 2 Blueprint | `src/server/phased/stage2-blueprint.functions.ts:108,116` | `assessments.*`, brief.capacity_profile transitively | blueprint |
| Stage 3 Microcycle | `src/server/phased/stage3-microcycle.functions.ts:664,672` | `assessments.*` | microcycle |
| Stage 4 Progressions | `src/server/phased/stage4-progressions.functions.ts` | deterministic (no assessments) | progressions |
| Stage 5 Bulkfill | `src/server/phased/stage5-bulkfill.functions.ts` | brief + plan | day content |
| Screening (non-AI) | `src/server/screening/preparticipation.server.ts:192` | `assessments.waist_cm`, BP, signs/symptoms | risk category |

**Nothing reads `client_measurements`** in AI-facing code. The Reassessment surface is an island.

---

## 6. Recommendation

**Keep:** `client_capacity_snapshots` (+ `capacity_domains`) as the single source of truth for *anything that changes over time and informs prescription*. It's the only surface already read by the AI Brief, it has provenance, raw+normalized, history per domain, and a stable contract with Stage 1.

**Migrate:** Fold ReassessmentSheet's metrics into the Capacity Map model.
- `vo2max` → snapshot in `cardiorespiratory` (raw_value=vo2, raw_unit=`ml/kg/min`, test_used=`submax_estimate`).
- `rhr`, `bp_*` → `cardiorespiratory` snapshots OR a new `autonomic` domain (out of scope here — flag as decision).
- `dead_hang_s`, `active_hang_s`, `plank_s`, `box_squats_reps` → snapshots in `muscular_endurance` (and/or `muscular_strength`) with `test_used` distinguishing them.
- `waist_cm`, `hip_cm`, `chest/arm/thigh/calf_cm`, body-fat % → snapshots in `body_composition`. Backfill the latest assessment row's anthro values into a `body_composition` snapshot at migration time.
- The Assessment `*_score`/`*_capacity` movement-screen jsonb stays where it is for now — it's structural intake, not periodic re-measurement.

**Delete (after migration):**
- `src/components/ReassessmentSheet.tsx`
- `src/components/RealInsightsCard.tsx` (or rewrite as a CapacityMap-backed deltas chip strip — same UI promise, single backend).
- The `recordMeasurement` / `listMeasurements` / `getMeasurementPrefs` / `updateMeasurementPrefs` server fns in `src/server/measurements.functions.ts`. The unrelated exports `updateTrainerSummary`, `markPlanFinishedLogging`, `createManualPlan` must move to another file before deletion.
- Tables `client_measurements` and `client_measurement_prefs` (drop migration after data move).
- Mounts at `clients_.$clientId.tsx:80,1661,2958`.
- Demo seeder block at `src/server/demo-sessions.functions.ts:292,475-497` (retarget to write `client_capacity_snapshots`).
- The `assessments.waist_cm/hip_cm/body_fat_pct/body_fat_method` columns *eventually*, once Stage 1 reads body_composition from snapshots and the screening helper switches over. **Not in the same round** — see Risks.

---

## 7. Risks / unknowns

- **Three unrelated server fns share the measurements file.** `updateTrainerSummary`, `markPlanFinishedLogging`, `createManualPlan` live in `src/server/measurements.functions.ts` despite having nothing to do with measurements. Must be moved (suggested: `clients.functions.ts` and `plans.functions.ts`) **before** deleting the file.
- **AI prompt references "Anthropometry" expectation.** `src/server/phased/section-map.ts:67-73` and the pre-stage section analyser explicitly slice anthro. If we drop `assessments.waist_cm` etc., we must (a) update the section-map to read the latest `body_composition` snapshot, OR (b) keep the columns for one transition period. The user-reported "AI complains about missing anthropometric data" is most likely the pre-stage anthro analyser flagging null fields — confirm before removing columns.
- **ACSM risk screening reads `waist_cm` directly** (`preparticipation.server.ts:192`). Hard dependency — must be redirected to snapshot read, or kept on assessments column.
- **`client_measurement_prefs` has zero rows and no production read path.** The `daily_*` cadence is also unused in any UI. Safe to drop entirely.
- **`daily_activity_log` is orphan.** No `src/` writer/reader. Either ship the surface or drop the table — out of scope here. Flag for backlog.
- **Demo seeders write to both the soon-to-be-deprecated `client_measurements` and to `assessments.waist_cm/hip_cm/body_fat_*`.** Migration round must update `src/server/demo-client.functions.ts:770-774` and `src/server/demo-sessions.functions.ts:475-497` in lockstep, or demos will silently lose anthro/cardio history.
- **`box_squats_reps` has no clean Capacity Map home.** It's a strength-endurance test for legs; could fit `muscular_endurance` with `test_used='box_squat_reps_bodyweight'`, but worth confirming against the assessment battery taxonomy before the migration round.
- **Dev DB has zero rows in both `client_capacity_snapshots` and `client_measurements`.** Migration is essentially data-free in dev — but production may differ. Snapshot prod table counts before the next round.
- **RealInsightsCard's i18n keys** (`insights.*` in `plan.json`) will be orphaned on deletion. Either rebind to a new CapacityMap-backed insights component or drop them — keep the keys list with the deletion PR.
- **No standalone `reassessments` / `client_metrics` / `body_measurements` tables exist** — audit confirms only the four tables enumerated. No hidden surface.
