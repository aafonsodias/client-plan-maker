---
name: Exercise intelligence layer — deferred scope
description: Future structured exercise database with muscle/pattern/equipment/pain mapping. Do NOT patch in piecemeal.
type: feature
---
# Exercise Intelligence Layer — full direction

Today an "exercise" is a free-text `name` plus AI-authored `primary_muscles[]`, `secondary_muscles[]`, `equipment[]` strings (`ExerciseZ` in `src/server/phased/schemas.ts`). Volume math, rotation pool, logbook, PDF, and substitution all key on the lowercased name. There is no canonical record, no override, no media, no progression edges, no contraindication flag.

## What we are building toward

A three-layer exercise system:

1. **Protocol canonical** — versioned, structured, evidence-aware. Source of truth for cues, muscles, pattern, level, contraindications. Maintained by Protocol; never auto-overwritten.
2. **Trainer override (fork)** — per-trainer record referencing `canonical_exercise_id`. Stores only diffed fields (custom cue, preferred video, equipment swap, naming). Invisible to other trainers.
3. **Suggestion queue** — trainer-submitted improvements enter `under_review`. Acceptance bumps canonical version; existing overrides keep working.

## What it unlocks

- Volume math joins on `exercise_id`, immune to name drift.
- Rotation pool keys on canonical IDs (no more "OHP" vs "Overhead Press" double counting).
- Plan editor swap suggests substitutions by pattern + equipment + contraindication.
- PDF and logbook show consistent naming + locale (PT/EN/aliases).
- Cue + video + contraindication available at every prescription surface.
- Client education and Play / Games library plug into the same taxonomy.

## Core principle

There is no universal recipe. Protocol provides a **defensible default**; the coach adapts it. Quality stays controlled because the canonical layer is moderated, not crowd-edited.

## Dependencies / blast radius

Touches: `volume-compute.ts`, `volume-actual.ts`, `rotation-audit.ts`, `prior_exercise_pool` in `generation_meta`, plan editor cards, PDF rendering, AI prompts (Stage 2/3 must reference canonical IDs not free names).

## Open spec docs

- [Taxonomy](mem://specs/exercise-library-taxonomy.md)
- [Data model](mem://specs/exercise-data-model.md)
- [Media quality](mem://specs/exercise-media-quality.md)
- [Play / Games library](mem://features/traditional-games-play-library.md)
- [Implementation priority](mem://audits/exercise-library-priority.md)
- [Current-system audit](.lovable/r72-exercise-system-audit.md)

## Do not implement until

The static taxonomy file (Slice 1) lands first. No schema work, no UI, no media upload, no substitution engine before Slice 1 is in code and used by AI prompts.
