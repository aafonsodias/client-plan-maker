# Plan — Protocol full-spec handoff document

## Goal

Produce one self-contained markdown file another AI can read cold and understand Protocol to the T: what it is, who it serves, the engine, the data shape, the rules, the non-negotiables, what's shipped vs deferred. No app changes — pure artifact.

## Deliverable

`/mnt/documents/protocol-spec-for-ai.md` (single file, ~3–6k words), surfaced via `<presentation-artifact>`.

## Document outline

1. **Identity**
   - One-line pitch (PT + EN), audience (PT trainers, beta), tone, decision order (looks → function → ease).
2. **Product surface**
   - 5-stage inline journey on `/clients/$id`: Intake → Brief → Blueprint → Microcycle → Progressions → PDF.
   - Dashboard (coach cockpit), Schedule, Billing, Knowledge, Manual, Auth, Demo Lab, Concierge / AskForge dock.
3. **Engine architecture**
   - Phased pipeline (`src/server/phased/*`): Stage 1 brief → Stage 2 blueprint → Stage 3 microcycle (AI, Week 1 only) → Stage 4 progressions (deterministic Bompa wave + NSCA increments) → Stage 5 bulkfill.
   - `programNextWeek` log-driven adaptation with `autoreg_strictness`.
   - `archivePlanAndStartNextBlock` block lineage + rotation rule + load multiplier.
   - Intensity Cockpit (5 knobs + 6 presets) as single intensity surface.
   - AI rule: AI never generates more than 1 microcycle.
4. **Data model (high level)**
   - `workout_plans` (block_number, prior_plan_id, programming_variables, generation_meta, prescription_parameters, assessment_completion_pct).
   - `workout_plan_days` (approved_at gate).
   - `workout_sessions` (client_feedback, pr_celebrated_at).
   - `clients` (is_demo, photo_url, intake fields).
   - `profiles` (plan_quota_used/limit, demo_seeded_at).
   - `subscribers` + `has_active_access()` + `can_create_more_plans()`.
   - `plan_feedback`, `generation_log`, assessments.extended.photos.
   - Storage buckets: private `client-photos`.
5. **Exercise + session taxonomy (R74)**
   - `src/lib/exercise-taxonomy.ts`: `EXERCISE_TAXONOMY_VERSION`, `ExerciseKey`, `MediaQualityStatus`, `exerciseIdentityKey()`, 30 seeded canonical exercises with PT/EN aliases, umbrellas, movement patterns, equipment, caution flags.
   - `src/lib/session-taxonomy.ts`: 17 `SESSION_BLOCK_TYPES`.
   - Slice ladder (1 shipped, 2 next, 3–7 later, parked).
6. **Exercise media architecture (R75, docs only)**
   - Raw → Master → Streaming → App metadata keyed by `ExerciseKey`.
   - Provider-agnostic (Bunny / Cloudflare Stream / Mux candidates); YouTube only as `youtube_reference`.
   - Founder demo honesty model; AI / avatar = visual layer, never source of truth.
   - 9-phase rollout, current = file discipline + docs.
7. **Knowledge base sources**
   - ACSM 12e (FITT-VP, screening, special populations), Bompa & Buzzichelli 6e (periodization), NSCA 3e (exercise selection / cues), McGill (parked LBP overlay).
   - Cross-source policy (Modelo B, source-agnostic tables with discriminator).
8. **i18n + locales**
   - Source EN, PT-PT humanly written, ES + HI LLM-translated for plan + common only, fallback EN.
   - PT voice = "você"; never mix with "tu".
9. **Pricing + quota**
   - EUR source-of-truth, USD/BTC display-only.
   - Free = 1 finalized plan/account; Starter 8/8, Pro 25/30, Studio 60/80 (clients cap == plan-gen cap).
   - Server-side gate via `checkPlanQuota()`.
10. **Brand + design system**
    - `<BrandMark/>` amber under-glow ring, FORGE hammer-on-cube logo (3 amber sparks), founder Sparkles badge.
    - Status palette (success/emerald, neutral/muted, warn/amber, danger/red); semantic tokens in `src/styles.css` (oklch).
    - Typography & shadcn patterns; never hardcode colors.
11. **Positioning rules**
    - Non-adversarial: no "vs Excel/ChatGPT/Trainerize/RP". Pitch = "avaliação clínica → protocolo defensável → adaptação semanal."
    - No fake social proof; evidence-source ethics (full citation, n=, effect size, COI flag).
12. **Demo system**
    - Seed: 1-year for Maria (Block 13 real AI, Blocks 1–12 SQL clones with mutations).
    - Demo bots: persona-aware feedback ~1/3 sessions.
    - DemoRunsContext as single source of truth for long-running jobs.
    - Founder Demo Lab limitations (what it does NOT prove).
13. **Safety + RLS**
    - Roles in separate `user_roles` table + `has_role()` SECURITY DEFINER.
    - Edge functions check secrets; never store roles on profiles.
    - Backend = "Lovable Cloud" externally; never expose Supabase URLs.
14. **Process non-negotiables**
    - 1 concern per round, backups before prod SQL, 375px Mobile Safari smoke, all copy via i18n, every AI call writes `generation_log`.
    - Phase isolation (don't touch unfreeze without notice).
    - Living backlog at `.lovable/backlog.md`.
15. **What is NOT built (honest deferral)**
    - Exercise media schema/upload/player, Slice 2 identity wiring (next), structured session blocks in AI output, exercises table, trainer overrides, suggestion queue, McGill overlay, Westside conjugate, calendar sync, Stripe pack billing, multi-modality, schedule v2.
16. **Glossary** of project-specific terms (Brief, Blueprint, Microcycle, Progressions, Block, Cockpit, FITT-VP, e1RM, MEV/MAV/MRV, Wave, Deload, Intake, Concierge/AskForge).
17. **Appendix: file map** — key code paths the receiving AI will likely need (router, server functions, libs, components, i18n).

## Method

- Sources: `mem/index.md` + every file referenced under Memories, `.lovable/backlog.md`, `.lovable/r70`–`r75` notes, `src/lib/exercise-taxonomy.ts`, `src/lib/session-taxonomy.ts`, `src/server/phased/*` headers, route list, `src/styles.css`, `src/i18n/index.ts`.
- Compile into a single document; quote rules verbatim where precise wording matters (decision order, non-negotiables, AI generation rule, intensity cockpit, founder demo honesty model).
- No code changes, no schema, no migrations, no UI. Read-only synthesis.

## Open question (optional)

Tone of the brief: terse engineering handoff (default) vs longer narrative onboarding for an AI that knows nothing about training. Default = terse engineering with short prose intros per section. Tell me to switch if you'd rather narrative.

## Out of scope

- Translating the brief into PT/ES/HI (English only).
- Any code edit.
- Updating `mem://` (this is an outbound artifact, not project memory).
