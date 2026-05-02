## Phase 5 — Polish, depth, and the second cycle

This batch fixes what's still broken after Phase 4 and unlocks the longer-arc demo flow you asked for (8-week plans, complete a block, kick off Block 2 to evolve the program).

---

### 1. Fix `<UNKNOWN>` in the movement competency block (Brief)

**Root cause:** `startPhasedPlanDraft` (the demo's entry point) creates a plan and immediately runs the Stage 1 brief synthesizer on `assessments.section_analyses` — but Pre-Stage 0 (per-section analysis) is *never* triggered for demo clients, so that map is `{}`. The Haiku call gets an empty payload and emits literal `<UNKNOWN>` strings for each pattern.

**Fix:**
- In `src/server/demo-oneshot.functions.ts`, between client creation and `runDemoPlay`, call `analyzeAssessmentSection` for the 14 phased sections (`parq, risk, anthro, meds, goal, readiness, training, lifestyle, nutrition, mobility, posture, screen, history, performance`) in parallel batches of 4. Wait for `screen`, `mobility`, `posture` (the three that feed `movement_competency_summary`) before continuing — the others can settle while Stage 1 starts.
- Add a deterministic **fallback** in `synthesizeBrief`: if `section_analyses` is empty OR `screen`/`mobility`/`posture` are missing, build `movement_competency_summary` directly from the assessment row's `*_form_criteria` + `*_capacity` columns using a small server helper (`buildMovementSummaryFromAssessment`) so trainers who never trigger Pre-Stage 0 still get readable text instead of placeholders.
- Sanitize the final brief: any `movement_competency_summary[k]` value that is empty, `<UNKNOWN>`, `unknown`, or `—` is replaced with a per-pattern Portuguese sentence derived from the assessment data, e.g. *"Squat: 4/5 critérios passam, capacidade 18 reps até falha — pode carregar com cautela."*

### 2. Put a face on demo clients (avatar pictures)

**Goal:** Make `(demo)` clients feel like real people in the list view.

- Add a curated set of **20 royalty-free portrait URLs** (10 female / 10 male) in `src/lib/demo-avatars.ts` from the `randomuser.me` portrait CDN (stable, no API key, no Worker-incompatible deps). Each persona archetype gets a sex-matched pool; we pick deterministically from the persona's `archetype_label` + name index so the same name always gets the same face.
- In `createDemoClient`, after inserting the client, set `clients.photo_url` to the picked URL directly (no upload — the URLs are public and `<ClientAvatar>` already accepts external URLs).
- This avoids invoking image-gen models (cost + Worker compatibility) and keeps faces stable across sessions.

If you'd rather use AI-generated portraits later, we add a one-off seeding script that calls `google/gemini-3-pro-image-preview` and uploads to the existing `client-photos` bucket — but the curated CDN approach is the right default for instant demos.

### 3. Make the assessment actually fill the movement-competency radar

**Why it's empty today:** The radar in `MovementCompetencyRadar` reads legacy 1–5 scores (`squat_depth_score`, `hip_hinge_score`, `overhead_reach_score`, `pull_pattern_score`, `carry_pattern_score`, `single_leg_balance_score`). The demo client only writes the new v2 fields (`*_form_criteria` + `*_capacity`). So every demo radar shows dashed grey axes.

**Fix:**
- Update `MovementCompetencyRadar` to compute a 1–5 score per pattern as a **fallback** from `*_form_criteria` (% of true criteria) and `*_capacity` (normalized vs. archetype-typical bands) when the legacy `*_score` field is missing. Use `formScore()` from `src/lib/movement-criteria.ts` (already exists) for the form-criteria half.
- Also write back the derived 1–5 scores to the legacy columns inside `createDemoClient` so older readers (PDF exporter, plan prompts) get coherent values too.

### 4. Long-form demos: 8-week plans + "complete + start Block 2" loop

**Today:** The demo writes a single 4-week plan with 2 weeks seeded. You can't see a real 8-week curve, can't "finish" a block, can't watch the system propose Block 2.

**New surface in `DemoLabPanel`:**
1. A **duration selector** (4 / 6 / 8 weeks) above the Instant button.
2. A **logbook depth selector** (½ plan / full plan / full plan + 1 week of "missed"). Drives `seedDemoSessions({ planId, weeksToSeed })`.
3. A **"Concluir bloco e iniciar Bloco 2"** button visible on `/plans/$planId` for demo clients with a `ready` plan and ≥ 80% adherence. Clicking it:
   - Marks the current plan `status: "archived"` and stamps `block_number: 1` on it.
   - Calls a new `startNextBlockFromPlan({ priorPlanId })` server fn that:
     - Loads the prior plan's brief, blueprint, full logbook, KPIs, and AI-judge summary.
     - Synthesizes a **"block transition note"** (Haiku) summarizing what worked, what was the limiting pattern, RPE drift, adherence, top 3 lifts that progressed, top 3 that stalled.
     - Spawns a new plan row with `block_number: 2`, `prior_plan_id: <id>`, runs the full phased pipeline with a *seeded brief* (the transition note becomes the user message for `synthesizeBrief`), then re-seeds 2 weeks of sessions.
   - Returns the new `planId`; the UI navigates to it and the plan header now shows a **"Bloco 2 · evoluiu de Bloco 1"** chip.

**DB changes (one migration):**
- `workout_plans.block_number int default 1`
- `workout_plans.prior_plan_id uuid references workout_plans(id) on delete set null`
- `workout_plans.block_transition_summary text` (free-text written by Haiku at handoff)

### 5. Quality-of-life cleanups bundled in

- **Default to table view AND auto-expanded summary** on first plan load (already done in Phase 4 — verify, don't regress).
- **Real per-stage progress in `DemoLabPanel`:** drop the fake `setInterval(4000)` animation. Make `runDemoPlay` write each stage to a tiny `demo_runs` table (or just `workout_plans.generation_state.demo_progress`), and the panel polls every 800 ms while busy. Failed stage is now real, not guessed from `res.stage`.
- **Stop button now actually stops:** add a cancellation token row (`demo_runs.cancelled = true`) checked between stages.
- **Avatar in plan header:** show `<ClientAvatar>` next to the client's name on `/plans/$planId` (currently text-only).

---

### Technical details

**Files to touch**
- `src/server/demo-oneshot.functions.ts` — pre-stage fan-out + duration/depth args
- `src/server/demo-client.functions.ts` — write `photo_url`, write legacy movement scores
- `src/server/phased/stage1-brief.functions.ts` — fallback movement summary, sanitize `<UNKNOWN>`
- `src/server/phased/pre-stage.functions.ts` — no change; just called more
- `src/server/demo-play.functions.ts` — write demo_progress rows
- `src/server/blocks.functions.ts` (new) — `startNextBlockFromPlan`, `archivePlan`
- `src/components/DemoLabPanel.tsx` — duration / depth selectors, real polling, block-2 entry point
- `src/components/ClientAvatar.tsx` — already supports URLs; verify `loading="lazy"` + fallback
- `src/components/MesocycleTableView.tsx` — verify table-default + RPE colors stayed
- `src/routes/plans.$planId.tsx` — header avatar, "Concluir bloco" button, Block-N chip
- `src/lib/demo-avatars.ts` (new) — curated portrait pool
- `src/lib/movement-criteria.ts` — export `derivePatternScore(formCriteria, capacity, pattern)`
- `src/routes/clients_.$clientId.tsx` — radar fallback to new derive helper
- One Supabase migration for `block_number`, `prior_plan_id`, `block_transition_summary`, plus a tiny `demo_runs` table (id, plan_id, stage, status, error, cancelled, updated_at) for live progress polling.

**No external API keys needed** — Lovable AI Gateway covers Haiku for the transition note. Avatars come from `randomuser.me` (stable CDN, no auth).

**Out of scope this turn** (call them out so we don't drift): real video avatars, AI-generated portraits, multi-trainer Forge leaderboard, payments. Those are separate plans.

Reply **"continua"** to approve and I'll execute in this order: (1) avatars + movement summary fix → (2) duration/depth selectors → (3) Block-2 loop → (4) progress polling polish.