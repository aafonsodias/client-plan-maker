---
name: Inline stage flow
description: All 5 plan stages live inline on /clients/$id; approval makes a stage golden + collapsed and auto-expands the next
type: preference
---
All 5 stages (Brief → Blueprint → Microcycle → Progressions → PDF) live inline on `/clients/$id`. Approval flips the stage to golden (amber→emerald), collapses its body, collapses any sibling rail (assessment synthesis, BriefContextRail), and auto-expands the next stage. Dedicated `/plans/$planId/...` routes remain as deep-links but never as the primary flow.

**How to apply:** when adding a new stage, mirror the Blueprint pattern in `clients_.$clientId.tsx` — pass `expandedBody` to `<StageCard/>`, call `setExpandedStage(nextStage)` inside the approve handler, and collapse adjacent rails with the same `inlineBrief.approved` guard.
