## Round 2 — Prescriptive landmarks + UX polish

### Scope
1. **Prescriptive volume landmarks (AI input, not post-hoc check)**
   - Create `src/lib/prescribe-volume.ts` with `prescribeWeeklySets(persona, week, blockNumber)` returning per-muscle target sets bounded by MEV/MAV/MRV (deload week → MEV, accumulation → MAV, intensification → MAV→MRV).
   - Thread the prescription into Stage 2 (blueprint) and Stage 3 (microcycle) prompts in `src/server/phased-pipeline.server.ts` (or wherever prompts assemble) as a hard constraint table the model must respect.
   - Keep the existing post-hoc validator as a safety net but stop relying on it as the source of truth.

2. **"Plano" tab placement**
   - Move the Plano tab to the leftmost position in `src/routes/clients.$clientId.tsx` (or the client tabs component) since it's the primary artifact trainers open the client for.

3. **Lineage walk unit tests**
   - Add `src/lib/__tests__/plan-lineage.test.ts` covering: single plan, 3-block chain, cycle protection, missing parent.
   - Add a smoke test for `prescribeWeeklySets` (deload returns MEV, week 4 of accumulation hits MAV, etc.).

### Files
- create: `src/lib/prescribe-volume.ts`, `src/lib/__tests__/plan-lineage.test.ts`, `src/lib/__tests__/prescribe-volume.test.ts`
- edit: `src/server/phased-pipeline.server.ts` (prompt assembly), client tabs route file

### Out of scope this round
Forward simulation engine, persona model, simulation visualization route — those land in Round 3 once the AI has a deterministic landmark contract to work against.

Approve to proceed?