---
name: Exercise library implementation priority
description: Now / Next / Later / Parked ranking of exercise-library slices.
type: feature
---

# Exercise Library — Implementation Priority

## Ranking criteria

MVP impact · implementation cost · dependency order · risk · value for plan generation · value for client app · value for media

## Slice 1 — Static exercise + session taxonomy foundation ✅ shipped R74

- `src/lib/exercise-taxonomy.ts` — enums + 30 seeded canonical exercises + helpers (`normalizeExerciseName`, `exerciseKeyFromName`, `exerciseIdentityKey`, …).
- `src/lib/session-taxonomy.ts` — 17 session block types + PT/EN labels.
- Safe wiring: `volume-actual.ts` and `capacity-gain.ts` now key joins by `exerciseIdentityKey()`.
- Unknown names fall back to `unknown:<normalized>` (no silent merging).

## R75 — Exercise media architecture (docs only) ✅ shipped

Documentation round. No schema, UI, upload, player, or provider integration.
New specs: hosting architecture, data model, file organisation, production workflow, AI visual pipeline, implementation plan.
`MediaQualityStatus` from R74 is reused; no parallel vocabulary introduced.
**Does NOT replace Slice 2.**

## Slice 2 — Wire canonical keys into remaining critical paths

**Still the next technical MVP slice.** Media implementation (Phase 3+ of the [media plan](mem://audits/exercise-media-implementation-plan.md)) depends on this landing first.

- `longitudinal.ts` exercise grouping → `exerciseIdentityKey`.
- Logbook continuity matching across sessions/blocks.
- `prior_exercise_pool` dedupe (still string-based).
- Goal: remove the last lowercased-name joins from analytics paths.

## Slice 3 — Add `exercise_key` to plan validation metadata

- Annotate plan/day/exercise rows with resolved canonical key (or `unknown:`) at parse-time, without changing AI output shape.
- Persist as derived metadata; no schema migration needed if attached in `generation_meta`.

## Slice 4 — Structured session blocks in generation output

- Allow Stage 3 to emit blocks tagged with `SessionBlockType` so warm-up / mobility / activation / strength / conditioning / cooldown stop being hidden in `notes`.
- AI prompt change required.

## Slice 5 — Schema-backed canonical `exercises` table

- Migrate static seed → table + readonly founder viewer.
- Plan rows reference `exercise_id`.

## Slice 6 — Trainer overrides (`trainer_exercise_overrides`)

- Custom names, cues, equipment swaps without corrupting Protocol defaults.

## Slice 7 — Exercise media fields + private bucket

- `video_real_front_url`, `video_real_side_url`, `media_quality_status` columns.
- Founder uploads first; reference/verified later.

## Parked

9. Suggestion review queue (needs Slice 3 to be useful)
10. Traditional games / Play library table — wait until Slice 5 search exists; then Play is just another umbrella
11. AI-assisted visual / stickfigure overlay generation
12. Crowd cue suggestions

## Why this order

Slice 1 is risk-free and unblocks everyone. Slice 2 forces us to commit to canonical IDs without coupling them to the prescription pipeline yet. Slices 3–6 build the editorial surface. Slice 7 is the **highest-leverage refactor** for accurate volume but depends on stable IDs from Slice 2. Slice 8 is the user-visible payoff.

Play library deliberately follows the search/taxonomy work — shipping it earlier means duplicating filter + detail UI.
