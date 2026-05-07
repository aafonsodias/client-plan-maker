---
name: Exercise media data model (future)
description: Future exercise_media row shape, keyed by ExerciseKey. Spec only — no schema, no migration.
type: feature
---

# Exercise Media — Future Data Model

> Spec only. No schema, no migration, no TypeScript types shipped this round.
> Foundation for an eventual `exercise_media` table once Slice 2 (identity wiring) is done and provider is chosen.

## Identity

Every media row is keyed by the **canonical** `exercise_key: ExerciseKey` from `src/lib/exercise-taxonomy.ts`. No free-text exercise names. Unknown keys are not permitted in this table — a media asset without a canonical exercise has no place in the library.

## Field shape (proposed)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `exercise_key` | `ExerciseKey` | FK to canonical taxonomy (R74). Required. |
| `provider` | `ExerciseMediaProvider` | enum (see below) |
| `provider_asset_id` | string | provider's internal asset ID |
| `provider_playback_id` | string \| null | playback ID where distinct (Mux, CF Stream) |
| `playback_url` | string \| null | resolved URL when stable |
| `thumbnail_url` | string \| null | poster/thumb |
| `angle` | `ExerciseMediaAngle` | front / side / diagonal / top / close_up / multi_angle |
| `media_type` | `ExerciseMediaType` | real_video / thumbnail / stickfigure_overlay / avatar / landmark_overlay / image_sequence |
| `quality_status` | `MediaQualityStatus` | **reused from `src/lib/exercise-taxonomy.ts`** — do NOT redefine |
| `review_status` | `ExerciseMediaReviewStatus` | draft / usable_reference / under_review / verified / rejected / deprecated / needs_reshoot |
| `version` | int | bump on re-edit/reshoot |
| `language` | string \| null | BCP-47 if voiceover present (usually null — clips have no audio) |
| `duration_seconds` | number | |
| `aspect_ratio` | string | e.g. `9:16`, `16:9`, `1:1` |
| `resolution` | string | e.g. `1080x1920` |
| `is_default` | bool | one default per (exercise_key, angle) |
| `is_public` | bool | gating |
| `is_protocol_canonical` | bool | true for Protocol-owned verified clips; false for trainer overrides |
| `trainer_id` | uuid \| null | non-null for trainer-custom media |
| `source_file_name` | string | matches naming convention |
| `master_file_location_note` | string | external archive pointer (never a public URL) |
| `filmed_at` | date | |
| `filmed_by` | string | |
| `performed_by` | string | demonstrator |
| `reviewed_by` | uuid \| null | |
| `review_notes` | text | |
| `technical_notes` | text | cue-related observations |
| `limitations` | text | "ROM limited", "no lateral angle", etc. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

## Enum proposals

### `ExerciseMediaProvider`
`bunny` · `cloudflare_stream` · `mux` · `youtube_reference` · `local_reference` · `other`

### `ExerciseMediaAngle`
`front` · `side` · `diagonal` · `top` · `close_up` · `multi_angle`

### `ExerciseMediaType`
`real_video` · `thumbnail` · `stickfigure_overlay` · `avatar` · `landmark_overlay` · `image_sequence`

### `ExerciseMediaReviewStatus`
`draft` · `usable_reference` · `under_review` · `verified` · `rejected` · `deprecated` · `needs_reshoot`

### `MediaQualityStatus`
**Reuse** from `src/lib/exercise-taxonomy.ts` (`MEDIA_QUALITY_STATUSES` — `no_media` · `founder_demo` · `reference_demo` · `verified_demo` · `needs_reshoot` · `angle_limited` · `illustrative_only` · `stickfigure_overlay` · `ai_assisted_visual`). Do not duplicate.

## Indices (when shipped)

- `(exercise_key, angle, is_default)`
- `(exercise_key, media_type)`
- `(trainer_id, exercise_key)` partial where `trainer_id is not null`
- `(review_status)` for review queue

## RLS posture (when shipped)

- Protocol-canonical rows: readable by all authenticated trainers.
- Trainer custom rows: readable by owner only.
- Insert/update via Protocol admin role or trainer ownership.

## Hard non-goals for this round

No table created. No migration. No types file. No upload UI. No player. Spec only.
