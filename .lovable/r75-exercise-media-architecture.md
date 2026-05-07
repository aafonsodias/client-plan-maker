# R75 — Exercise Media Architecture (Documentation Round)

## Round type

Documentation only. No schema, no UI, no upload, no player, no provider integration, no dependencies, no taxonomy changes.

## R74 alignment findings

Verified in `src/lib/exercise-taxonomy.ts`:
- `ExerciseKey` exported (line 182). Reused, not duplicated.
- `MediaQualityStatus` + `MEDIA_QUALITY_STATUSES` already defined (lines 117–128). **R75 reuses this verbatim** — no competing vocabulary introduced.
- `EXERCISE_TAXONOMY_VERSION = 1` and entries already carry `media_quality_default`.
- `src/lib/session-taxonomy.ts` exists; untouched (not media-related).
- Existing media docs (`exercise-media-quality.md`, `exercise-media-production.md`) cross-linked from new specs; not duplicated.

## Architecture decision

`Raw capture → Edited master → Streaming provider → App metadata (keyed by ExerciseKey) → Exercise card`.

The app stores lightweight provider-agnostic metadata only. Video bytes never live in the repo, app bundle, or DB rows.

## Position on YouTube

`youtube_reference` only — allowed for founder review, internal POC, temporary validation. Forbidden as primary product media, branded client experience, "private storage", or permanent canonical URL.

## Files created

1. `mem/specs/exercise-media-hosting-architecture.md`
2. `mem/specs/exercise-media-data-model.md`
3. `mem/specs/exercise-media-file-organisation.md`
4. `mem/specs/exercise-media-production-workflow.md`
5. `mem/specs/exercise-ai-visual-pipeline.md`
6. `mem/audits/exercise-media-implementation-plan.md`
7. `.lovable/r75-exercise-media-architecture.md` (this file)

## Files updated

8. `mem/specs/exercise-media-quality.md` — Founder Demo Honesty Model section appended; cross-links to `MediaQualityStatus` in code.
9. `mem/audits/exercise-library-priority.md` — R75 noted, Slice 2 confirmed as next technical slice.
10. `mem/features/exercise-media-layer.md` — points to new hosting architecture spec.
11. `mem/index.md` — references added.

## Optional pure type file

**Skipped.** `src/lib/exercise-media-types.ts` not created. Rationale: nothing in the codebase consumes these enums yet; introducing them risks parallel vocabulary drift before the schema lands. Re-evaluate at Phase 3 (schema slice). The data model spec captures the same intent.

## Slice 2 dependency note

R75 does NOT replace Slice 2. The next technical MVP slice remains:
**Slice 2 — extend `exerciseIdentityKey()` into `longitudinal.ts`, logbook continuity matching, and remaining lowercased-name joins flagged in the R74 audit.**

Media implementation (Phase 3+) depends on:
1. Stable taxonomy foundation (✅ R74).
2. Broader identity wiring (Slice 2, pending).
3. Actual filmed assets (Phase 0, in-progress externally).
4. Clear exercise card destination (UI work, pending).
5. Provider/budget decision (pending).

## Deliberately NOT implemented this round

- No schema changes / migrations / new tables.
- No upload UI, video player, signed URLs, CDN setup.
- No provider API integration (Bunny, Cloudflare Stream, Mux).
- No new routes, server functions, or dependencies.
- No exercise library UI / avatar pipeline / AI video.
- No generation / PKL / PDF / billing / schedule changes.
- No edits to `exercise-taxonomy.ts` or `session-taxonomy.ts`.
- No duplicate exercise identity model.
- No duplicate media quality vocabulary.
- No `exercise-media-types.ts` (deferred).
