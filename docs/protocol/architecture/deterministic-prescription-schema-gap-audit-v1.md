# Deterministic Prescription Schema Gap Audit v1

Date: 2026-05-26

Scope: documentation only. This audit maps `deterministic-prescription-engine-discovery-v1.md` against the current Protocol schema, generated Supabase types, migrations, server functions, route surfaces, pure helpers, and architecture docs. It does not use private spreadsheet data and does not propose implementation changes in this PR.

## 1. Executive Summary

Current Protocol can partially support a deterministic prescription engine, but not as a clean source-of-truth system yet. The repo already has strong building blocks: `clients`, `assessments`, `workout_plans`, `workout_plan_days`, `workout_sessions`, `session_set_logs`, `audit_events`, `generation_log`, `screening_evaluations`, `adaptation_proposals`, `adaptation_decisions`, `progress_markers`, a static exercise taxonomy, volume helpers, cardio zone helpers, and deterministic adaptation/progression scaffolds.

The current blocker is source-of-truth fragmentation. Planned exercise prescriptions live primarily inside `workout_plans.plan_data` and `workout_plan_days.content` JSON. Performed sessions live in `workout_sessions.entries` JSON with a newer `session_set_logs` mirror. Program parameters live across `brief`, `blueprint`, `programming_variables`, `prescription_parameters`, `progression_plan`, `generation_meta`, and staged generation state. Exercise taxonomy exists in TypeScript code, not as versioned database records.

The schema can support early pure-engine work where inputs are adapted from existing shapes, especially volume computation, set-log normalization, and read-only audits. It is not yet ready for deterministic prescription as canonical persisted state. Before integration, Protocol should prioritize exercise taxonomy persistence, normalized exercise prescription rows, normalized performed set rows, explicit trainer overrides, and durable audit events for engine decisions.

## 2. Current Source-of-Truth Map

| Domain item | Current table/file/json field | Canonical or duplicated? | Structured enough for deterministic logic? | Trainer-editable? | Audit/history? |
| --- | --- | --- | --- | --- | --- |
| Client | `clients`; route edits in `clients_.$clientId.tsx`; intake writes in `intake.functions.ts` | Mostly canonical for identity/current profile; lifecycle duplicated/inferred | Mostly yes for identity, limited for lifecycle | Yes | No dedicated lifecycle history |
| Assessment | `assessments`; `assessments.extended`; movement capacity/form JSON; `client_capacity_snapshots`; `assessment_injuries` | Duplicated across row fields, JSON, injuries, measurements, capacity | Partially; many fields are typed, but important details are JSON/free text | Yes | Sparse; no versioned assessment instance |
| Screening/risk | `screening_evaluations`; `assessments.acsm_risk_category`, `medical_clearance_required`, `signs_symptoms`, `cvd_risk_factors`; `screening/preparticipation.server.ts` | Duplicated between deterministic result and mutable assessment fields | Good for screening result if `screening_evaluations` is used consistently | Mostly trainer/system | `screening_evaluations` is immutable-on-update; `audit_events` available but coverage unclear |
| Workout plan | `workout_plans` row plus `plan_data`, `brief`, `blueprint`, `programming_variables`, `progression_plan` | Duplicated/staged | Partially; top-level metadata is typed, plan content is JSON | Yes | Generation metadata and `generation_log`; limited domain audit |
| Workout plan day | `workout_plan_days` with `content` JSON and `validation_meta` | Current phased owner, but overlaps `plan_data.weeks` | Partially; day metadata typed, exercises inside JSON | Yes via edit functions | No explicit day edit audit found |
| Exercise prescription | `workout_plan_days.content.exercises`; legacy `workout_plans.plan_data.weeks.days.exercises`; `PhasedDaySchema` | Duplicated between legacy and phased plan shapes | Partially; Zod schema exists, DB stores JSON | Yes through microcycle editor | Not first-class |
| Performed session | `workout_sessions` | Mostly canonical session row | Yes for slot/status/readiness envelope | Client/trainer | Session row mutable; no append-only history |
| Performed set | `workout_sessions.entries` JSON; `session_set_logs` mirror | Duplicated; mirror may drift | `session_set_logs` is close, but lacks template linkage and RIR | Client/trainer via logging UI | No immutable performed-set event history |
| Session feedback | `workout_sessions.pre_readiness`, `post_feedback`, `client_feedback`; `plan_feedback`; `client_checkins` mirror | Fragmented | Partially; some JSON validation exists | Client/trainer | Feedback status has row history only; no audit boundary |
| Pain/injury signals | `assessment_injuries`; `assessments.injuries`; `session_set_logs.pain_flag`; feedback notes | Fragmented | Partially; pain flag is too coarse and notes are free text | Yes | Limited; injury edits not fully append-only |
| Progression decisions | `progression_plan` JSON; `program-next-week` deterministic output; `adaptation_proposals`; `adaptation_decisions`; `progress_markers` | Fragmented | Partially; block adaptation has structured proposal, week progression writes day JSON | Trainer/system | Adaptation decisions append-only; generation log records deterministic run |
| Volume calculations | `volume-compute.ts`, `volume-actual.ts`, `volume-landmarks.ts`, `prescribe-volume.ts`; `progress_markers` for some outputs | Code-owned, not persisted as canonical volume audit | Yes for current plan JSON shape; limited by exercise identity quality | Thresholds not fully trainer-editable | No canonical `volume_audit` |
| Exercise library/taxonomy | `src/lib/exercise-taxonomy.ts`; `equipment-catalog.ts`; exercise names in plan/session JSON | Static code, duplicated by free-text plan/session names | Good as seed code, not durable/versioned enough | No DB/editor | No taxonomy version history beyond code version |
| Trainer overrides | `programming_variables`; manual plan/day JSON edits; `adaptation_decisions`; feedback/status edits | No single owner | Partially; override semantics are not normalized | Yes | `adaptation_decisions` yes; general overrides no |
| Audit events | `audit_events`; `logAuditEvent` | Canonical infrastructure, sparse coverage | Yes | Service role only | Append-only |
| AI generation logs | `generation_log`; `generation_meta`; staged outputs `brief`, `blueprint`, `progression_plan`; `section_analyses` | Fragmented | Good for telemetry, weak for suggestion/decision boundaries | No direct editing except accepted outputs | `generation_log` exists; accepted/modified/rejected decision audit incomplete |

## 3. Deterministic Engine Concept Mapping

| Engine concept | Required data | Current location | Current quality | Gap | Proposed source of truth | Migration needed? | Risk level | Recommended next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `exercise_template` | Stable exercise id, names, aliases, equipment, level, pattern, cautions | `src/lib/exercise-taxonomy.ts` | Good seed, code-only | Not persisted/versioned/trainer-reviewable | `exercise_templates` plus version table | Yes | High | Create taxonomy schema/import plan |
| `exercise_muscle_map` | Exercise id, muscle, role, weight | Static taxonomy primary/secondary arrays and plan JSON | Partial | No role weights beyond primary/secondary convention | `exercise_muscle_map` | Yes | High | Define role taxonomy and weights |
| `movement_pattern` | Canonical pattern vocabulary | Static taxonomy; regex inference in adaptation/session logging | Partial | Regex and taxonomy vocabularies diverge | Taxonomy table/reference enum | Yes | Medium | Align pattern vocabulary before engine tests |
| Equipment constraints | Client equipment, exercise equipment | `assessments.available_equipment`, `training_location`, `exercise-taxonomy.ts`, `equipment-catalog.ts` | Partial | No canonical DB join from client constraint to template | `exercise_template_equipment`, assessment constraint snapshot | Yes | Medium | Audit equipment vocabulary |
| Contraindication/substitution tags | Injury/risk flags, exercise cautions, substitute targets | `assessment_injuries`, free text, `caution_flags` in taxonomy | Partial | No substitution graph or contraindication rules table | `exercise_contraindication_tag`, `exercise_substitution_rule` | Yes | High | Design substitution schema after taxonomy |
| `exercise_prescription` | Plan day, exercise template, sets, reps, load, rest, RPE/RIR, order | `workout_plan_days.content.exercises`, `plan_data` JSON | Too flexible/JSON-heavy | No row identity, no FK to template, hard to audit edits | `exercise_prescriptions` | Yes | High | Normalize after taxonomy import |
| `performed_set` | Session, prescription, set index, load/reps/RPE/RIR, completion, pain | `session_set_logs`; `workout_sessions.entries` JSON | Good start | No FK to prescription/template; no RIR; mirror can drift | `performed_sets` or hardened `session_set_logs` | Yes | High | Normalize/migrate session log contract |
| `effective_set` | Performed/planned set plus hard-set eligibility and muscle weights | Derived in volume helpers | Missing as persisted concept | No canonical eligibility rules | Pure `volumeEngine` output plus optional `volume_audits` | Later | Medium | Implement pure engine first |
| Weekly volume by muscle | Exercise map, set counts, week | `volume-compute.ts`, `volume-actual.ts` | Reusable | Depends on JSON muscle arrays/free text | `volume_audits` derived from prescriptions/performed sets | Later | Medium | Build pure engine against adapters |
| Weekly volume by pattern | Exercise pattern, set counts, week | Adaptation regex, taxonomy pattern | Partial | No persisted pattern on prescriptions | `volume_audits` / `progress_markers` by pattern | Later | Medium | Use taxonomy pattern once canonical |
| MEV/MRV thresholds | Muscle, goal, training age, risk/readiness | `VOLUME_LANDMARKS`; PKL/knowledge rules may override | Partial | Static defaults; no DB owner or trainer override history | `volume_landmark_profiles` | Yes | Medium | Decide editability and evidence defaults |
| RPE/RIR target | Exercise prescription, phase, tier, cockpit | `rpe` string in day content; `ProgrammingVariablesSchema`; `programming-context.server.ts` | Partial | RPE string, no RIR field, no per-set target rows | `exercise_prescriptions.target_rpe`, `target_rir` | Yes | High | Include in prescription schema |
| Actual RPE/RIR | Performed set data | `session_set_logs.actual_rpe`; entries JSON | Partial | No RIR; RPE text parsing | `performed_sets.actual_rpe`, `actual_rir` | Yes | Medium | Add RIR only with UI/logging contract |
| Load progression | Prior set, target reps/RPE/RIR, scheme | `program-next-week.functions.ts`; adaptation proposal diff | Partial | Writes copied day JSON, not decisions | `progression_decisions` | Yes | High | Extract pure progression function first |
| Rep progression | Prior reps, rep range, progression scheme | Not first-class; may be in `progression_plan` JSON | Missing | No scheme or decision rows | `progression_decisions` | Yes | High | Define double-progression policy |
| Deload trigger | Adherence, RPE drift, pain, readiness, volume | `adaptationEngine.recommendDeload`; `prescribe-volume` final-week deload | Partial | Trigger and planned deload are separate; no canonical deload event | `progression_decisions` / `trainer_overrides` / `audit_events` | Yes | Medium | Separate planned deload vs reactive deload |
| `readiness_log` | Sleep, energy, soreness, notes, date | `workout_sessions.pre_readiness`; `client_checkins` mirror | Duplicated | Mirror can drift; limited dimensions | `readiness_logs` or hardened `client_checkins` | Yes | Medium | Decide canonical readiness table |
| DOMS/recovery feedback | Soreness by area/muscle, fatigue, pain distinction | `pre_readiness.soreness`, `post_feedback`, notes, pain flag | Partial | No body-region/muscle mapping; soreness vs pain blurred | `recovery_feedback` plus pain events | Yes | High | Model soreness separately from pain |
| `cardio_session` | Modality, duration, distance, HR, zone | Log set schema supports cardio fields; `training-zones.ts`; `daily_activity_log` steps | Partial | No canonical cardio session table or zone attribution | `cardio_sessions` | Yes | Medium | Design cardio log separate from strength sets |
| `cardio_zone` | HRR/max HR, zone boundaries, method/version | `training-zones.ts`; assessment resting HR/submax fields | Partial | Zones not persisted/versioned | Pure `cardioEngine` with optional zone snapshot | Later | Low | Pure engine can start without schema |
| Concurrent training conflict | Strength schedule, cardio load/timing, priority | Not first-class | Missing | No cardio session owner or conflict audit | `concurrent_training_conflicts` derived audit | Yes | Medium | Depends on cardio schema |
| `trainer_override` | Proposed value, final value, reason, actor | `programming_variables`, manual JSON edits, `adaptation_decisions` | Partial | No general override table | `trainer_overrides` | Yes | High | Add override/audit model before integration |
| `audit_event` | Domain event type, entity, payload, versions | `audit_events` | Good infrastructure | Coverage sparse | `audit_events` | No new table, but contract needed | Medium | Define event taxonomy per engine |

## 4. Database/Schema Gap Audit

Classification summary:

| Needed entity/field | Classification | Notes |
| --- | --- | --- |
| `client` | Already exists and usable | `clients` owns identity/current state. Lifecycle/event history is separate future work. |
| `assessment` | Exists but too flexible/JSON-heavy | Typed fields are useful, but `extended`, movement JSON, AI section analysis, injuries, and capacity snapshots fragment source-of-truth. |
| `screening_evaluation` | Already exists and usable, with usage gap | Table is structured and immutable-on-update, but risk fields also live on `assessments`. |
| `workout_plan` | Exists but too flexible/JSON-heavy | Top-level plan lifecycle exists; prescription details are in JSON. |
| `workout_plan_day` | Exists but too flexible/JSON-heavy | Day row exists; exercises are in `content` JSON. |
| `exercise_prescription` | Missing | No first-class prescription row linked to template, day, order, targets, and source decision. |
| `exercise_template` | Exists only in code | Static TS taxonomy is a good seed but not a durable DB source of truth. |
| `exercise_muscle_map` | Exists only in code/JSON | Primary/secondary arrays are useful but not enough for role weighting and versioning. |
| `performed_session` | Already exists and usable | `workout_sessions` is the current canonical session envelope. |
| `performed_set` | Exists but duplicated | `session_set_logs` mirrors finalized logs, while `entries` remains raw JSON. |
| `readiness_log` | Exists but duplicated/JSON-heavy | `pre_readiness` and `client_checkins` overlap. |
| `session_feedback` | Exists but fragmented | `post_feedback`, `client_feedback`, `plan_feedback`, and notes cover different workflows. |
| `cardio_session` | Missing | Cardio fields exist inside generic set logs, but not as a canonical cardio session entity. |
| `volume_audit` | Missing | `progress_markers` can store scalar metrics, but not full versioned volume audit details. |
| `progression_decision` | Exists partially | `adaptation_decisions` is append-only for block decisions; week-to-week progression writes day JSON directly. |
| `trainer_override` | Missing as general table | Some decisions are represented by `adaptation_decisions`, but general plan/prescription overrides lack a normalized owner. |
| `audit_event` | Already exists and usable | Needs event taxonomy and broader write coverage. |
| AI generation log | Already exists and usable | `generation_log` captures stage/model/cost/validation; accepted vs modified suggestions still need decision modeling. |

JSON flexibility is useful where the content is exploratory, presentation-oriented, or AI-generated before acceptance: `generation_meta`, raw AI snapshots, draft `brief`/`blueprint`, and temporary validation metadata. JSON blocks deterministic calculations when they contain canonical dosage or logged performance: `plan_data`, `workout_plan_days.content.exercises`, `workout_sessions.entries`, `programming_variables`, `prescription_parameters`, `client_feedback`, and free-form feedback notes. The engine needs typed rows or typed snapshots for anything used in calculations, joins, audits, or trainer overrides.

## 5. App/Code Gap Audit

| Code surface | Current behavior | Deterministic or AI-generated? | Reusable? | Should become pure engine function? | Risks |
| --- | --- | --- | --- | --- | --- |
| Legacy plan generation (`plan.server.ts`, `plan.functions.ts`) | Builds prompts/schemas and persists plan JSON | Mostly AI-generated with deterministic safety/context blocks | Some schema and safety blocks reusable | Partially; dosage should move out of prompts | AI owns too much dosage truth |
| Phased generation schemas (`phased/schemas.ts`) | Defines brief, programming variables, blueprint, day content, progression JSON | AI outputs validated by Zod plus deterministic defaults | Yes as current contract | Some should become DB row schemas or engine inputs | JSON accepted as state |
| Programming context (`programming-context.server.ts`) | Reconciles brief, assessment, cockpit, PKL defaults, tier/RPE floors | Deterministic | Yes | Yes, already close | Server function reads DB; pure core could be extracted |
| Volume helpers (`volume-compute.ts`, `volume-actual.ts`, `volume-landmarks.ts`) | Computes planned/actual volume by muscle from current plan/session shapes | Deterministic | Yes | Yes, core of `volumeEngine` | Depends on free-text muscles and JSON arrays |
| Volume prescription (`prescribe-volume.ts`) | Creates weekly muscle set targets and prompt block | Deterministic feeding AI | Yes | Yes | Targets are prompt constraints, not persisted prescriptions |
| Exercise taxonomy (`exercise-taxonomy.ts`) | Static canonical exercise seed, aliases, patterns, muscles, equipment, cautions | Deterministic | Yes as seed/import source | Yes | Code-only and small seed; no DB versioning |
| Session logging (`sessions.functions.ts`) | Validates session JSON, stores session, mirrors finalized set logs, mirrors readiness to checkins | Deterministic persistence orchestration | Yes | Normalization should become pure function | Mirror can drift; pain flag conflates hard effort/pain |
| Adaptation engine (`adaptation/propose-next-block.server.ts`) | Computes adherence, e1RM delta, RPE drift, deload recommendation, proposals, markers | Deterministic | Yes | Yes, after separating DB reads from pure logic | Uses regex patterns and fallback JSON parsing |
| Week progression (`phased/program-next-week.functions.ts`) | Copies latest week forward after adherence gate; flags/cuts load from RPE drift | Deterministic | Yes | Yes | Writes copied JSON rather than decision rows |
| Feedback handling (`feedback.functions.ts`, `me.functions.ts`) | Stores plan/client feedback and status | Deterministic storage | Partially | No, but parser/gates should be pure | Free text needs AI only for interpretation |
| Assessment completion/intake (`intake.functions.ts`, `assessment-completion.ts`, `movement-criteria.ts`) | Saves assessment, derives completion and movement criteria | Mixed deterministic and AI-adjacent analysis | Yes | Movement/readiness scoring should be pure | Assessment source-of-truth is fragmented |
| AI adapter/callers (`server/ai`, `phased/ai.server.ts`, intake/session OCR/concierge) | Structured AI calls and logs | AI | Keep for non-deterministic tasks | No for dosage; yes for explanation wrapper | AI outputs may be treated as accepted state |
| PDF/export (`pdf.ts`, `download-plan.ts`) | Reads plan/day JSON and renders/export view model | Deterministic rendering | Yes | No, consumes engine outputs | Export may encode legacy plan shape assumptions |
| Dashboard/analytics (`engine-metrics.functions.ts`, compliance helpers, volume components) | Reads plans/sessions and computes summaries | Deterministic | Yes | Some analytics should use shared engines | Duplicate calculations can diverge |

## 6. AI Minimization Implications

Replace with deterministic function:

- Exercise identity, taxonomy lookup, equipment filtering, contraindication filtering.
- Weekly planned/performed volume by muscle and movement pattern.
- MEV/MAV/MRV comparison and volume target allocation.
- RPE/RIR target bands from phase, exercise class, risk tier, and trainer cockpit.
- Load/rep/set progression, deload gates, and readiness modifiers from structured inputs.
- Cardio zones, cardio load, and concurrent training conflict flags.
- Trainer override/audit event generation.

Hybrid: deterministic first, AI explanation second:

- Plan rationale, client-facing summaries, trainer-readable explanations of volume/progression decisions.
- Review of accumulating overrides or repeated low-adherence patterns.
- Missing-data hypotheses after deterministic gates identify missing required fields.

Keep AI:

- Intake free-text interpretation.
- Summarizing long trainer/client notes.
- OCR or multimodal parsing where source material is unstructured.
- Qualitative pattern detection from language, with trainer review.

Needs human/trainer judgment:

- Training philosophy, aggressiveness, visibility of metrics, override acceptance, and edge-case risk tolerance.

## 7. Proposed Canonical Architecture

Tables/entities needed:

- Existing to keep: `clients`, `assessments`, `screening_evaluations`, `workout_plans`, `workout_plan_days`, `workout_sessions`, `generation_log`, `audit_events`, `adaptation_proposals`, `adaptation_decisions`, `progress_markers`.
- New or hardened: `exercise_templates`, `exercise_template_versions`, `exercise_muscle_map`, `exercise_prescriptions`, `performed_sets` or hardened `session_set_logs`, `readiness_logs` or canonicalized `client_checkins`, `cardio_sessions`, `volume_audits`, `progression_decisions`, `trainer_overrides`.

Pure TypeScript engines needed:

- `exerciseTaxonomyEngine`
- `volumeEngine`
- `prescriptionEngine`
- `progressionEngine`
- `readinessEngine`
- `cardioEngine`
- `substitutionEngine`
- `concurrentTrainingEngine`
- `auditEngine`

Read/write boundaries:

- Server functions read canonical rows, call pure engines, then persist decisions and audit events.
- Pure engines must not import Supabase, React, routes, or AI adapters.
- JSON snapshots may be retained for display/export, but typed rows should own calculations.

Audit boundaries:

- Every engine decision should return `engineVersion`, `inputsHash`, decision payload, and warnings.
- Persist accepted decisions to domain tables and append `audit_events`.
- `generation_log` remains AI telemetry; it should not replace domain audit events.

Trainer override boundaries:

- Trainer edits that change deterministic output should create `trainer_overrides` with previous value, proposed value, final value, reason, actor, and engine version.
- Adaptation decisions can remain a specialized override/approval table, but general plan/prescription edits need a shared override contract.

AI boundaries:

- AI may propose or explain. It should not be the canonical owner of dosage, progression, screening, readiness gates, cardio zones, or volume math.
- Accepted AI suggestions should become structured rows or trainer decisions, not only JSON blobs.

## 8. Migration/Implementation Roadmap

| PR | Goal | Files likely touched | Risk level | Tests needed | Stop conditions |
| --- | --- | --- | --- | --- | --- |
| PR 1 - schema/source-of-truth gap audit | This docs-only audit | `docs/protocol/architecture/*` | Low | Existing test/build/check only | Any need for schema/code implementation |
| PR 2 - exercise taxonomy schema/import plan | Design DB schema and import contract from static taxonomy | Docs, migrations only if approved in that PR, taxonomy tests | Medium | Taxonomy identity/alias fixtures | Pattern/equipment vocab unclear |
| PR 3 - pure volume engine with tests | Extract robust planned/performed volume math from current helpers | `src/lib` or `src/server/engines`, tests | Medium | Role weighting, week grouping, partial/missed sessions, JSON adapter fixtures | Muscle role policy undecided |
| PR 4 - performed set/session log normalization | Make set logs canonical or define migration path | `sessions.functions.ts`, migrations, tests | High | Backward compatibility, draft/finalized sessions, mirror consistency | Existing logs cannot be mapped safely |
| PR 5 - progression decision engine with tests | Extract load/rep/set progression and deload gates | Progression/adaptation modules, tests | High | RPE drift, e1RM, adherence, readiness, deload scenarios | Progression philosophy undecided |
| PR 6 - cardio/readiness engine | Pure cardio zones/load and readiness gates | Cardio/readiness helpers, maybe schema docs/migrations | Medium | Karvonen zones, missing HR, soreness/readiness gates | Cardio owner table undecided |
| PR 7 - deterministic prescription integration | Persist deterministic prescriptions and audit decisions | Server functions, routes, migrations, tests | High | End-to-end plan creation, override audit, export compatibility | Normalized prescription schema not ready |
| PR 8 - AI minimization refactor | Move AI to explanation/free-text roles | AI callers, phased generation, docs/tests | High | Golden outputs, no network tests, audit coverage | Deterministic engines not feature-complete |

## 9. Human-Only Decisions Needed

- Default training philosophy for v1: hypertrophy-first, strength-first, health-first, mixed, or trainer-selectable.
- Conservative vs aggressive progression defaults by client profile and goal.
- Whether MEV/MAV/MRV ranges are global defaults, trainer-editable, client-specific, or knowledge-profile scoped.
- Whether prime/synergist/stabilizer weights are fixed or configurable.
- Whether readiness gates can automatically reduce prescriptions or only recommend trainer review.
- Which metrics are trainer-only vs client-visible.
- How much engine autonomy is allowed before trainer approval.
- What degree of cardio/strength conflict should block saving vs warn.
- What is too complex for v1, especially substitutions, RIR, soreness-by-muscle, and concurrent training.

## 10. Stop Conditions For Implementation

- Do not implement deterministic prescription until exercise identity and movement-pattern taxonomy are canonical enough to avoid raw-name joins.
- Do not normalize prescriptions until the target `exercise_prescription` shape preserves current export/logbook behavior.
- Do not make `session_set_logs` the source of truth until draft/finalized session behavior and historical JSON migration are specified.
- Do not implement progression defaults until human policy decisions exist for aggression, deload sensitivity, and RPE/RIR targets.
- Do not add cardio conflict rules until cardio session ownership and zone methodology are defined.
- Do not use AI to fill schema gaps in dosage, safety, progression, volume, or readiness logic.
- Do not begin migrations without backfill, rollback, and compatibility plans for existing `plan_data`, `workout_plan_days.content`, and `workout_sessions.entries`.
