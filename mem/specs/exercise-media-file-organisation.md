---
name: Exercise media file organisation
description: Naming convention and folder structure for the founder's external Protocol exercise media archive.
type: reference
---

# Exercise Media — File Organisation

External archive only. No app code consumes these paths today.

## Naming convention

`{exercise_key}_{angle}_{media_type}_v{version}_{yyyymmdd}.{ext}`

Where:
- `exercise_key` — canonical key from `src/lib/exercise-taxonomy.ts` (e.g. `goblet_squat`, `dumbbell_romanian_deadlift`).
- `angle` — `front` · `side` · `diagonal` · `top` · `close_up`.
- `media_type` — `real_video` · `thumbnail` · `stickfigure_overlay` · `landmark_overlay` · `avatar`.
- `version` — integer, starts at 1, bumps on reshoot/re-edit.
- `yyyymmdd` — capture date.

### Examples

- `bodyweight_squat_side_real_video_v1_20260507.mp4`
- `bodyweight_squat_front_real_video_v1_20260507.mp4`
- `goblet_squat_side_thumbnail_v1_20260507.jpg`
- `dead_bug_side_real_video_v1_20260507.mp4`
- `dumbbell_romanian_deadlift_side_real_video_v2_20260612.mp4`

## Folder structure

```
/Protocol Exercise Media
├── 00_raw_capture/          # straight off the camera, never edited
├── 01_selected_takes/       # shortlisted raws, technique acceptable
├── 02_edited_masters/       # cleaned, trimmed, color-corrected; immutable
├── 03_streaming_exports/    # provider-ready encodes (HLS/MP4)
├── 04_thumbnails/           # poster frames + custom thumbs
├── 05_ai_overlay_tests/     # stickfigure / landmark / avatar experiments
├── 06_rejected_or_needs_reshoot/  # kept for reference (bad-form examples)
└── metadata_notes/          # per-exercise filming notes, limitations, dates
```

Once the library grows, mirror one subfolder **per `exercise_key`** inside `02_edited_masters/` and `03_streaming_exports/`.

## Rules

- **Never overwrite a master.** Always bump `_v{n}`.
- **Never edit raws in place.** Copy to `01_selected_takes/` then to `02_edited_masters/`.
- Keep rejected takes if they make useful "common mistakes" examples.
- Record filming notes alongside masters (`metadata_notes/{exercise_key}.md`): camera angle, demonstrator, ROM limitations, lighting issues, planned reshoot.
- Streaming exports are derivative — they can be regenerated from the master at any time.

## Sync to provider (future)

When upload tooling exists, the source of truth for an upload is `02_edited_masters/`, not `03_streaming_exports/` — the provider should re-encode from master so we keep one canonical source.
