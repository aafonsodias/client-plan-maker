# R74 — Exercise & Session Identity Audit

## 1. Where exercise names enter

- AI Stage 3 microcycle output → `ExerciseZ` schema in `src/server/phased/schemas.ts` (`exercise_name: string`, `primary_muscles: string[]`, `secondary_muscles: string[]`, `equipment: string[]`). Free text, no canonical ID.
- AI Stage 4/5 progressions + bulkfill reuse the same shape (`stage4-progressions.functions.ts`, `stage5-bulkfill.functions.ts`).
- Manual plan editor (`DayCardEditable.tsx`, `AddExerciseDialog.tsx`) writes free-text names too.
- Logbook entries (`workout_sessions.entries[].exercise_name`) inherit whatever string the plan/AI wrote.

## 2. Where exercise names are displayed

- PDF: `src/lib/pdf.ts` (and `pdf-types.ts`) renders `exercise_name` verbatim per row.
- Plan editor cards (`DayCardEditable`, `MicrocyclePanel`, `SessionDayView`).
- Logbook UI (`log.$token.tsx`, `ExerciseSetsCard.tsx`).
- Capacity-gain top-lifts list (`CapacityGainCard`).

## 3. Where names are used as identity keys (today, name-string based)

- `src/lib/volume-actual.ts:54` — `indexPlanExercises` keys plan exercises by `name.trim().toLowerCase()`; `computeWeeklyActualVolume` looks up by the same lowercased name. Drift between "Goblet Squat" in plan and "goblet squat" in log entries is masked only by the toLowerCase, not by aliasing.
- `src/lib/capacity-gain.ts:103,110` — top-lifts grouping keyed by `name` (case-sensitive trimmed). "Goblet Squat" and "agachamento goblet" used to split into two lifts.
- `src/lib/longitudinal.ts:134` — exercise grouping by trimmed name.
- `src/lib/rotation-audit.ts` — does NOT join by name itself; consumes pre-computed metrics from Stage 3. No raw join present.
- `generation_meta.prior_exercise_pool` — Stage 3 prompt input is a list of free-text names; Stage 3 dedup happens upstream in the AI prompt.

## 4. Muscle string normalization

- `src/lib/volume-landmarks.ts` — canonical `MuscleGroup` keys + `MUSCLE_ALIASES` + `normaliseMuscle()` (NFD strip + first-token fallback). Already solid; new exercise taxonomy reuses these keys verbatim.

## 5. Silent drops

- `volume-actual.ts`: if a logged `exercise_name` doesn't match the plan index (case/spelling drift), the entry contributes set count but with **no muscles** → it's silently dropped from per-muscle volume. Adding `exerciseIdentityKey()` reduces this.
- `volume-compute.ts`: muscles unrecognised by `normaliseMuscle` are dropped silently.
- `capacity-gain.ts`: pre-fix, two spellings of the same lift were tracked as two lifts and could each fail the "data on both sides" filter.

## 6. Session structure today

- `ExerciseZ` is a flat list per `WorkoutPlanDayZ`. There is **no** structural representation of warm-up / mobility / activation / cooldown / breathing / education blocks.
- `WorkoutPlanDayZ.notes` and `focus` are free text — sometimes carry warm-up cues, but unparseable.
- PDF and editor render exercises in source order with no block grouping.
- → Session-block taxonomy ships as **vocabulary only**; generation output is unchanged.

## 7. Safe wiring done in R74

- `src/lib/volume-actual.ts` — plan index + lookup now keyed by `exerciseIdentityKey(name)`.
- `src/lib/capacity-gain.ts` — top-lifts grouping keyed by `exerciseIdentityKey(name)`; `displayName` preserves the first-seen visible string.

No visible name change. No DB payload change. No AI shape change.

## 8. Deferred wiring (risky)

- `src/lib/longitudinal.ts` — needs broader review of consumers; defer.
- `rotation-audit.ts` — no raw name join present; nothing to wire.
- AI Stage 3 prompt → would require asking the model to emit canonical keys; stop, requires prompt rewrite.
- Schema `ExerciseZ` → adding `exercise_key` is a generation-output change; defer.
- PDF / editor visible labels → out of scope.

## 9. Notes

- Muscle vocabulary in 30 seeded entries reuses `MuscleGroup` keys exactly (`chest|back|quads|hamstrings|glutes|shoulders|biceps|triceps|calves|core`). No new muscle keys invented.
- Aliases include common PT-PT spellings with and without diacritics (normalizer handles either).