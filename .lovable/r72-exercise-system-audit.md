# R72 — Current Exercise System Audit

## Where exercise names come from

| Surface | Source | Shape |
|---|---|---|
| Plan generation (Stage 3 microcycle) | AI free-text | `ExerciseZ.name: string` (`src/server/phased/schemas.ts:276`) |
| `workout_plan_days.content.exercises[]` | persisted as-is from AI | JSONB string |
| Logbook entries | typed by trainer/client OR copied from plan | string |
| PDF render | `src/lib/pdf.ts`, `download-plan.ts` | string |
| Volume math | name → exercise lookup, lowercased | `src/lib/volume-compute.ts`, `volume-actual.ts` |
| Rotation pool | `generation_meta.prior_exercise_pool` | array of names |
| Substitution | none — manual |
| Demo media link | YouTube search URL built from name (`src/lib/exercise-demo.ts`) |

## Findings

1. **No stable ID anywhere.** Names are the join key everywhere.
2. **Muscles are AI prose.** `primary_muscles[]` and `secondary_muscles[]` are free strings normalised via `MUSCLE_ALIASES` in `volume-landmarks.ts`. Works ~90% of the time; unknown strings silently drop from volume.
3. **Movement pattern is not a field.** Pattern is inferred from name keywords in places like `WeekMatrixGrid` / PDF labelling. No structured pattern on the exercise record.
4. **Cues are unstructured.** `cue`, `rationale`, `technique_cues` are all free text; no `key_cues[]` array.
5. **Volume math is name-string-keyed.** Renaming "OHP" → "Overhead Press" between blocks causes mismatched joins → undercounted volume.
6. **No substitutions table.** Swap = re-run AI or hand-edit.
7. **No contraindication flags.** Pain-aware substitution impossible without manual judgement.
8. **No media table.** Demo link is a synthesised search query, not curated content.
9. **Rotation pool is name-keyed too** — same drift causes accessories to be flagged "new" when they're the same exercise renamed.

## What breaks if names change

- Volume aggregation undercounts (silent)
- Rotation rule misfires (false novelty)
- Logbook history splits into two exercises
- Capacity-gain analysis (`src/lib/capacity-gain.ts`) loses lineage
- PDF inconsistency between blocks

## Minimum future schema needed

To unlock id-keyed volume + rotation:
- `exercises (id, canonical_exercise_id, name_pt, name_en, movement_pattern, primary_muscles[], secondary_muscles[], equipment[], level, ...)` per [data model](mem://specs/exercise-data-model.md)
- Add `exercise_id` field to the JSON exercise records persisted in `workout_plan_days.content`
- Backfill: lowercased-name match to canonical for existing plans

## Smallest future implementation slice

**Slice 1: static taxonomy file** (`src/lib/exercise-taxonomy.ts`). Zero risk; gives every later refactor a shared vocabulary; lets AI prompts reference controlled enums for `umbrella`, `movement_pattern`, `level`, `contraindication_flags`, `media_quality_status` without touching schema.

See [priority audit](../mem/audits/exercise-library-priority.md) for the full ranking.
