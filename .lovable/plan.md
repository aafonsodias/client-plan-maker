# R72 — Exercise Intelligence, Media & Play Library Spec

**Spec-only round.** No schema, no migrations, no routes, no UI, no server functions, no dependencies, no engine/PKL/PDF changes. All output lives in `mem/` and `.lovable/` markdown.

## Audit (already sampled)

Current exercise representation is **string-keyed and unstructured**:

- `ExerciseZ` (`src/server/phased/schemas.ts:276`) → `name: string`, `primary_muscles: string[]`, `secondary_muscles: string[]`, `equipment: string[]`, plus free-text `cue`/`rationale`/`technique_cues`/`tempo`. **No exercise_id, no movement_pattern field, no canonical reference.**
- Volume math (`src/lib/volume-compute.ts`, `volume-actual.ts`) joins log entries to plan exercises by **lowercased name string match**. Any rename breaks volume.
- Logbook + PDF (`src/lib/pdf.ts`, `download-plan.ts`) carry the same name string forward.
- Rotation/anti-repeat (`src/lib/rotation-audit.ts`, `prior_exercise_pool` in `generation_meta`) keys on names too.
- Demo helper `src/lib/exercise-demo.ts` builds a **YouTube search URL** — there is no media table.
- No exercises table, no overrides table, no progression/regression edges, no contraindications, no aliases.

**Biggest risks**: name drift across AI generations (same exercise spelled three ways → triple-counted in pool, missed in volume); muscle arrays are AI-authored prose, not normalized; no way to fork/customise without forking the whole plan.

## Documents to author

1. **`mem/features/exercise-intelligence-layer.md`** *(rewrite the existing stub)* — full product direction: canonical DB + trainer overrides + suggestion queue, why it matters, dependency on volume/substitution/PDF/cues.
2. **`mem/specs/exercise-library-taxonomy.md`** — umbrellas (Strength · Mobility · Cardio · Balance · Power · Skill · Recovery · Play), 17 movement-pattern subcategories, full filter list, search-bar tokens (name/alias/muscle/equipment/pattern/cue keyword), exercise detail page sections.
3. **`mem/specs/exercise-data-model.md`** *(new)* — proposed flat field list (exercise_id, canonical_exercise_id, trainer_id, is_protocol_default, is_trainer_override, names/aliases pt+en, pattern, umbrella/subcategory, primary/secondary muscles, joint_actions, equipment, setup, execution, breathing, tempo, ROM, cues, mistakes, regressions[], progressions[], substitutions[], level, contraindications, risk_notes, volume_counting_notes, measurable_metric, media refs, source, evidence, review_status, version, timestamps). Notes which fields normalise into `exercise_muscles`, `exercise_equipment`, `exercise_media`, `exercise_progressions`, `trainer_exercise_overrides`, `exercise_suggestions`, `exercise_tags` later.
4. **`mem/specs/exercise-media-quality.md`** — eight media statuses (reference_demo, verified_technique, needs_reshoot, angle_limited, founder_demo, external_model, stickfigure_overlay, ai_assisted_visual), per-asset notes vocabulary, **principle: technical truth lives in cues + review_status, not in the video**. First-10 + first-30 filming priority list with rules (real movement first, frontal+lateral, 6–12s, 3 normal + 1 slow rep, no audio).
5. **`mem/features/traditional-games-play-library.md`** *(new)* — Play umbrella taxonomy, full game/activity field list, 13 categories, cultural-respect rules ("record origin, do not romanticise, no medical claims without evidence"), seed list to investigate (jogo da malha, lenço, sacos, tração à corda, macaca, apanhada, rope/ball/balance/reaction games).
6. **`.lovable/r72-exercise-system-audit.md`** — the audit findings above expanded: where names come from per surface, what breaks on rename, name→ID migration risks, volume-math implications, rotation-pool implications, smallest-future-slice analysis.
7. **`mem/audits/exercise-library-priority.md`** *(new)* — Now / Next / Later / Parked ranking of the 10 candidate slices, with cost vs MVP impact vs dependency notes.

## Default vs Trainer-Custom version model (summary)

Three layers, never auto-merged:
- **Protocol canonical** — versioned, stable, our source of truth.
- **Trainer override** — per-trainer fork referencing `canonical_exercise_id`; only the diffed fields persist; invisible to other trainers.
- **Suggestion** — trainer proposal into `under_review` queue; review states: draft · trainer_custom · suggested · under_review · accepted · rejected · deprecated · needs_evidence · needs_media. Acceptance bumps canonical version; everyone else's overrides keep working.

## Recommended next slice (will be argued in priority doc)

**Slice 1 — Static taxonomy file only** (`src/lib/exercise-taxonomy.ts` constant: umbrellas, patterns, filter enums, normalised muscle keys reusing `volume-landmarks.ts`). Zero schema, unblocks every later slice (search filters, override forms, AI prompt hints), and lets us start naming things consistently before any DB work. Slice 2 would be the canonical exercises table seeded with the first 30 priority entries.

## Final report shape

The closing report will list: files written, audit findings, risks, model summaries (data / override / media / games / review), recommended next slice, explicit "not implemented" list, and a confirmation block (no schema · no migrations · no routes · no UI · no server fns · no deps · no engine/PKL changes).
