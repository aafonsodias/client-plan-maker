# R74 — Exercise + Session Taxonomy Foundation

Pure-TypeScript foundation round. No schema, no UI, no generation changes, no schema/PKL/PDF changes. Visible exercise names unchanged.

## Scope

### 1. Audit (`.lovable/r74-exercise-session-taxonomy-audit.md`)

Document, with file:line references:
- Where exercise names enter (`ExerciseZ` in `src/server/phased/schemas.ts`, AI Stage 3/4/5 outputs).
- Where they're displayed (PDF in `src/lib/pdf.ts`, plan editor cards, logbook).
- Where they're used as identity keys (lowercased joins in `volume-actual.ts:54`, `capacity-gain.ts:49`, longitudinal/rotation audit).
- Where muscle strings are normalized (`volume-landmarks.ts` → `normaliseMuscle` + `MUSCLE_ALIASES`).
- Where unknown exercises/muscles drop silently (volume-actual returns no muscles when name not in plan index; capacity-gain key collision).
- Whether warm-up/cooldown/session blocks exist structurally today (answer: no — `ExerciseZ` is flat list; `notes`/`focus` are free text).
- Safe-to-wire call sites (3 candidates: `volume-actual.ts` plan index key, `capacity-gain.ts` name key, `rotation-audit.ts` dedupe key).
- Risky/deferred sites (AI prompt, PDF render, plan editor, schemas, DB columns).

### 2. `src/lib/exercise-taxonomy.ts` (new, pure)

- `EXERCISE_TAXONOMY_VERSION = 1`
- String-literal union types + `as const` arrays for: umbrella categories (8), movement patterns (25), equipment (22), level (5), caution flags (16), media quality statuses (9). Keys exactly per spec.
- `EXERCISES` readonly map of the 30 specified keys with `{ key, name_pt, name_en, aliases_pt, aliases_en, umbrella, movement_pattern, equipment[], level, primary_muscles[], secondary_muscles[], caution_flags[], media_quality_default }`. Muscles use canonical `MuscleGroup` keys from `volume-landmarks.ts`.
- Helpers (pure, no I/O):
  - `normalizeExerciseName(input)` — lowercase, NFD strip diacritics, collapse whitespace, normalize `-/_` to space, trim punctuation.
  - `exerciseKeyFromName(input)` — alias+canonical lookup, returns `ExerciseKey | null`.
  - `exerciseIdentityKey(input)` — returns canonical key or `unknown:<normalized>` (never empty/null).
  - `getExerciseTaxonomyEntry`, `isKnownExercise`, `getExerciseAliases`, `getExercisePattern`, `getExerciseCautionFlags`, `collectUnknownExerciseNames`.

### 3. `src/lib/session-taxonomy.ts` (new, pure)

- `SESSION_TAXONOMY_VERSION = 1`
- `SESSION_BLOCK_TYPES` literal union (17 entries per spec).
- `SESSION_BLOCK_LABELS_PT` and `SESSION_BLOCK_LABELS_EN` maps (verbatim from spec).
- No generation hookup. No UI import.

### 4. `mem/specs/session-structure-principles.md` (new)

Principle: a complete session may include warm-up → mobility → activation → coordination/balance → cognitive dual-task → main strength/skill → conditioning → cooldown → breathing → mobility → education note. Not all blocks every session. Tagline: "Diretrizes orientam. O treinador simplifica e aplica." / "Guidelines inform. The coach simplifies and applies."

### 5. Safe wiring (conservative)

Only if mechanical and behaviour-preserving, replace lowercased-name keys with `exerciseIdentityKey(...)` in up to 3 sites:
- `src/lib/volume-actual.ts` `indexPlanExercises` map key + lookup.
- `src/lib/capacity-gain.ts` `n = name.toLowerCase()` key.
- `src/lib/rotation-audit.ts` dedupe key (only if obvious).

Visible names, AI shape, DB payloads, PDFs unchanged. If any site is non-trivial, defer and document.

### 6. Doc updates

- `mem/audits/exercise-library-priority.md` — mark Slice 1 shipped; redefine Slices 2–7 per spec.
- `.lovable/r74-session-mock-note.md` — note that current strength mock is incomplete as session representation; future variants needed.
- `mem/index.md` — add taxonomy + session-structure references.
- `.lovable/plan.md` — append R74 summary.

### 7. Verification

`tsc --noEmit` clean. Verify alias mappings: "Goblet Squat", "Agachamento Goblet" → `goblet_squat`; "Peso morto romeno com halteres" → `dumbbell_romanian_deadlift`; "Prancha"/"Plank" → `plank`; unknown → `unknown:<normalized>`.

## Out of scope (hard non-goals)

Schema, migrations, new routes, new server functions, new deps, exercise library UI, trainer overrides, suggestion queue, media upload, video player, stickfigure pipeline, games DB, education PDF, AI study assistant, plan editor rebuild, exercise swap flow, AI prompt rewrite, PKL changes, PDF redesign, billing/auth/schedule changes, historical data rewrite, visible exercise name changes.

## Files touched

New: `src/lib/exercise-taxonomy.ts`, `src/lib/session-taxonomy.ts`, `mem/specs/session-structure-principles.md`, `.lovable/r74-exercise-session-taxonomy-audit.md`, `.lovable/r74-session-mock-note.md`.

Edited (docs): `mem/audits/exercise-library-priority.md`, `mem/index.md`, `.lovable/plan.md`.

Edited (code, only if trivially safe): `src/lib/volume-actual.ts`, `src/lib/capacity-gain.ts`, optionally `src/lib/rotation-audit.ts`.
