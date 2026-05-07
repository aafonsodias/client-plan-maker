---
name: Exercise media / video layer — deferred scope
description: Future technique videos and cues attached to exercises. Out of scope for MVP.
type: feature
---
Future direction (not for current MVP):
- exercise videos (filmed library or AI-assisted)
- technique clips (form cues)
- simple movement demonstrations
- cues linked to exercise cards in plan view
- client-facing media in PDF (QR or hyperlinked) and in-app
- possible filmed library or AI-assisted media

Do not implement until exercise intelligence layer (mem://features/exercise-intelligence-layer) lands —
videos without canonical exercise IDs will fragment the library.

## Architecture (R75)

The full media architecture is specified across:
- [Hosting architecture](mem://specs/exercise-media-hosting-architecture.md) — raw → master → streaming → app metadata, provider abstraction, YouTube position.
- [Data model](mem://specs/exercise-media-data-model.md) — future `exercise_media` shape keyed by `ExerciseKey`.
- [File organisation](mem://specs/exercise-media-file-organisation.md) — naming + folders.
- [Production workflow](mem://specs/exercise-media-production-workflow.md) — 7-step pipeline.
- [AI visual pipeline](mem://specs/exercise-ai-visual-pipeline.md) — overlay/avatar limits.
- [Implementation plan](mem://audits/exercise-media-implementation-plan.md) — phased rollout. Default Now = docs + file discipline; Next = Slice 2 identity wiring.
