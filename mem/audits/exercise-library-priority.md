---
name: Exercise library implementation priority
description: Now / Next / Later / Parked ranking of exercise-library slices.
type: feature
---

# Exercise Library — Implementation Priority

## Ranking criteria

MVP impact · implementation cost · dependency order · risk · value for plan generation · value for client app · value for media

## Now (Slice 1)

**Static taxonomy file** — `src/lib/exercise-taxonomy.ts`
- enums for umbrella, movement_pattern, equipment, level, contraindication_flags, media_quality_status
- alias mapping reusing `volume-landmarks.ts` muscle keys
- zero schema, zero UI, zero AI changes
- unblocks: AI prompt vocab, future filter UI, future override forms, naming consistency

## Next (Slice 2)

**Canonical `exercises` table seeded with the first 30 priority entries** + readonly admin viewer page (founder-only)
- enables stable IDs we can later reference from plan JSON
- proves the override layer concept on a small surface
- still no plan-editor swap; volume math still name-keyed

## Later

3. Trainer override / fork system (`trainer_exercise_overrides` table + minimal UI)
4. Exercise media fields + private bucket for video assets (no upload UI yet)
5. Exercise search page (`/exercises`) using taxonomy + canonical table
6. Exercise detail page with cues + media + provenance
7. Volume calculation refactor: name-keyed → id-keyed (gates accurate weekly volume)
8. Plan editor swap using library (substitution by pattern + equipment + contraindication)

## Parked

9. Suggestion review queue (needs Slice 3 to be useful)
10. Traditional games / Play library table — wait until Slice 5 search exists; then Play is just another umbrella
11. AI-assisted visual / stickfigure overlay generation
12. Crowd cue suggestions

## Why this order

Slice 1 is risk-free and unblocks everyone. Slice 2 forces us to commit to canonical IDs without coupling them to the prescription pipeline yet. Slices 3–6 build the editorial surface. Slice 7 is the **highest-leverage refactor** for accurate volume but depends on stable IDs from Slice 2. Slice 8 is the user-visible payoff.

Play library deliberately follows the search/taxonomy work — shipping it earlier means duplicating filter + detail UI.
