---
name: Exercise AI / avatar / overlay pipeline
description: AI, avatar, stickfigure and landmark overlays are visual layers on top of real movement, never the source of technical truth.
type: feature
---

# Exercise AI / Visual Pipeline

## Position

AI, avatar, stickfigure, and landmark overlays are **visual layers**. They are never the source of technical truth.

Truth order:

1. Real filmed movement (correct demonstrator, correct angle, correct ROM).
2. Reviewed technique notes + structured cues.
3. Cleaned/edited master video.
4. Optional landmark / pose overlay layered on the real video.
5. Optional stickfigure / avatar derivative.

A clip cannot skip steps 1–3 and start at 4 or 5.

## Hard rules

- Preserve joint timing.
- Preserve stance.
- Preserve range of motion (no extending depth the demonstrator did not reach).
- Preserve camera angle (no synthetic re-camera).
- Preserve tempo (no speed changes baked into the master; slow-mo is a separate derivative).
- No invented depth.
- No hidden correction of bad technique.
- No distorted limbs.
- No oversized head / mascot styling.
- No creepy character.
- No AI-generated-from-scratch exercises as canonical media.

## Decision rule

If the avatar/stickfigure quality is not excellent **for that exercise**, ship the **real video + landmark overlay** instead. Bad avatars are worse than no avatar — they teach the wrong shape.

## Where this lives

- Quality status flags `stickfigure_overlay` and `ai_assisted_visual` already exist in `MediaQualityStatus` (`src/lib/exercise-taxonomy.ts`). Reuse them; do not invent more.
- Future `media_type = stickfigure_overlay | landmark_overlay | avatar` rows in `exercise_media` reference the **same** `exercise_key` as the real video they were derived from.
- An avatar or stickfigure is never `is_default` for an exercise that has an acceptable real video.
