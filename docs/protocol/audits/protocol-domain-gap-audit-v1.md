# Protocol Domain Gap Audit v1

Date: 2026-05-20

Scope: audit the current `client-plan-maker` repository against the seven Protocol domain manuals now copied into `docs/protocol/manuals/`.

Manual import status:

- `docs/protocol/manuals/assessment-protocol-v1.md`
- `docs/protocol/manuals/screening-risk-rules-v1.md`
- `docs/protocol/manuals/prescription-parameters-v1.md`
- `docs/protocol/manuals/exercise-taxonomy-v1.md`
- `docs/protocol/manuals/pain-and-modification-rules-v1.md`
- `docs/protocol/manuals/program-lifecycle-v1.md`
- `docs/protocol/manuals/trainer-override-and-audit-v1.md`

All seven source manuals were readable, non-empty, and unique before copying. They were copied without rewriting, shortening, summarizing, or formatting changes. The repository filenames use the hyphenated names from the manual headings and user request.

## 1. Executive recommendation

Recommendation: staged refactor, not full rebuild yet.

Facts:

- The repo already contains useful domain foundations: deterministic ACSM-style screening in `src/server/screening/preparticipation.server.ts`, staged plan generation contracts in `src/server/phased/schemas.ts`, an exercise taxonomy seed in `src/lib/exercise-taxonomy.ts`, volume landmarks in `src/lib/volume-landmarks.ts`, plan day storage in `workout_plan_days`, set-level logging in `session_set_logs`, and an append-only `audit_events` table.
- The product surface is too coupled. `src/routes/clients_.$clientId.tsx` is roughly 6,967 lines and mixes assessment editing, plan generation, stage approvals, client profile updates, Supabase writes, and cockpit UI. `src/components/PlanEditorSurface.tsx` is roughly 1,950 lines and mixes plan rendering, editing, logging, sharing, regeneration, PDF concerns, and direct Supabase mutations.
- Long-term domain state is stored in several competing places: `assessments` columns, `assessments.extended`, `workout_plans.plan_data`, `workout_plan_days.content`, `workout_sessions.entries`, `session_set_logs`, `workout_plans.brief`, `workout_plans.blueprint`, `workout_plans.programming_variables`, `workout_plans.red_flag_accommodations`, `generation_state`, `generation_meta`, and prompt text.
- The manuals require explicit, versioned contracts for screening, assessment, prescription, pain modification, exercise identity, lifecycle states, and trainer overrides. The code has partial contracts, but they are not consistently the source of truth.

Do not rebuild from scratch now. The safer path is to preserve the working pieces, freeze high-risk feature expansion, then extract a domain layer and source-of-truth contracts in small PRs. A full rebuild would waste already-useful screening, phased generation, logging, and UI learning. Continuing without refactor would make later safety, auditability, and special-population support brittle.

## 2. Manual-by-manual gap analysis

### 2.1 Assessment protocol

Manual source: `docs/protocol/manuals/assessment-protocol-v1.md`

Current matching files, routes, tables, functions, and components:

- Route: `src/routes/clients_.$clientId.tsx`
  - Defines `SECTIONS` for self-intake and assessment-session groups.
  - Uses `PARQ_KEYS`, `PROV_SECTION_FIELDS`, `sectionSignature`, `assessmentPhase`, `buildCompletionReport`, `computeBmv`, and direct Supabase writes to `clients` and `assessments`.
  - Renders assessment concepts including PAR-Q, risk, training setup, injuries, history, goal, medications, readiness, lifestyle, nutrition, anthropometry, mobility, posture, movement screen, and performance.
- Public intake route: `src/routes/intake.$token.tsx`
  - Defines `FormState`, `EMPTY`, `fromAssessment`, and `toPayload`.
  - Captures identity, training history, equipment, injuries, medical conditions, preferences, lifestyle, PAR-Q, medications, basic measurements, mobility, posture, and capacity self-report.
- Server functions: `src/server/intake.functions.ts`
  - `generateIntakeToken`, `createInviteClient`, `markIntakeReviewed`, `createManualClient`, `loadIntake`, `saveIntake`, `linkClientAccount`.
  - `saveIntake` has an explicit public-write whitelist and field schemas.
- Helpers:
  - `src/lib/assessment-phase.ts`
  - `src/lib/assessment-completion.ts`
  - `src/lib/brief-minimum.ts`
  - `src/lib/assessment-implications.ts`
  - `src/lib/movement-criteria.ts`
  - `src/lib/blood-pressure.ts`
- Tables:
  - Initial `clients`, `assessments`, and `workout_plans` in `supabase/migrations/20260429224921_e05edf7a-ad5c-456b-8997-2f04bc6a5601.sql`.
  - Later assessment expansions across migrations, including measurement, ACSM, capacity, injury, and screening-related fields.
  - `client_measurements`, `client_measurement_prefs`, `capacity_domains`, `client_capacity_snapshots`, `assessment_unmatched_aspirations`, `assessment_injuries` references.

Partial matches:

- Assessment phases exist as helper logic in `src/lib/assessment-phase.ts`, but there is no explicit versioned assessment protocol contract stored with an assessment.
- Completion and BMV logic exist, but the source of truth is split between helper functions, route state, translations, and JSON fields.
- The public intake write path is safer than many other paths because `saveIntake` validates allowed fields. Trainer-side assessment edits in `src/routes/clients_.$clientId.tsx` still perform direct client-side Supabase writes.
- `assessments.extended` is used for provenance and flexible intake fields, but it also holds domain-driving answers such as `parq`, lifestyle details, mobility values, scheduling values, and AI goal interpretation.

Missing concepts from the manual:

- First-class `assessment_protocol_version`.
- First-class `assessment_instance` or equivalent lifecycle record with status, started/submitted/reviewed/approved timestamps, missing-data status, and reviewer.
- Explicit consent/scope record tied to the assessment.
- Explicit missing-data confidence model.
- Branch keys for adult general, pregnant/postpartum, older adult, medical flags, pain/injury, no-equipment assessment, and full-equipment assessment.
- First-class "assessment finding" objects that can drive prescription decisions without re-parsing free text and JSON.

Conflicting implementation:

- The manual says assessment exists to change decisions and should reduce confidence when important data is missing. The code computes completion and BMV, but missing data is not consistently persisted as a decision artifact.
- The manual distinguishes self-intake from trainer assessment. The UI has that distinction, but the database mostly collapses both into one mutable `assessments` row.
- Trainer edits and client-submitted fields share the same table. `saveIntake` has `extended.provenance` and `field_provenance`, but there is no immutable history of the assessment itself.

Dangerous technical debt:

- More assessment fields should not be added directly into `src/routes/clients_.$clientId.tsx`.
- More branch logic should not be buried in `toPayload`, `fromAssessment`, i18n strings, or UI conditionals.
- Do not add special populations until branch contracts exist.

What should not be touched yet:

- Do not rewrite the full assessment UI.
- Do not migrate all assessment data immediately.
- Freeze new assessment fields unless they are represented in a manual-backed contract.

### 2.2 Screening and risk rules

Manual source: `docs/protocol/manuals/screening-risk-rules-v1.md`

Current matching files, routes, tables, functions, and components:

- `src/server/screening/preparticipation.server.ts`
  - Exports `ENGINE_VERSION = "parq-plus-acsm@2023.1.0"`.
  - Exports `SIGN_KEYS`, `classifyCvdRiskFactors`, `cardiacRehabBpExclusion`, and `runPreparticipationAlgorithm`.
  - Models nine signs/symptoms, known disease detection, CVD risk factors, exerciser status, desired intensity, and BP >= 180/110 gate.
- Migration `supabase/migrations/20260513142006_e61c8002-02e8-4b82-b2eb-347b89504e89.sql`
  - Creates `screening_evaluations` with `protocol`, `protocol_version`, `answers`, `risk_band`, `intensity_ceiling`, `clearance_required`, `clearance_reason`, `structured_reasons`, `raw_detail`, `evaluator_id`, `created_at`.
  - Creates `audit_events` for domain audit logging.
- `src/domain/ports/README.md`
  - Names `ScreeningEvaluator` as a current port concept.
- `src/domain/ports/index.ts`
  - Contains screening-related port types.
- `src/lib/blood-pressure.ts`
  - Categorizes BP separately from the screening engine.
- Assessment/intake routes collect PAR-Q, medications, medical conditions, BP-related fields, and risk-related data.

Partial matches:

- The screening engine is deterministic and versioned in code.
- The `screening_evaluations` table is a good start for auditability.
- Screening inputs still appear to be sourced from a mutable `assessments` row and nested `extended` JSON, not from a versioned screening questionnaire contract.
- The UI and i18n contain risk wording and PAR-Q concepts outside the engine.

Missing concepts from the manual:

- Explicit baseline-screening context versus pre-session readiness context versus exercise-stop context.
- Explicit "missing BP lowers confidence" result in the persisted screening evaluation.
- Explicit pregnancy/postpartum branch handling. The manual says this should be a caution branch if not safely covered.
- Structured referral trigger taxonomy beyond the ACSM engine output.
- Audit event coverage for every screening decision and every trainer override of a screening warning.
- Delete immutability for `screening_evaluations`. The migration blocks updates, but no `BEFORE DELETE` trigger for `screening_evaluations` was found.

Conflicting implementation:

- `src/server/intake.functions.ts` still allows public clients to write `acsm_risk_category` directly. A client-submitted risk category should not be treated as an authoritative screening result.
- `assessments.parq_passed` and `assessments.extended.parq` coexist with `screening_evaluations`; this creates source-of-truth ambiguity.
- Known disease detection scans free text in `medical_conditions`. That is useful as a fallback but should not be the primary safety contract.

Dangerous technical debt:

- Prompt-based or UI-based screening labels should not be allowed to override deterministic screening without an audited trainer decision.
- More medical flags should not be added as ungoverned strings in `med_flags`.
- Do not rely on `acsm_risk_category` from intake as an engine result.

What should not be touched yet:

- Do not expand ACSM/PAR-Q into special populations until baseline adult screening is persisted as a versioned evaluation.
- Do not add clinical-test workflows such as ECG, lab values, gas exchange, or lactate.

### 2.3 Prescription parameters

Manual source: `docs/protocol/manuals/prescription-parameters-v1.md`

Current matching files, routes, tables, functions, and components:

- `src/server/phased/schemas.ts`
  - `BriefSchema`: goal, secondary goals, red flags, movement competency, training age, sessions per week, mesocycle length, equipment constraints, capacity profile, modality targets.
  - `ProgrammingVariablesSchema`: split, deload frequency/style, RPE ceiling, exercise bias, intensity-volume tradeoff, wave model, autoreg strictness, cockpit preset.
  - `BlueprintSchema`: mesocycle length, sessions per week, session archetypes, week-to-session map, progression model.
  - `ProgressionPlanSchema`: exercise id, progression dimension, week deltas, rationale.
  - `PhasedDaySchema`: day content and exercise prescription shape.
  - `GenerationStateSchema`: stage and approved stages.
- `src/server/phased/programming-defaults.ts`
  - Derives starting floor, default programming variables, accommodations, cockpit values, wave plan, deload logic.
- `src/server/phased/programming-tier.server.ts`
  - Classifies programming tier, clearance flags, RPE floors, tier guidelines, prompt blocks.
- `src/lib/auto-infer.ts`
  - Infers tier, cockpit preset, split, wave model, deload frequency.
- `src/lib/volume-landmarks.ts`, `src/lib/volume-compute.ts`, `src/lib/volume-actual.ts`, `src/lib/prescribe-volume.ts`
  - MEV/MAV/MRV-like landmarks and volume display/prompt logic.
- Components:
  - `src/components/BriefEditor.tsx`
  - `src/components/BlueprintEditorPanel.tsx`
  - `src/components/MicrocyclePanel.tsx`
  - `src/components/ProgressionsPanel.tsx`
  - `src/components/plan/IntensityCockpit.tsx`
  - `src/components/volume/VolumeSection.tsx`
  - `src/components/PlanEditorSurface.tsx`
- Tables/columns:
  - `workout_plans.brief`, `blueprint`, `programming_variables`, `red_flag_accommodations`, `progression_plan`, `generation_state`, `generation_meta`, `plan_data`.
  - `workout_plan_days.content`.

Partial matches:

- The staged generator roughly matches a future prescription pipeline: assessment -> brief -> blueprint -> microcycle -> progressions -> filled block.
- Some trainer-control variables are already explicit.
- MEV/MAV/MRV-like volume concepts exist, but mainly as TS constants and UI computation rather than persisted prescription decisions.
- Pain and risk constraints are represented as strings and red-flag accommodations, not as structured constraints with rule versions.

Missing concepts from the manual:

- First-class `prescription_parameters` contract with version, owner, source, and approval timestamp.
- Persisted parameter snapshots per block/session, not only current plan JSON.
- Explicit trainer override records for each changed parameter.
- Deterministic rule outputs for why a starting dose, intensity ceiling, deload cadence, or exercise constraint was chosen.
- Structured distinction between AI suggestion, deterministic rule, trainer-edited parameter, approved prescription, and logged performance.
- Regression/progression guardrails connected to pain, adherence, readiness, and screening.

Conflicting implementation:

- Some prescription logic lives in structured Zod schemas, some in deterministic helpers, some in prompt blocks, some in UI knobs, and some in JSON.
- `workout_plans.plan_data` is still written by `PlanEditorSurface` and legacy flows, while comments say phased plans use `workout_plan_days` as source of truth.
- Direct client-side updates to `workout_plans.programming_variables` in `src/components/PlanEditorSurface.tsx` bypass a central audit/approval path.

Dangerous technical debt:

- Do not expand AI prompts with more prescription rules before writing the parameter contract.
- Do not add more cockpit knobs unless they are persisted, versioned, and auditable.
- Do not treat generated day content as the prescription source of truth if trainer edits can silently rewrite it.

What should not be touched yet:

- Do not add MEV/MAV/MRV sophistication until the current volume landmarks and generated prescriptions are tied to versioned parameter snapshots.
- Do not add special-population prescription branches yet.

### 2.4 Exercise taxonomy

Manual source: `docs/protocol/manuals/exercise-taxonomy-v1.md`

Current matching files, routes, tables, functions, and components:

- `src/lib/exercise-taxonomy.ts`
  - `EXERCISE_TAXONOMY_VERSION = 1`.
  - Defines umbrella categories, movement patterns, equipment keys, levels, caution flags, media quality statuses.
  - Seeds 30 canonical exercises with keys, PT/EN names, aliases, movement pattern, equipment, level, muscles, caution flags, and media quality default.
- `src/lib/equipment-catalog.ts`
  - Shared equipment vocabulary.
- `src/server/phased/exercise-filters.server.ts`
  - Filters exercises for generation.
- `src/server/phased/microcycle-edit.functions.ts`
  - Patches, deletes, approves, unapproves, and inserts exercises inside `workout_plan_days.content.exercises`.
- `src/server/sessions.functions.ts`
  - `slugifyExercise` creates slugs from free-text names for set log joins.
  - Mirrors finalized client logs into `session_set_logs`.
- `src/server/adaptation/propose-next-block.server.ts`
  - Provides `inferPattern` used by set log mirroring.
- `src/components/AddExerciseDialog.tsx`, `src/components/DayCardEditable.tsx`, `src/components/MovementPatternCard.tsx`.
- Tables:
  - No durable `exercise_templates` table found.
  - `session_set_logs` has `exercise_slug`, `exercise_name`, and `movement_pattern`.
  - `workout_plan_days.content.exercises` stores exercise objects in JSON.

Partial matches:

- Exercise taxonomy is a useful TS foundation.
- Session logs have a partial normalized mirror in `session_set_logs`.
- Exercise prescriptions and logged performance are partially separated by `workout_plan_days` versus `workout_sessions`/`session_set_logs`.

Missing concepts from the manual:

- First-class `exercise_templates`.
- First-class `exercise_prescriptions`.
- First-class `logged_exercise_performance` separate from raw log JSON.
- Template versioning, alias management, substitutions, regressions, progressions, contraindication tags, pain-modification tags, range-of-motion options, tempo options, and media fields in durable storage.
- Explicit unknown-exercise policy and trainer approval flow.
- Durable link from a prescribed exercise to a canonical exercise template.

Conflicting implementation:

- Generated exercises in `PhasedDaySchema` use `name` as the required identity field.
- `session_set_logs.exercise_slug` is derived by slugifying free text, not by joining to `EXERCISE_KEYS`.
- Manual edits operate inside `workout_plan_days.content.exercises` JSON.

Dangerous technical debt:

- More features should not be built on raw free-text exercise names.
- Do not add substitutions, contraindications, or exercise media as scattered JSON fields in plan-day content.
- Do not depend on slugified names for long-term analytics.

What should not be touched yet:

- Do not migrate all existing plan-day exercises immediately.
- Do not build a large exercise library UI until the identity and template/prescription/log distinction is settled.

### 2.5 Pain and modification rules

Manual source: `docs/protocol/manuals/pain-and-modification-rules-v1.md`

Current matching files, routes, tables, functions, and components:

- Assessment UI:
  - `src/routes/clients_.$clientId.tsx` sections for injuries, limitations, pain notes, movement screen.
  - `src/components/InjuryEditor.tsx`
  - `src/components/InjuriesBodyMapBlock.tsx`
  - `src/components/intake/InjuriesSlide.tsx`
- Server/functions:
  - `src/server/injuries.functions.ts`
  - `src/server/phased/programming-defaults.ts` has `defaultStrategyForFlag`, `defaultAccommodations`, `reconcileAccommodations`.
  - `src/server/phased/stage3-microcycle.functions.ts` fetches injury bans for a plan and writes generated day rows.
  - `src/server/sessions.functions.ts` mirrors set logs with a `pain_flag`.
- Tables:
  - `assessment_injuries` is referenced by application code.
  - `workout_plans.red_flag_accommodations`.
  - `session_set_logs.pain_flag`.

Partial matches:

- The app captures injury/pain history and can feed red flags into plan generation.
- Red flag accommodations have strategies: `AVOID`, `MODIFY`, `MONITOR`, `ACCOMMODATE`.
- There is a per-set `pain_flag`, but it is inferred from `felt === "hard"` and high RPE in `src/server/sessions.functions.ts`.

Missing concepts from the manual:

- First-class pain event with location, severity, irritability, behavior, aggravating/easing factors, onset, current/historical status, and trainer action.
- Distinction between normal training discomfort, pain during movement, persistent pain, new unexplained pain, red flags, injury history, and return-to-training state.
- Structured stop/modify/regress/refer decisions.
- Trainer approval gate for pain-related modifications.
- Pain communication language constraints in a governed layer.
- Immutable history of pain modifications and outcomes.

Conflicting implementation:

- `session_set_logs.pain_flag` is too weak and potentially misleading. Hard effort or RPE 9.5 is not the same as pain.
- Pain rules are not a deterministic engine. They are spread across free text, injury records, prompt context, and red-flag strings.
- The app can generate or modify plans without a clearly persisted pain modification rationale.

Dangerous technical debt:

- Do not add pain-aware automation until pain events and modification decisions are explicit.
- Do not let AI infer pain clearance or referral decisions.
- Do not expand exercise contraindication behavior until exercise taxonomy supports structured caution tags.

What should not be touched yet:

- Do not implement special-population pain branches.
- Do not add medical language or diagnosis flows.

### 2.6 Program lifecycle

Manual source: `docs/protocol/manuals/program-lifecycle-v1.md`

Current matching files, routes, tables, functions, and components:

- Client lifecycle:
  - `src/lib/client-phase.ts`
  - `src/hooks/use-client-phases.ts`
  - `src/components/ClientPhasePill.tsx`
  - `clients.intake_status` and related intake token fields.
- Assessment lifecycle:
  - `src/lib/assessment-phase.ts`
  - `src/lib/assessment-completion.ts`
  - `src/components/assessment/MissingItemsPanel.tsx`
  - `src/components/ReassessmentSheet.tsx`
  - `src/components/ReassessmentReminders.tsx`
- Training block lifecycle:
  - `src/server/phased/stage1-brief.functions.ts`
  - `src/server/phased/stage2-blueprint.functions.ts`
  - `src/server/phased/stage3-microcycle.functions.ts`
  - `src/server/phased/stage4-progressions.functions.ts`
  - `src/server/phased/stage5-bulkfill.functions.ts`
  - `src/server/blocks.functions.ts`
  - `src/server/blocks-manual.functions.ts`
  - `src/server/adaptation/propose-next-block.functions.ts`
  - `adaptation_proposals`, `adaptation_decisions`, `progress_markers`.
- Session lifecycle:
  - `src/routes/log.$token.tsx`
  - `src/server/sessions.functions.ts`
  - `workout_sessions`
  - `session_set_logs`
  - `client_checkins`
- Plan/versioning:
  - `workout_plans.generation_state`, `generation_status`, `generation_meta`, `completion_state`, `plan_data_version`, `block_number`, `status`.

Partial matches:

- There are meaningful lifecycle concepts throughout the code.
- Staged generation has approval markers in `generation_state.approved_stages`.
- Day-level approval exists through `workout_plan_days.approved_at`.
- Adaptation proposals and decisions are closer to the manual than most domains.

Missing concepts from the manual:

- One explicit lifecycle state machine per client, assessment, block, and session.
- Durable transition records for lifecycle changes.
- Clear separation between assessment lifecycle and plan lifecycle.
- Explicit "block ended because..." records and "next block started because..." records.
- Session stop/escalation states for safety events.
- Versioned historical snapshots for each lifecycle state.

Conflicting implementation:

- Lifecycle state is inferred from many fields: `clients.intake_status`, `assessmentPhase`, `generation_state.stage`, `approved_stages`, `generation_status`, `workout_plan_days.approved_at`, `workout_plans.status`, `workout_sessions.status`, and route-level booleans.
- The same route can mutate assessment, plan, client, and generation lifecycle directly.
- `PlanEditorSurface` comments state `workout_plan_days` is the real source of truth for phased plans and `plan_data` is legacy/cache/PDF content. Other routes such as `src/routes/log.$token.tsx` and `src/server/sessions.functions.ts` still validate or read client log structure from `plan_data`.

Dangerous technical debt:

- Do not add more lifecycle states as ad hoc text columns.
- Do not add more "approve" UI states unless they produce durable, auditable transition records.
- Do not continue building block/session logic on both `plan_data` and `workout_plan_days` without a compatibility adapter.

What should not be touched yet:

- Do not redesign the whole route tree.
- Do not migrate all plans before writing the source-of-truth adapter and tests.

### 2.7 Trainer override and audit

Manual source: `docs/protocol/manuals/trainer-override-and-audit-v1.md`

Current matching files, routes, tables, functions, and components:

- `supabase/migrations/20260513142006_e61c8002-02e8-4b82-b2eb-347b89504e89.sql`
  - `audit_events` table with `event_type`, `entity_type`, `entity_id`, `payload`, `engine_versions`, `upstream_hash`, `created_at`.
  - Update and delete triggers make `audit_events` append-only.
- `src/server/audit/log-event.server.ts`
  - Central helper for audit events.
  - Supports event types including `plan_generated`, `plan_approved`, `screening_completed`, `session_logged`, `block_advanced`, `engine_overridden`, `risk_band_changed`, `next_block_proposed`.
- `src/domain/ports/README.md`
  - States engine versions should travel with outputs and land in `audit_events.engine_versions` and `generation_log.engine_versions`.
- `generation_log` table exists in `supabase/migrations/20260501140323_3fea6c43-c78d-4460-8a43-da7bee0d61ea.sql`.
- `src/server/phased/ai.server.ts` writes to `generation_log`.
- `adaptation_decisions` is append-only in `supabase/migrations/20260514091920_3fc29258-bc7b-46e0-9285-f07d778f9063.sql`.

Partial matches:

- The audit table design is good.
- Some adaptation decisions are immutable and include rationale.
- Generation logs exist, but audit coverage is not universal.

Missing concepts from the manual:

- Structured override entity for trainer parameter changes.
- Required rationale for overrides that change safety, risk, pain, exercise substitution, progression, deload, or session completion.
- Accepted/rejected AI suggestion records.
- Explicit audit records for missing-data warnings, prescription parameter changes, exercise substitutions, pain-related modifications, reassessments, referrals/clearance status, client feedback, and block failure/rebuild decisions.
- Audit UI or export path.
- Strong link between approval gates and audit events.

Conflicting implementation:

- `logAuditEvent` says all domain-level events must flow through it, but many mutations do not. Examples:
  - `src/routes/clients_.$clientId.tsx` directly updates/inserts `assessments` and `clients`.
  - `src/components/PlanEditorSurface.tsx` directly updates/deletes `workout_plans`, `workout_sessions`, and `programming_variables`.
  - `src/server/phased/microcycle-edit.functions.ts` updates `workout_plan_days.content` and `approved_at` without an obvious audit event.
- `logAuditEvent` intentionally swallows errors. That may be acceptable operationally, but the product should surface audit coverage gaps in tests or telemetry.
- `screening_evaluations` blocks updates but not deletes, based on migrations found.

Dangerous technical debt:

- Do not claim auditability until high-risk mutations are routed through audited server functions.
- Do not add trainer override features as UI-only changes.
- Do not let AI regenerate approved material silently.

What should not be touched yet:

- Do not build a large audit dashboard until audit event coverage exists.
- Do not force audit on every tiny UI interaction; start with safety, screening, prescription, approval, substitution, pain modification, and block/session transitions.

## 3. Current domain objects found in the repo

Database-backed objects found:

- `profiles`
- `clients`
- `assessments`
- `workout_plans`
- `workout_plan_days`
- `workout_sessions`
- `session_set_logs`
- `screening_evaluations`
- `audit_events`
- `generation_log`
- `plan_templates`
- `plan_feedback`
- `client_measurements`
- `client_measurement_prefs`
- `capacity_domains`
- `client_capacity_snapshots`
- `client_measurement_cadence`
- `client_checkins`
- `client_packs`
- `client_bookings`
- `pack_members`
- `adaptation_proposals`
- `adaptation_decisions`
- `progress_markers`
- `daily_activity_log`
- `assessment_unmatched_aspirations`
- `assessment_injuries` references in code
- `client-documents` table/storage references
- `subscribers`
- ACSM knowledge tables: `acsm_chapters`, `acsm_sections`, `acsm_recommendations`, `acsm_contraindications`, `acsm_normatives`, `acsm_populations`, `acsm_thresholds`

Code/domain objects found:

- `BriefSchema`, `ProgrammingVariablesSchema`, `BlueprintSchema`, `ProgressionPlanSchema`, `PhasedDaySchema`, `GenerationStateSchema`, `DOWNSTREAM_OF` in `src/server/phased/schemas.ts`.
- `runPreparticipationAlgorithm`, `classifyCvdRiskFactors`, `cardiacRehabBpExclusion` in `src/server/screening/preparticipation.server.ts`.
- `EXERCISE_TAXONOMY_VERSION`, `EXERCISES`, `EXERCISE_KEYS`, movement/equipment/caution/media enums in `src/lib/exercise-taxonomy.ts`.
- `EQUIPMENT_CATALOG` in `src/lib/equipment-catalog.ts`.
- Volume landmarks and volume computation in `src/lib/volume-landmarks.ts`, `src/lib/volume-compute.ts`, `src/lib/volume-actual.ts`.
- Assessment phase/completion in `src/lib/assessment-phase.ts` and `src/lib/assessment-completion.ts`.
- Client phase in `src/lib/client-phase.ts`.
- Plan status and lineage helpers in `src/lib/plan-status.ts` and `src/lib/plan-lineage.ts`.
- Session summary in `src/lib/session-summary.ts`.
- Block feedback/adaptation in `src/lib/block-feedback.ts` and `src/lib/block-adaptation.ts`.
- Engine port intent in `src/domain/ports/README.md` and `src/domain/ports/index.ts`.

## 4. Missing domain objects

Highest-priority missing objects:

- `assessment_protocol_version`
- `assessment_instance`
- `assessment_section_response`
- `assessment_finding`
- `consent_record`
- `missing_data_warning`
- `screening_protocol`
- `screening_questionnaire_response`
- `screening_decision`
- `risk_flag`
- `clearance_status`
- `prescription_parameter_snapshot`
- `prescription_rule_result`
- `trainer_override`
- `ai_suggestion`
- `ai_suggestion_decision`
- `exercise_template`
- `exercise_template_version`
- `exercise_substitution_rule`
- `exercise_prescription`
- `logged_exercise_performance`
- `pain_event`
- `pain_modification_decision`
- `lifecycle_transition`
- `block_completion_decision`
- `session_safety_event`
- `client_feedback_event`

These do not all need tables immediately. Some can start as versioned contracts and read-only adapters. They should not remain hidden in prompts, JSON blobs, or UI state.

## 5. Source-of-truth conflicts

### Plan structure

Facts:

- `workout_plans.plan_data` was the original plan JSON source.
- `workout_plan_days.content` is now treated by comments in `src/components/PlanEditorSurface.tsx` as the real source of truth for phased plans.
- Client log routes and server validation still read `plan_data.weeks` in places, including `src/routes/log.$token.tsx` and `src/server/sessions.functions.ts`.

Recommendation:

- Define a single read model that can produce "current plan structure" from either phased rows or legacy `plan_data`.
- Treat `plan_data` as legacy/cache/PDF export for phased plans until a migration is planned.

### Assessment answers

Facts:

- Assessment data lives in typed columns, `assessments.extended`, intake local state, client profile fields, injury records, capacity snapshots, and measurements.
- `saveIntake` writes provenance into `extended`.
- Trainer UI writes direct Supabase updates.

Recommendation:

- Define a versioned assessment snapshot contract before adding fields.
- Keep `extended` for raw/flexible intake payloads and provenance, but do not let it be the only source for safety or prescription-driving fields.

### Screening result

Facts:

- `assessments.parq_passed`, `assessments.extended.parq`, `assessments.acsm_risk_category`, deterministic engine output, and `screening_evaluations` can all describe risk.

Recommendation:

- `screening_evaluations` should become the source of truth for screening decisions.
- `assessments` may hold raw responses and convenience fields, but not authoritative clearance state.

### Exercise identity

Facts:

- `src/lib/exercise-taxonomy.ts` has canonical keys.
- Plan exercises still require free-text `name`.
- Logs derive slugs from free-text names in `src/server/sessions.functions.ts`.

Recommendation:

- Preserve display names, but add canonical identity resolution before building substitutions, analytics, or contraindications.

### Audit and approval

Facts:

- `audit_events` exists and is append-only.
- Approval state also lives in `generation_state.approved_stages` and `workout_plan_days.approved_at`.
- Many high-risk mutations do not call `logAuditEvent`.

Recommendation:

- Approval gates should write explicit audit events and be test-covered.

## 6. Highest-risk architectural issues

1. Oversized route and editor files are now domain owners.
   - `src/routes/clients_.$clientId.tsx` and `src/components/PlanEditorSurface.tsx` contain too much domain behavior for safe expansion.

2. Domain logic is scattered across prompts, Zod schemas, helpers, JSON columns, i18n copy, and UI state.
   - This makes rules hard to test, version, audit, or explain.

3. Plan source of truth is split.
   - Phased plans use `workout_plan_days`, but legacy/public/session flows still read `plan_data`.

4. Exercise identity is not durable.
   - `EXERCISE_KEYS` exist, but prescriptions and logs still rely on names/slugs.

5. Screening authority is ambiguous.
   - The deterministic engine is good, but `acsm_risk_category` and PAR-Q fields can exist outside persisted screening evaluations.

6. Audit coverage is incomplete.
   - `audit_events` is structurally strong, but mutation paths bypass it.

7. Pain logic is under-modeled.
   - `pain_flag` inferred from hard effort is not a pain rule.

8. Lifecycle boundaries are mixed.
   - Client lifecycle, assessment lifecycle, generation lifecycle, block lifecycle, and session lifecycle are inferred from different fields and UI state.

9. Client-side mutations are too broad.
   - Sensitive updates to client, assessment, plan, plan days, sessions, and programming variables occur directly from UI files in multiple places.

10. A secret-like environment file exists in the repository working tree.
   - `.env` is present with Supabase configuration. No values are printed here and no env file was modified. This should be reviewed separately before public sharing.

## 7. What not to implement yet

Do not implement yet:

- Special populations such as pregnancy/postpartum, older adult, neurological, cardiac rehab, or complex medical branches.
- More AI prompt expansion for screening, pain, prescription, or substitutions.
- A large exercise library UI.
- Exercise media workflows.
- Billing/subscriptions expansion.
- A full app rebuild.
- A full database migration of plan/exercise/session data.
- More cockpit knobs.
- Automated medical clearance/referral logic beyond deterministic warnings and trainer approval gates.
- More direct client-side mutations for sensitive domain state.

Freeze until contracts exist:

- Assessment branching.
- Screening source of truth.
- Pain modification rules.
- Exercise identity and substitutions.
- Trainer override audit events.
- Plan source-of-truth adapter.

## 8. First 3 recommended implementation PRs

These are intentionally small, reversible, testable, and useful even if product direction changes.

### PR 1: Protocol source-of-truth adapters and contract tests

Goal:

- Add read-only domain adapters that produce normalized snapshots from current storage without changing schema or UI.

Scope:

- Assessment snapshot adapter from `clients`, `assessments`, `assessments.extended`, measurements, injuries, and capacity.
- Plan snapshot adapter from `workout_plan_days` first, legacy `plan_data` second.
- Screening input snapshot adapter from assessment data.

Tests:

- Unit tests for adapter output shape.
- Fixtures for legacy `plan_data` and phased `workout_plan_days`.

Why first:

- It reduces source-of-truth ambiguity without changing existing behavior.

### PR 2: Exercise identity resolution around existing taxonomy

Goal:

- Use `src/lib/exercise-taxonomy.ts` as a read-only resolver for existing free-text exercise names.

Scope:

- Add tested resolver functions: display name -> canonical key, canonical key -> template metadata, unknown fallback.
- Do not migrate database rows.
- Do not change generation prompts.
- Do not change UI except optional non-user-visible metadata in adapters.

Tests:

- Alias matching.
- Unknown exercise behavior.
- Slug compatibility with current `session_set_logs.exercise_slug`.

Why second:

- It prepares substitutions, analytics, pain constraints, and media without forcing a data migration.

### PR 3: Audit coverage map plus one high-risk mutation wrapper

Goal:

- Make audit expectations explicit and prove the pattern on one narrow path.

Scope:

- Add an audit coverage matrix for required events from `trainer-override-and-audit-v1`.
- Pick one mutation family only, preferably staged approval (`approveBrief`, `approveBlueprint`, `approveMicrocycle`, `approveProgressions`) or exercise edit in `microcycle-edit.functions.ts`.
- Add audit event writes for that one path with tests/mocks.
- Do not build an audit UI.

Tests:

- Server-function test/mocked Supabase verifying event payload shape, `engine_versions`, entity IDs, and actor IDs.

Why third:

- It turns the existing `audit_events` table into a real product guarantee without boiling the ocean.

## 9. Open questions that materially affect architecture

1. Is Protocol primarily trainer-led, client-self-serve, or hybrid?
   - This changes approval gates, public token flows, and how much client-side logging can mutate prescription state.

2. Should `screening_evaluations` become the legal/domain source of truth for clearance and risk, with `assessments` only storing raw responses?
   - I recommend yes, but this decision affects migrations and UI copy.

3. Do you want exercise templates to be globally managed, trainer-customizable, or both?
   - This changes whether `exercise_templates` need ownership/versioning from day one.

4. Should plan approval happen at stage level, day level, full block level, or all three?
   - Current code supports stage and day concepts, but the audit contract needs a single authority model.

5. Are clients allowed to edit logged sessions after submission?
   - This determines whether logs are mutable, corrected via revision events, or append-only with supersession.

6. What is the MVP liability posture?
   - If the app gives screening/pain suggestions, audit and scope-of-practice language must be tighter before launch.

7. Are special populations in the first paid MVP?
   - The current architecture should not add them yet. If they are required for MVP, screening and assessment branching must move earlier in the roadmap.
