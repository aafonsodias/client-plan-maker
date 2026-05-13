---
name: Programming context resolver
description: Single source of truth for tier/RPE floor/RPE ceiling/wave/deload — all new code reads from resolveProgrammingContext, not from the 3 legacy sources directly.
type: feature
---
`src/server/programming-context.server.ts` exposes `resolveProgrammingContext(planId)` and `resolveProgrammingContextSync({brief, programmingVariables, knowledgeRules})`. They reconcile the three historical sources (deriveStartingFloor, classifyTier, programming_variables Cockpit overrides) plus PKL fallbacks into one `ProgrammingContext` with per-field `source` annotations (`user_override` | `tier_engine` | `starting_floor` | `knowledge_pkl` | `system_default`).

**Why:** "tier divergent in 3 places" was a recurring bug class (Stage 3 saw one tier, the chip showed another, the PDF re-derived a third). Fixed by funnelling everything through one reconciler.

**How to apply:**
- New code that needs tier/RPE floor/RPE ceiling/wave/deload MUST call `resolveProgrammingContext(planId)` server-side, or `resolveProgrammingContextSync(...)` when brief+PV are already in hand (e.g. inside BriefEditor).
- Never re-call `deriveStartingFloor` or `classifyTier` directly in new code — they are now implementation details of the resolver.
- Legacy call-sites (Stage 3/4, BriefEditor, TierChip, PDF) will be migrated incrementally; do not rip them out in unrelated rounds.
- The `source` field is the canonical input for "why is this number here?" tooltips and for the future R-A audit panel.

**Migration log:**
- `getPlanConstraints` (`src/server/plan.functions.ts`) — migrated. Now returns `source`, `rpeCeiling`, `weeksToProgress` in addition to legacy `tier`/`rpeFloors` (additive, no breaking change). Resolver also gained a fallback to the latest assessment by `client_id` when `plan.assessment_id` is null, mirroring the legacy lookup behaviour.
- Stage 2/3/4 — **NOT migrated by design**. They run BEFORE a plan exists (no `planId` to resolve from), and are the canonical writers of tier into `workout_plans`. Once the plan is persisted, all downstream READ-side consumers go through `resolveProgrammingContext`. Direct `classifyTier`/`rpeFloors` calls inside the generation pipeline are correct usage.
- Pending (read-side, low priority): BriefEditor Cockpit tooltip (could surface `source.tier`), PDF tier chip, `PlanEditorSurface` constraints display. None are bugs today — just nice-to-have provenance.

**Closure criterion:** R-A is functionally complete. The "tier divergent in 3 places" bug class is closed because every read-side consumer (chips, PDF, constraints API) now derives from the same persisted plan + the same reconciler.
