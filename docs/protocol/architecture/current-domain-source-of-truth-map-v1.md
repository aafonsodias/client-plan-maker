# Current Domain Source-of-Truth Map v1

Date: 2026-05-20

Scope: documentation only. This map records where Protocol domain concepts live today, where sources overlap, and which future owner should exist before schema or implementation refactors.

Inputs:

- `docs/protocol/manuals/*.md`
- `docs/protocol/audits/protocol-domain-gap-audit-v1.md`
- `src/integrations/supabase/types.ts`
- `src/routes/*`
- `src/server/*`
- `src/lib/*`
- `supabase/migrations/*`

Status labels:

- Current owner: the best current read/write owner, if one exists.
- Duplicate sources: other places holding overlapping or derived state.
- Target owner: future source-of-truth concept based on the manuals.
- Migration priority: P0 means block new domain expansion; P1 means next refactor layer; P2 means later hardening.

## Summary Table

| Domain | Current owner | Duplicate sources | Main risk | Target owner | Migration priority |
|---|---|---|---|---|---|
| Client | `clients` table | `profiles`, `client_bookings`, `client_packs`, `workout_plans`, `client_phase` helpers | Client lifecycle is inferred, not recorded | `client_profile` plus `client_lifecycle_events` | P1 |
| Assessment | No single owner; mostly `assessments` | `assessments.extended`, `assessment_injuries`, `client_capacity_snapshots`, `client_measurements`, route state | Mutable row hides protocol answers and review state | `assessment_instance` with versioned sections/answers/findings | P0 |
| Screening / risk | `runPreparticipationAlgorithm` for deterministic logic; `screening_evaluations` intended storage | `assessments.acsm_risk_category`, `medical_clearance_required`, `signs_symptoms`, `cvd_risk_factors`, prompt text | Clearance/risk can be duplicated outside the screening record | `screening_evaluation` plus `risk_flag` history | P0 |
| Prescription parameters | `workout_plans.brief` and `programming_variables` JSON | `assessments`, `blueprint`, `progression_plan`, `red_flag_accommodations`, `generation_meta`, prompts | Cockpit state can change without parameter audit | `prescription_parameter_snapshot` plus override events | P0 |
| Exercise template | `src/lib/exercise-taxonomy.ts` | `equipment-catalog`, `volume-landmarks`, free-text exercise names | Templates are static code, not durable versioned records | `exercise_template` and `exercise_template_version` | P1 |
| Exercise prescription | `workout_plan_days.content.exercises` for phased plans | `workout_plans.plan_data`, `progression_plan`, `microcycle-edit` JSON patches | Free-text prescription identity and dual plan source | `exercise_prescription` linked to plan day and template | P0 |
| Logged exercise performance | `workout_sessions.entries` plus `session_set_logs` mirror | `client_checkins`, `plan_feedback`, client log route state | Raw JSON and normalized mirror can drift | `logged_exercise_performance` / `set_log` events | P1 |
| Pain / modification | `assessment_injuries` plus injury filters | `assessments.injuries`, `pain_areas`, `red_flag_accommodations`, `session_set_logs.pain_flag`, notes | Pain is mixed with hard effort and free text | `pain_event` plus `pain_modification_decision` | P0 |
| Program lifecycle | `generation_state`, `generation_status`, `status`, helpers | `client-phase`, `assessment-phase`, `workout_plan_days.approved_at`, bookings, sessions | Lifecycle transitions are inferred from many fields | lifecycle event streams per client/assessment/block/session | P1 |
| Trainer overrides | No single owner | `programming_variables`, `generation_meta.tier_override`, manual JSON edits, client-side writes | Overrides lack previous/new value, reason, and audit coverage | `trainer_override` / `ai_suggestion_decision` | P0 |
| Audit events | `audit_events` table and `logAuditEvent` helper | `generation_log`, `generation_meta.regeneration_log`, adaptation decisions | Infrastructure exists but write coverage is sparse | append-only audit event contract by domain event type | P0 |
| AI generation / suggestions | `generation_log` and staged generation outputs | `section_analyses`, `brief`, `blueprint`, `progression_plan`, `generation_meta`, prompt outputs | AI outputs become state without suggestion/decision distinction | `ai_suggestion` plus accepted/modified/rejected decisions | P1 |

## 1. Client

Current files/routes/tables/functions involved:

- Table/type: `clients` in `src/integrations/supabase/types.ts`.
- Routes: `src/routes/dashboard.tsx`, `src/routes/clients_.$clientId.tsx`, `src/routes/intake.$token.tsx`, `src/routes/schedule.tsx`, `src/routes/me.tsx`.
- Server functions: `src/server/intake.functions.ts`, `src/server/clients.functions.ts`, `src/server/schedule.functions.ts`, `src/server/demo-client.functions.ts`.
- Helpers: `src/lib/client-phase.ts`, `src/hooks/use-client-phases.ts`, `src/lib/birthdays.ts`.

Current source of truth:

- `clients` is the current primary row for client identity and trainer ownership: name, email, phone, sex, date of birth, body size convenience fields, photo, intake token/status, demo flag, and linked `user_id`.

Duplicate or derived sources:

- `profiles` owns trainer identity, not client identity, but client portal/account state may update profile account type.
- `assessments` duplicates or extends some client facts such as age, sex-adjacent risk facts, height/weight context, and intake-derived identity-related data.
- `client_bookings`, `client_packs`, `workout_plans`, and `workout_sessions` derive lifecycle/product state from the client.
- `derivePhase` in `src/lib/client-phase.ts` derives client phase from assessment, latest plan, session recency, and intake status.

Legacy fields:

- `clients.age` exists alongside `clients.date_of_birth`; date of birth is better for future correctness.
- `clients.height_cm` and `clients.weight_kg` are convenient current fields but overlap with assessment/measurement concepts.

JSON blobs involved:

- None directly on `clients`; client-related facts are often hidden in `assessments.extended`.

Client-side mutations involved:

- `src/routes/clients_.$clientId.tsx` updates `clients.sex`, `date_of_birth`, `height_cm`, and `weight_kg`.
- `src/routes/dashboard.tsx` can delete clients.
- `src/components/ClientAvatarUpload.tsx` updates `clients.photo_url`.

Server-side mutations involved:

- `src/server/intake.functions.ts` creates invite/manual clients, updates intake status, applies identity patches, links client accounts, and mirrors face photo URLs.
- `src/server/clients.functions.ts` updates trainer summary.
- `src/server/schedule.functions.ts` updates client color and related scheduling rows.

Current risks:

- Client lifecycle is inferred from several tables and not preserved as historical events.
- Trainer and client account ownership paths can affect the same `clients` row.
- Deleting clients from client-side routes can remove important domain context through cascade behavior.

Target future owner:

- `client_profile` for identity/current contact state.
- `client_lifecycle_events` for onboarding, intake, active, idle, paused, ended, and reactivation transitions.

Do not change yet:

- Do not split client identity from lifecycle until lifecycle event semantics are defined.
- Do not add more lifecycle flags to `clients` as ad hoc text/booleans.

## 2. Assessment

Current files/routes/tables/functions involved:

- Table/type: `assessments`, `assessment_injuries`, `client_measurements`, `client_capacity_snapshots`, `capacity_domains`.
- Routes: `src/routes/clients_.$clientId.tsx`, `src/routes/intake.$token.tsx`.
- Server functions: `src/server/intake.functions.ts`, `src/server/intake-ai.functions.ts`, `src/server/intake-photos.functions.ts`, `src/server/injuries.functions.ts`, `src/server/capacity.functions.ts`, `src/server/measurements.functions.ts`, `src/server/phased/pre-stage.functions.ts`.
- Helpers: `src/lib/assessment-phase.ts`, `src/lib/assessment-completion.ts`, `src/lib/brief-minimum.ts`, `src/lib/assessment-implications.ts`, `src/lib/movement-criteria.ts`.

Current source of truth:

- No single current source of truth.
- `assessments` is the broad current-state row for most assessment fields.
- `assessment_injuries` is the better current owner for structured injury rows.
- `client_capacity_snapshots` is the current owner for capacity-domain measurements.

Duplicate or derived sources:

- `assessments.extended` stores PAR-Q answers, provenance, field provenance, skipped fields, intake path, photos, AI goal interpretation, lifestyle details, scheduling preferences, and mobility variants.
- `clients` stores identity/body fields used during assessment.
- `assessmentPhase` and `buildCompletionReport` derive completeness from current fields.
- `section_analyses` stores AI-derived summaries over assessment sections.

Legacy fields:

- Free-text `assessments.injuries`, `medical_conditions`, `medications`, `preferences`, and `max_lifts`.
- Assessment data also exists as deprecated or compatibility fields inside `extended` with both `ext_*` and bare names.

JSON blobs involved:

- `assessments.extended`
- `assessments.parq`
- `assessments.risk`
- `assessments.signs_symptoms`
- `assessments.cvd_risk_factors`
- `assessments.section_analyses`
- movement screen form/capacity JSON fields.

Client-side mutations involved:

- `src/routes/clients_.$clientId.tsx` updates/inserts `assessments` and updates selected client profile fields.
- The route also keeps local state and local-storage style recovery for assessment work.

Server-side mutations involved:

- `saveIntake` in `src/server/intake.functions.ts` writes public intake fields into `assessments`.
- `src/server/intake-ai.functions.ts` and `src/server/intake-photos.functions.ts` update `assessments.extended`.
- `src/server/injuries.functions.ts` creates/updates/deletes `assessment_injuries`.
- `src/server/phased/pre-stage.functions.ts` writes section analysis fields.

Current risks:

- Mutable assessment current state loses review/history semantics.
- Public intake, trainer edits, AI analysis, injuries, measurements, and capacity all contribute to assessment without one versioned protocol instance.
- Adding fields to `extended` increases hidden domain behavior.

Target future owner:

- `assessment_instance` with `assessment_protocol_version`.
- `assessment_section_response` / `assessment_answer`.
- `assessment_finding`, `assessment_constraint`, `assessment_review_event`, and `assessment_confidence`.

Do not change yet:

- Do not add special-population branches to current route logic.
- Do not add more core protocol fields to `assessments.extended`.
- Do not migrate assessment storage until a protocol version contract exists.

## 3. Screening / Risk

Current files/routes/tables/functions involved:

- Engine: `src/server/screening/preparticipation.server.ts`.
- Table/type: `screening_evaluations`, `assessments` risk-related fields.
- Server functions: `src/server/phased/stage2-blueprint.functions.ts`, `src/server/phased/programming-tier.server.ts`.
- Helpers: `src/lib/blood-pressure.ts`, `src/lib/assessment-implications.ts`.
- Audit: `src/server/audit/log-event.server.ts`, `audit_events`.

Current source of truth:

- Deterministic logic: `runPreparticipationAlgorithm` is the current source for ACSM-style baseline screening computation.
- Intended persisted source: `screening_evaluations`, but the audit found it is not consistently used as the authoritative record.

Duplicate or derived sources:

- `assessments.parq_passed`
- `assessments.extended.parq`
- `assessments.acsm_risk_category`
- `assessments.medical_clearance_required`
- `assessments.medical_clearance_reason`
- `assessments.signs_symptoms`
- `assessments.cvd_risk_factors`
- prompt safety text in legacy and phased generation.

Legacy fields:

- `acsm_risk_category` as client/intake-writeable assessment state.
- `parq_passed` as a collapsed boolean rather than versioned answers plus decision.

JSON blobs involved:

- `screening_evaluations.answers`
- `screening_evaluations.structured_reasons`
- `screening_evaluations.raw_detail`
- `assessments.extended.parq`
- `assessments.signs_symptoms`
- `assessments.cvd_risk_factors`

Client-side mutations involved:

- Trainer assessment route can update risk-related `assessments` fields.
- Public intake route builds PAR-Q/risk payload via `toPayload`.

Server-side mutations involved:

- `saveIntake` writes PAR-Q pass/fail and risk-related fields to `assessments`.
- Screening engine consumers derive tier/constraints during generation.
- `logAuditEvent` supports `screening_completed` and `risk_band_changed`, but coverage is not universal.

Current risks:

- Screening decisions can be duplicated between mutable assessment fields and immutable-ish screening records.
- Missing-data confidence is not a persisted screening output.
- Delete immutability for `screening_evaluations` was not found in the initial migration.

Target future owner:

- `screening_evaluation` should be the authoritative persisted result.
- `screening_protocol_version`, `screening_answers`, `screening_missing_data`, `risk_flag`, and `clearance_status` should own details/history.

Do not change yet:

- Do not allow AI to decide clearance or referral status.
- Do not add pregnancy/postpartum, cardiac rehab, or special-population risk branches until baseline screening persistence is settled.

## 4. Prescription Parameters

Current files/routes/tables/functions involved:

- Schemas: `src/server/phased/schemas.ts`.
- Defaults/tiering: `src/server/phased/programming-defaults.ts`, `src/server/phased/programming-tier.server.ts`.
- Generation stages: `src/server/phased/stage1-brief.functions.ts`, `stage2-blueprint.functions.ts`, `stage3-microcycle.functions.ts`, `stage4-progressions.functions.ts`, `stage5-bulkfill.functions.ts`.
- Volume: `src/lib/prescribe-volume.ts`, `src/lib/volume-landmarks.ts`, `src/lib/volume-compute.ts`, `src/lib/volume-actual.ts`.
- UI: `src/components/BriefEditor.tsx`, `src/components/plan/IntensityCockpit.tsx`, `src/components/BlueprintEditorPanel.tsx`, `src/components/ProgressionsPanel.tsx`, `src/components/PlanEditorSurface.tsx`.
- Table/type: `workout_plans`.

Current source of truth:

- No single current source.
- Best current owner is `workout_plans.brief` plus `workout_plans.programming_variables` for high-level staged prescription parameters.
- `src/server/phased/schemas.ts` is the strongest current contract for shape.

Duplicate or derived sources:

- `assessments` source fields.
- `workout_plans.blueprint`
- `workout_plans.progression_plan`
- `workout_plans.red_flag_accommodations`
- `workout_plans.generation_meta`
- `workout_plan_days.content`
- legacy prompt outputs in `src/server/plan.functions.ts`.

Legacy fields:

- `workout_plans.plan_data` for legacy full-plan JSON.
- Legacy single-shot generator behavior in `src/server/plan.functions.ts`.

JSON blobs involved:

- `workout_plans.brief`
- `workout_plans.programming_variables`
- `workout_plans.blueprint`
- `workout_plans.progression_plan`
- `workout_plans.red_flag_accommodations`
- `workout_plans.generation_meta`
- `workout_plans.plan_data`

Client-side mutations involved:

- `src/components/PlanEditorSurface.tsx` updates `workout_plans.programming_variables`, title, summary, and plan data.
- `src/routes/clients_.$clientId.tsx` creates/deletes plan rows and orchestrates generation.

Server-side mutations involved:

- Stage functions update brief, programming variables, blueprint, generation state, progression plan, day rows, and completion state.
- `setTierOverride` writes tier override into `generation_meta`.
- `src/server/plan.functions.ts` writes legacy plan and regenerated plan data.

Current risks:

- Trainer-controlled parameters are editable without a dedicated override record.
- Prompt-owned prescription rules are not versioned as parameter decisions.
- Generated day content can become the de facto prescription without preserving the parameter snapshot that produced it.

Target future owner:

- `prescription_parameter_snapshot` with version, source, approval state, and linked rule outputs.
- `trainer_override` for changed parameters.
- `prescription_constraint` for risk, pain, equipment, adherence, and recovery constraints.

Do not change yet:

- Do not add more cockpit controls.
- Do not expand prompt-only prescription rules.
- Do not create new schema until parameter ownership is agreed.

## 5. Exercise Template

Current files/routes/tables/functions involved:

- Static taxonomy: `src/lib/exercise-taxonomy.ts`.
- Equipment: `src/lib/equipment-catalog.ts`.
- Muscles: `src/lib/volume-landmarks.ts`.
- Filters: `src/server/phased/exercise-filters.server.ts`.
- UI references: `src/components/AddExerciseDialog.tsx`, `src/components/MovementPatternCard.tsx`, `src/components/DayCardEditable.tsx`.

Current source of truth:

- `src/lib/exercise-taxonomy.ts` is the current code-level source for canonical seed exercises and vocabulary.
- There is no durable database source for exercise templates.

Duplicate or derived sources:

- Prompt-generated free-text exercise names.
- `workout_plan_days.content.exercises`.
- `workout_sessions.entries`.
- `session_set_logs.exercise_slug` and `movement_pattern`.

Legacy fields:

- Free-text exercise names in plan/session JSON are effectively legacy identity.

JSON blobs involved:

- None for templates directly; template-like data is static TypeScript.
- Template identity is indirectly embedded in plan/session JSON.

Client-side mutations involved:

- Manual exercise edits happen through components and server functions that patch day JSON, not a template store.

Server-side mutations involved:

- None for templates. Exercise filters and generation use static code and prompt context.

Current risks:

- Static taxonomy is useful but cannot represent trainer-local additions, template versioning, media, substitutions, or review state.
- Unknown exercises can enter prescriptions/logs without canonical template identity.

Target future owner:

- `exercise_template`, `exercise_template_version`, `exercise_alias`, `exercise_caution_tag`, `exercise_media_asset`.
- Global templates plus optional trainer-local extensions if product strategy requires it.

Do not change yet:

- Do not build media/library UI before durable exercise identity exists.
- Do not let AI-generated unknown exercises become canonical templates automatically.

## 6. Exercise Prescription

Current files/routes/tables/functions involved:

- Table/type: `workout_plan_days.content`, `workout_plans.plan_data`.
- Schemas: `PhasedDaySchema` in `src/server/phased/schemas.ts`.
- Generation: `src/server/phased/stage3-microcycle.functions.ts`, `stage4-progressions.functions.ts`, `stage5-bulkfill.functions.ts`.
- Editing: `src/server/phased/microcycle-edit.functions.ts`, `src/components/MicrocyclePanel.tsx`, `src/components/PlanEditorSurface.tsx`.
- Legacy generator: `src/server/plan.functions.ts`.

Current source of truth:

- For phased plans, `workout_plan_days.content.exercises` is the practical current source.
- For legacy/public/export flows, `workout_plans.plan_data` remains a source or cache.

Duplicate or derived sources:

- `workout_plans.progression_plan` stores progression deltas by exercise id/name.
- `PlanEditorSurface` rebuilds a `PlanData` view from `workout_plan_days`.
- Public logging reads `plan_data` via `getSharedPlan` in `src/server/sessions.functions.ts`.

Legacy fields:

- `workout_plans.plan_data.weeks[].days[].exercises`.
- Legacy `plan_data` snapshots for phased plans.

JSON blobs involved:

- `workout_plan_days.content`
- `workout_plans.plan_data`
- `workout_plans.progression_plan`

Client-side mutations involved:

- `PlanEditorSurface` updates plan title/summary/plan data and can insert/update workout sessions from displayed exercises.

Server-side mutations involved:

- Stage 3 upserts day rows.
- Stage 5 deletes/reinserts future day rows.
- `microcycle-edit.functions.ts` patches, deletes, inserts, approves, and unapproves exercises in day JSON.
- `plan.functions.ts` persists regenerated plan data and day rows.

Current risks:

- Exercise prescriptions are still free-text objects, not rows linked to templates.
- `plan_data` and `workout_plan_days` can diverge.
- Manual edits do not produce a first-class prescription-change event.

Target future owner:

- `exercise_prescription` linked to `program_day` / `session_template` and `exercise_template_version`.
- Compatibility adapter to read phased rows and legacy plan data during transition.

Do not change yet:

- Do not migrate all plan-day JSON until adapter tests and canonical exercise identity exist.
- Do not add substitutions on top of raw names.

## 7. Logged Exercise Performance

Current files/routes/tables/functions involved:

- Tables/types: `workout_sessions`, `session_set_logs`, `client_checkins`.
- Server functions: `src/server/sessions.functions.ts`, `src/server/demo-sessions.functions.ts`.
- Routes/components: `src/routes/log.$token.tsx`, `src/routes/plans.$planId.sessions.tsx`, `src/components/PlanEditorSurface.tsx`, `src/components/plan/LogbookTimeline.tsx`.
- Helpers: `src/lib/session-summary.ts`, `src/lib/volume-actual.ts`, `src/lib/compliance.ts`, `src/lib/capacity-gain.ts`.

Current source of truth:

- `workout_sessions.entries` is the primary raw session log source.
- `session_set_logs` is the normalized set-level mirror used for adaptation/analytics.

Duplicate or derived sources:

- `client_checkins` mirrors readiness from session logging.
- `plan_feedback` and client feedback fields overlap with session feedback.
- `session_summary`, actual volume, compliance, and capacity gain are derived from sessions/sets.

Legacy fields:

- `workout_sessions.entries` supports legacy v1 entry shape and newer v2 `sets[]`.
- `actual` object in entries is legacy compared with set-by-set logs.

JSON blobs involved:

- `workout_sessions.entries`
- `workout_sessions.client_feedback`
- `workout_sessions.pre_readiness`
- `workout_sessions.post_feedback`

Client-side mutations involved:

- `src/components/PlanEditorSurface.tsx` inserts/updates/deletes workout sessions directly.
- Public client logging in `src/routes/log.$token.tsx` calls server functions.

Server-side mutations involved:

- `saveTrainerSession`, `saveClientSession`, `getOpenSession`, and related helpers in `src/server/sessions.functions.ts`.
- Finalized client logs delete drafts, insert sessions, mirror to `session_set_logs`, and upsert `client_checkins`.

Current risks:

- Raw JSON and normalized set mirror can drift because mirror insert failures are non-fatal.
- Exercise identity uses free-text `exercise_name` and slugified names.
- Corrections/edit history for logs is not first-class.

Target future owner:

- `logged_session`, `logged_exercise_performance`, and `logged_set`/`set_log` with correction events.

Do not change yet:

- Do not make logs append-only until correction UX and migration policy exist.
- Do not build advanced adaptation on free-text exercise identity.

## 8. Pain / Modification

Current files/routes/tables/functions involved:

- Tables/types: `assessment_injuries`, `assessments.injuries`, `workout_plans.red_flag_accommodations`, `session_set_logs.pain_flag`.
- Components/routes: `src/components/InjuryEditor.tsx`, `src/components/InjuriesBodyMapBlock.tsx`, `src/components/intake/InjuriesSlide.tsx`, `src/routes/clients_.$clientId.tsx`.
- Server functions: `src/server/injuries.functions.ts`, `src/server/phased/exercise-filters.server.ts`, `src/server/phased/programming-defaults.ts`, `src/server/sessions.functions.ts`.

Current source of truth:

- `assessment_injuries` is the best current owner for structured injury/pain-at-assessment state.
- `deriveInjuryBans` is the current deterministic source for injury-driven exercise bans.

Duplicate or derived sources:

- `assessments.injuries` free text.
- `assessments.pain_areas`.
- `workout_plans.red_flag_accommodations`.
- `session_set_logs.pain_flag`.
- Session notes, entry notes, and client feedback.

Legacy fields:

- Free-text `assessments.injuries`.
- Pain inferred from `felt === "hard"` plus high RPE in session mirroring is not a reliable pain domain field.

JSON blobs involved:

- `workout_plans.red_flag_accommodations`
- `workout_sessions.entries`
- `workout_sessions.client_feedback`
- assessment pain/screen-related JSON fields.

Client-side mutations involved:

- Injury UI writes through server functions, but assessment route still handles related assessment state directly.
- Plan editor can change exercises without first-class pain modification events.

Server-side mutations involved:

- `injuries.functions.ts` creates/updates/deletes injury rows.
- `exercise-filters.server.ts` derives bans.
- `programming-defaults.ts` derives/redacts accommodations.
- `sessions.functions.ts` writes `pain_flag` to set logs during mirror.

Current risks:

- Pain event, pain modification, and injury history are mixed.
- A hard-effort flag can be mistaken for pain.
- Exercise substitutions for pain are not recorded as decisions.

Target future owner:

- `pain_event`, `pain_report`, `pain_modification_decision`, `exercise_stop_event`, and `referral_flag`.

Do not change yet:

- Do not implement rehab pathways or medical language.
- Do not infer pain from effort without explicit pain input.
- Do not automate continuation after pain without trainer approval.

## 9. Program Lifecycle

Current files/routes/tables/functions involved:

- Plan fields: `workout_plans.status`, `generation_state`, `generation_status`, `completion_state`, `block_number`, `prior_plan_id`, `block_transition_summary`.
- Day fields: `workout_plan_days.status`, `approved_at`.
- Session fields: `workout_sessions.status`.
- Helpers: `src/lib/client-phase.ts`, `src/lib/assessment-phase.ts`, `src/lib/plan-status.ts`, `src/lib/plan-lineage.ts`.
- Server functions: `src/server/phased/*`, `src/server/blocks.functions.ts`, `src/server/blocks-manual.functions.ts`, `src/server/adaptation/*`, `src/server/sessions.functions.ts`.
- Schedule: `client_bookings`.

Current source of truth:

- No single lifecycle source.
- Plan generation lifecycle is mostly `workout_plans.generation_state` plus `generation_status`.
- Block lifecycle is mostly `workout_plans.status`, `block_number`, `prior_plan_id`, and block transition fields.
- Session lifecycle is mostly `workout_sessions.status`.

Duplicate or derived sources:

- `derivePhase` derives client lifecycle.
- `assessmentPhase` derives assessment lifecycle.
- `planStatusInfo` derives UI plan status.
- `workout_plan_days.approved_at` overlaps with stage approval concepts.
- `client_bookings` handles scheduled appointment state separately from workout session execution.

Legacy fields:

- `workout_plans.status` values are used across legacy and phased plans.
- `generation_status` and `generation_state.stage` can both represent generation progress.

JSON blobs involved:

- `workout_plans.generation_state`
- `workout_plans.generation_meta`
- `workout_plans.completion_state`

Client-side mutations involved:

- `src/routes/clients_.$clientId.tsx` creates/deletes resumable/plan rows and drives staged generation UI.
- `src/components/PlanEditorSurface.tsx` deletes plans, logs sessions, and updates plan data.
- Dashboard/plan index routes delete plans.

Server-side mutations involved:

- Stage functions update generation state/stage approvals.
- Block functions archive plans, create next blocks, and write adaptation decisions.
- Session functions create/update draft/final session rows.

Current risks:

- Lifecycle history is not preserved as transitions.
- Multiple status fields can diverge.
- User-facing labels and internal lifecycle states are mixed.

Target future owner:

- `client_lifecycle_event`, `assessment_lifecycle_event`, `block_lifecycle_event`, and `session_lifecycle_event`.
- Current-state read models derived from event history.

Do not change yet:

- Do not add more status fields.
- Do not automate next-block transitions until block review/approval events are explicit.

## 10. Trainer Overrides

Current files/routes/tables/functions involved:

- Plan JSON fields: `workout_plans.programming_variables`, `generation_meta`, `red_flag_accommodations`, `blueprint`, `progression_plan`.
- UI: `src/components/BriefEditor.tsx`, `src/components/plan/IntensityCockpit.tsx`, `src/components/BlueprintEditorPanel.tsx`, `src/components/ProgressionsPanel.tsx`, `src/components/PlanEditorSurface.tsx`.
- Server functions: `src/server/phased/stage1-brief.functions.ts`, `stage2-blueprint.functions.ts`, `stage3-microcycle.functions.ts`, `stage4-progressions.functions.ts`, `microcycle-edit.functions.ts`, `src/server/blocks.functions.ts`.
- Audit helper: `src/server/audit/log-event.server.ts`.

Current source of truth:

- No single owner.
- Overrides are currently represented as direct mutations to the domain object being overridden.

Duplicate or derived sources:

- `generation_meta.tier_override`.
- Updated `programming_variables`.
- Patched `blueprint` and `progression_plan`.
- Edited `workout_plan_days.content`.
- `adaptation_decisions` for a subset of next-block decisions.

Legacy fields:

- Plan editor feedback/regeneration logs in `generation_meta` and plan data.

JSON blobs involved:

- `workout_plans.programming_variables`
- `workout_plans.generation_meta`
- `workout_plans.red_flag_accommodations`
- `workout_plan_days.content`
- `adaptation_decisions.changes`

Client-side mutations involved:

- `PlanEditorSurface` updates programming variables and plan content.
- Client route may create/delete plans and trigger changes through UI state.

Server-side mutations involved:

- Stage approval/edit functions update plan JSON.
- `microcycle-edit.functions.ts` changes exercise content and approval locks.
- `blocks.functions.ts` writes adaptation decisions.

Current risks:

- Overrides often lack previous value, new value, reason, actor, and link to AI suggestion.
- Important safety/prescription changes can happen without audit event coverage.

Target future owner:

- `trainer_override` with domain, entity, field/parameter, previous value, new value, reason, actor, timestamp, and linked AI suggestion/rule result.

Do not change yet:

- Do not add more override surfaces until the audit event contract is defined.
- Do not require reasons for every minor draft edit until the critical override set is identified.

## 11. Audit Events

Current files/routes/tables/functions involved:

- Table/type: `audit_events`.
- Migration: `supabase/migrations/20260513142006_e61c8002-02e8-4b82-b2eb-347b89504e89.sql`.
- Helper: `src/server/audit/log-event.server.ts`.
- Related records: `generation_log`, `adaptation_decisions`, `adaptation_proposals`.
- Some calls: `src/server/blocks.functions.ts`, `src/server/adaptation/propose-next-block.server.ts`.

Current source of truth:

- `audit_events` is the intended append-only audit event store.
- `logAuditEvent` is the intended helper.

Duplicate or derived sources:

- `generation_log` records AI calls/telemetry.
- `generation_meta.regeneration_log` stores regeneration history.
- `adaptation_decisions` is append-only for adaptation choices.

Legacy fields:

- Domain history embedded in plan JSON rather than audit events.

JSON blobs involved:

- `audit_events.payload`
- `audit_events.engine_versions`
- `generation_log.request_summary` / response metadata fields
- `generation_meta.regeneration_log`
- `adaptation_proposals.proposal/evidence/engine_versions`
- `adaptation_decisions.changes`

Client-side mutations involved:

- Many client-side domain mutations bypass `logAuditEvent`, including assessment edits, plan deletes, plan data updates, programming variable updates, and session inserts/updates.

Server-side mutations involved:

- `logAuditEvent` inserts audit rows.
- Block/adaptation paths write some audit events or append-only decisions.
- AI server writes generation logs.

Current risks:

- Audit infrastructure exists but is not the universal write path.
- `logAuditEvent` swallows errors, which may be wrong for mandatory safety/approval events.
- Coverage is unclear without a matrix of required event types per manual.

Target future owner:

- Append-only `audit_events` with domain-specific event contracts and tests.
- Mandatory audit on screening, approval, override, substitution, pain modification, progression, block/session transition, and correction events.

Do not change yet:

- Do not build a dashboard before coverage exists.
- Do not purge or mutate audit history.

## 12. AI Generation / Suggestions

Current files/routes/tables/functions involved:

- AI wrapper/logging: `src/server/phased/ai.server.ts`, `src/server/anthropic-compat.server.ts`.
- Generation stages: `src/server/phased/stage1-brief.functions.ts`, `stage2-blueprint.functions.ts`, `stage3-microcycle.functions.ts`, `stage4-progressions.functions.ts`, `stage5-bulkfill.functions.ts`, `src/server/plan.functions.ts`.
- Tables/types: `generation_log`, `workout_plans.brief`, `blueprint`, `progression_plan`, `generation_meta`, `section_analyses`.
- UI: `src/components/FounderAiTelemetryPanel.tsx`, `src/components/BlueprintAiChat.tsx`, staged panels in `src/routes/clients_.$clientId.tsx`.

Current source of truth:

- `generation_log` is the current telemetry/audit-like record of AI calls.
- Accepted AI outputs become current state in `workout_plans` JSON and `workout_plan_days.content`.

Duplicate or derived sources:

- `section_analyses` in `assessments`.
- `brief`, `blueprint`, `progression_plan`, `generation_meta`.
- Legacy `plan_data`.
- AI chat/patch flows in blueprint functions.

Legacy fields:

- Legacy single-shot generator output in `plan_data`.
- Prompt-level "rules" in `src/server/plan.functions.ts`.

JSON blobs involved:

- `generation_log`
- `workout_plans.brief`
- `workout_plans.blueprint`
- `workout_plans.progression_plan`
- `workout_plans.generation_meta`
- `assessments.section_analyses`
- `workout_plan_days.content`

Client-side mutations involved:

- Client route triggers generation stages and applies returned state.
- Plan editor can trigger regeneration and persist generated output.

Server-side mutations involved:

- Stage functions call AI, validate schemas, update plan rows, and insert day rows.
- `ai.server.ts` writes generation logs.
- Blueprint chat/patch functions update blueprint JSON.

Current risks:

- AI outputs are often promoted directly into plan state, not tracked as pending suggestions with accept/modify/reject decisions.
- Prompt-owned rules can silently change behavior without a domain rule version.
- Generation logs and audit events are related but not unified.

Target future owner:

- `ai_suggestion` records with input hash, model, prompt/rule version, output, target entity, and status.
- `ai_suggestion_decision` for accepted, modified, rejected, regenerated, or superseded suggestions.

Do not change yet:

- Do not expand AI prompts with more domain rules.
- Do not silently alter approved plans from AI output.
- Do not implement product-learning analytics until suggestion decisions are explicit.

## Unclear Source-of-Truth Decisions

These do not block this documentation, but they do block implementation refactors:

- Whether `screening_evaluations` should fully replace `assessments.acsm_risk_category` and `medical_clearance_required` as the authoritative screening result.
- Whether `workout_plan_days` is permanent source of truth for all new plan content and `plan_data` is export/cache only.
- Whether exercise templates will be global-only, trainer-local, or hybrid.
- Whether trainer override reasons are required for all post-approval changes or only safety/prescription-critical changes.
- Whether session logs should remain mutable, become append-only, or use correction/supersession events.

## Recommended Next PR

Recommended next PR: add server-side audit coverage for one existing approval path.

Start with `approveBrief` or `approveBlueprint` because:

- The approval functions are already server-side.
- `audit_events` and `logAuditEvent` already exist.
- No schema change is required.
- The behavior is narrow, reversible, and validates the audit pattern before broader domain refactors.
