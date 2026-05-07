---
name: Exercise media production workflow
description: 7-step pipeline from planning a clip to attaching it to an exercise card. Spec only.
type: reference
---

# Exercise Media — Production Workflow

Pipeline used by founder (and later, vetted contributors) to produce media that can be tagged `reference_demo` or `verified_demo`. Filming standards live in [production notes](mem://specs/exercise-media-production.md); this doc is the end-to-end workflow.

## Step 1 — Plan
- Pick `exercise_key` from `src/lib/exercise-taxonomy.ts`.
- Pick `angle` (`front`, `side`, `diagonal`, `top`).
- Decide purpose (initial reference vs verified replacement vs reshoot).
- Decide quality target (`reference_demo` minimum; aim for `verified_demo`).
- Confirm equipment + space + clean background.

## Step 2 — Film
- Tripod mandatory.
- Whole body in frame for entire rep.
- Clean neutral background; no other people.
- Good even light; fitted, contrasting clothing.
- Slate at frame 1: `{exercise_key} · {date} · v{n}` (visible board or clapper).
- 3 normal reps + 1 slow rep.
- Pause 1–2s before/after to allow clean trims.
- No talking; ambient room audio only.

## Step 3 — Select
- Watch all takes.
- Pick best take per angle.
- Note limitations (ROM, angle, ROM bias, fatigue).
- Reject takes with poor form, poor framing, or obstructed view — move to `06_rejected_or_needs_reshoot/`.

## Step 4 — Edit
- Trim to 6–12 seconds.
- Stabilize only if camera moved (avoid otherwise — masks technique).
- Light color correction; no filters.
- Crop to target aspect ratio (`9:16` for mobile cards; keep `16:9` master if useful).
- Export master to `02_edited_masters/`. Master is immutable from this point.

## Step 5 — Review
- Watch master against cues.
- Assign `MediaQualityStatus` (founder_demo / reference_demo / verified_demo / etc).
- Add `technical_notes` and `limitations`.
- If unusable: mark `needs_reshoot`, leave note in `metadata_notes/`.

## Step 6 — Encode / upload (DEFERRED)
- Future: upload master to chosen provider (Bunny / Cloudflare Stream / Mux).
- Provider returns asset ID + playback ID + thumbnail URL.
- Store in `03_streaming_exports/` reference + future `exercise_media` row.
- **Not implemented this round.** Pre-provider phase: keep masters local, reference them with `provider = local_reference`.

## Step 7 — Attach (DEFERRED)
- Future: insert `exercise_media` row keyed by `exercise_key + angle + media_type`.
- Mark `is_default` for the first acceptable per (exercise, angle).
- Replace older defaults when verified media arrives.
- **Not implemented this round.**

## Out of scope

Upload UI, provider integration, player, schema, review queue UI, trainer-custom uploads — all deferred per [implementation plan](mem://audits/exercise-media-implementation-plan.md).
