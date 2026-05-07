---
name: Exercise media quality model
description: Honest video/reference taxonomy. Founder demos are reference, not gold standard. Spec only.
type: feature
---

# Exercise Media Quality

## Principle

The technical standard lives in the **structured cues + review_status**, not in the video. A video without verified cues is illustration only. We never present a reference demo as gold-standard.

## Status values

1. `reference_demo` — useful demonstration; technique acceptable; not final media
2. `verified_technique` — reviewed and accepted as high-quality
3. `needs_reshoot` — usable placeholder, planned for replacement
4. `angle_limited` — only one angle (frontal or lateral) available
5. `founder_demo` — performed by founder (orthogonal flag; can combine with reference/verified)
6. `external_model_demo` — performed by another model/coach
7. `stickfigure_overlay` — derived from real movement, not invented
8. `ai_assisted_visual` — visual layer only; not source of technical truth

## Per-asset notes vocabulary

`Founder demonstration · Technique acceptable but not final media · Needs lateral angle · Needs frontal angle · Limited ROM in this version · Use cues as technical standard; video is illustrative · Replace with verified demo later`

## Filming rules (when we shoot)

- Real movement first; AI/stickfigure layered later as visual aid only
- Frontal AND lateral angles
- 6–12 seconds
- Clean background, stable camera, consistent naming convention
- No talking
- 3 normal reps + 1 slow rep
- Save raw + edited

## First 10 priority

Bodyweight Squat · Goblet Squat · Hip Hinge Drill · Dumbbell Romanian Deadlift · Glute Bridge · Reverse Lunge · Incline Push-Up · Band Row · Dead Bug · Plank

## Expanded first 30

Bodyweight Squat · Goblet Squat · Box Squat · Hip Hinge Drill · DB Romanian Deadlift · Glute Bridge · Hip Thrust · Reverse Lunge · Split Squat · Step-Up · Incline Push-Up · Push-Up · DB Bench Press · DB Shoulder Press · Band Row · Cable Row · One-Arm DB Row · Lat Pulldown · Band Face Pull · Dead Bug · Plank · Side Plank · Pallof Press · Bird Dog · Calf Raise · Band Lateral Walk · Clamshell · Hamstring Curl Slider · Wall Sit · Farmer Carry

## Canonical vocabulary location

The status enum lives in code as `MediaQualityStatus` / `MEDIA_QUALITY_STATUSES` in `src/lib/exercise-taxonomy.ts` (R74). This document is the human-readable companion. Do **not** introduce a parallel enum in any future schema — reuse the R74 type.

## Founder demo honesty model

Founder videos are allowed as first reference media, but they are **not** automatically gold-standard.

Principles:
- Useful is not the same as verified.
- A founder demo can be honest reference media; tag it `founder_demo` (and optionally combine with `reference_demo` or `angle_limited`).
- Technical truth lives in the structured cues + `review_status` + future verified media — not in any single clip.
- If founder ROM, angle, mobility, or execution is limited, **record it** in `limitations` / `technical_notes`. Do not hide it.
- Do not use AI to fake better technique on a founder clip.
- Replace with a verified-model demo when one exists; bump `version`, mark old `deprecated`.

Internal labels (free-text notes that complement the enum):
- "Founder reference demo"
- "Usable but not final"
- "Needs lateral reshoot"
- "Needs frontal reshoot"
- "ROM limitation visible"
- "Angle limited"
- "Verified technique demo"

This lets Protocol start with real media without pretending perfection.

## Cross-refs

- Hosting layers: [hosting architecture](mem://specs/exercise-media-hosting-architecture.md)
- Future data shape: [data model](mem://specs/exercise-media-data-model.md)
- Files on disk: [file organisation](mem://specs/exercise-media-file-organisation.md)
- Production: [production notes](mem://specs/exercise-media-production.md) + [workflow](mem://specs/exercise-media-production-workflow.md)
- AI/avatar limits: [AI visual pipeline](mem://specs/exercise-ai-visual-pipeline.md)
- Phasing: [implementation plan](mem://audits/exercise-media-implementation-plan.md)
