---
name: Exercise data model (proposed)
description: Future flat field list and normalisation plan for canonical exercises + trainer overrides + suggestions. Spec only — no schema yet.
type: feature
---

# Exercise Data Model — proposed

> Spec only. No migration runs from this doc.

## Flat record (read shape)

```
exercise_id                  uuid
canonical_exercise_id        uuid | null    -- null on canonical rows; FK on overrides
trainer_id                   uuid | null    -- null on canonical; set on overrides/suggestions
is_protocol_default          boolean
is_trainer_override          boolean

name_pt                      text
name_en                      text
aliases_pt                   text[]
aliases_en                   text[]

umbrella_category            enum   -- strength|mobility|cardio|balance|power|skill|recovery|play
subcategory                  enum   -- movement_pattern (see taxonomy doc)
movement_pattern             enum   -- canonical pattern key
joint_actions                text[] -- e.g. hip_extension, knee_extension

primary_muscles              muscle_group[]   -- canonical keys from volume-landmarks
secondary_muscles            muscle_group[]
equipment                    text[]           -- controlled vocab
level                        enum             -- beginner|intermediate|advanced

setup                        text
execution                    text
breathing                    text
tempo                        text
range_of_motion_notes        text
key_cues                     text[]
common_mistakes              text[]

regressions                  exercise_id[]    -- references; empty for now, FK later
progressions                 exercise_id[]
substitutions                exercise_id[]

contraindication_flags       text[]   -- low_back|knee|shoulder|pregnancy|hypertension|...
risk_notes                   text
volume_counting_notes        text
measurable_metric            text     -- e.g. "1RM kg", "max reps", "30s reps"

video_real_front_url         text
video_real_side_url          text
video_stickfigure_url        text
thumbnail_url                text
media_quality_status         enum     -- see media-quality doc
media_notes                  text

source                       text     -- "protocol_canonical_v1" | trainer | citation
evidence_notes               text
review_status                enum     -- draft|trainer_custom|suggested|under_review|accepted|rejected|deprecated|needs_evidence|needs_media
version                      integer
created_at, updated_at       timestamptz
```

## Normalisation when we ship for real

Future tables (do not create now):

- `exercises` — canonical rows (one per exercise, versioned)
- `trainer_exercise_overrides` — sparse diff against canonical, per trainer
- `exercise_suggestions` — submissions into review queue
- `exercise_muscles` — `(exercise_id, muscle_group, role primary|secondary, contribution)` — frees us from PG arrays for join-heavy volume math
- `exercise_equipment` — `(exercise_id, equipment_key)`
- `exercise_media` — many-to-one media assets with quality_status + angle
- `exercise_progressions` — `(from_id, to_id, kind progression|regression|substitution)`
- `exercise_tags` — free taxonomy bag (cultural origin, programming family, etc.)

## Migration considerations (R72 only — design notes)

- New `exercises.canonical_exercise_id` column on `workout_plan_days.exercises` JSON entries — backfilled by name match later.
- Volume math swap (`volume-compute.ts`) from name-keyed → id-keyed is the gating refactor for accurate weekly volume.
- AI Stage 3 prompt should eventually receive a **list of allowed canonical IDs + names** to reference, instead of generating free-text names.

## Override merge rule

```
display_record = canonical_record  ⊕  override_diff   (override wins per field)
```

Acceptance of a suggestion bumps `canonical.version` and **does not delete** existing overrides. Overrides whose diffed fields collide with the new canonical version can be flagged "stale" but not auto-removed.
