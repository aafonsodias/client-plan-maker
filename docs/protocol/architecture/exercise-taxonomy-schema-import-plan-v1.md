# Exercise Taxonomy Schema Import Plan v1

Date: 2026-05-26

Scope: documentation only. This plan defines how Protocol should move from code-only and free-text exercise handling toward a canonical, versioned, auditable exercise taxonomy. It does not create migrations, change runtime behavior, import private spreadsheet data, or alter the current plan/session schemas.

## 1. Executive Summary

Protocol needs a canonical exercise taxonomy before the deterministic prescription engine can become reliable. Exercise names currently appear as free text in generated plan JSON, edited day content, session logs, OCR context, exports, and analytics. Free text is useful for display, but it is not stable enough for deterministic volume calculation, progression continuity, substitution safety, contraindication filtering, exercise search, media mapping, or audit trails.

The existing `src/lib/exercise-taxonomy.ts` is a strong seed: it already has stable keys, aliases, movement patterns, equipment tags, primary and secondary muscle arrays, caution flags, and a version constant. It is not enough as the long-term source of truth because it is code-only, small, not trainer-reviewable in product, not import-versioned, and not linked to persisted prescriptions or performed sets.

Exercise taxonomy should become database-versioned and auditable. A plan generated under taxonomy version N should remain explainable even after taxonomy version N+1 changes an alias, retires an exercise, adjusts a muscle map, or adds a substitution edge. The deterministic engines should read approved taxonomy rows and return decisions with engine versions and input hashes.

AI must not be the source of truth for exercises. AI may suggest aliases, normalize messy imported names, propose initial muscle maps, or explain substitution rationale, but those suggestions must be staged for trainer or admin approval before they affect canonical taxonomy, dosage, safety gates, or volume math.

## 2. Current State Audit

| Source | Current role | Canonical? | Structured or free-text? | Versioned? | Safe for deterministic calculations? | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/exercise-taxonomy.ts` | Static exercise seed with keys, aliases, movement patterns, equipment, muscles, caution flags, media quality status, and lookup helpers | Partially, as code seed only | Structured TypeScript objects | Code version constant only | Safe for fixtures and early adapters, not durable production truth | Not DB-backed, not import-audited, small coverage, no trainer/admin approval workflow |
| `src/lib/equipment-catalog.ts` | Static equipment vocabulary and label helpers | Partially | Structured TypeScript objects | No DB version | Useful for UI constraints and import mapping | Not joined to exercise templates or assessment equipment as canonical keys everywhere |
| `workout_plan_days.content.exercises` | Current phased plan exercise prescription surface | No | JSON with exercise `name`, `sets`, `reps`, `rest`, `rpe`, `primary_muscles`, `secondary_muscles`, `equipment`, notes, cues, rationale | Day row has timestamps, but content schema is not taxonomy-versioned | Partially; calculations depend on generated strings and JSON arrays | Needs `exercise_key` or prescription rows linked to canonical templates |
| `workout_plans.plan_data` | Legacy/full plan presentation and export shape | No | JSON | No taxonomy version | Partially for rendering; weak for canonical calculations | Duplicates day content and can preserve older exercise names without stable identity |
| `src/server/phased/schemas.ts` | Zod contract for generated day exercises | No | Structured validation around free-text names and arrays | Code version only | Useful contract, but not source of truth | Schema validates shape, not identity, alias resolution, or approved muscle maps |
| `src/server/phased/stage3-microcycle.functions.ts` | AI day generation plus deterministic guardrails for RPE floors, set caps, injury bans, rotation, and volume prompt constraints | No | Mixed deterministic rules over generated JSON/free text | Generation metadata only | Guardrails are useful but exercise selection remains AI/free-text | Deterministic prescription should choose/filter from taxonomy instead of asking AI to invent names |
| `src/server/phased/exercise-filters.server.ts` | Injury-driven deny lists and alternatives | No | Structured static rules plus string matching | Code only | Useful as seed for contraindication and substitution tags | Separate from taxonomy; not versioned or trainer-reviewable |
| `src/server/phased/stage4-progressions.functions.ts` and `src/server/phased/stage5-bulkfill.functions.ts` | Builds progression rows and future weeks from exercise names | No | Deterministic logic over generated names and regex categories | Generation log only | Useful progression logic, weak identity | Exercise IDs are derived from day number and sanitized name, not stable taxonomy identity |
| `src/server/sessions.functions.ts` | Stores sessions and mirrors finalized sets into `session_set_logs` | Partially for performed data | Mixed JSON and normalized mirror; uses `exercise_name`, `exercise_slug`, inferred pattern | Session timestamps, no taxonomy version | Useful for early performed-set adapters | No template FK, no prescription FK, slug can drift from canonical exercise identity |
| `src/integrations/supabase/types.ts` | Generated database type map for plans, days, sessions, and set logs | Reflects current database | `workout_plan_days.content` and `workout_sessions.entries` are JSON; `session_set_logs` is row-shaped | Database migration history | Useful for audit of current gaps | No taxonomy tables or exercise template relationships |
| `src/components/AddExerciseDialog.tsx` and `src/components/DayCardEditable.tsx` | Trainer free-text exercise edits | No | Free-text fields and dosage strings | Day update only | Useful workflow, unsafe as canonical taxonomy mutation | Trainer-created exercises need staging/local identity policy |
| `src/components/log/ExerciseSetsCard.tsx`, `src/routes/log.$token.tsx`, `src/components/ImportLogDialog.tsx` | Client/trainer logging by exercise name | No | Free-text display names from plan content | Session row only | Good UX surface, weak identity for history | Needs hidden canonical exercise/prescription identity while preserving display names |
| `src/lib/volume-compute.ts` and `src/lib/volume-actual.ts` | Planned and actual volume computation | No | Deterministic helpers over plan/session JSON and muscle arrays | Code only | Reusable logic | Needs canonical muscle maps and effective set weights |
| `src/lib/exercise-demo.ts` and `src/components/SessionDayView.tsx` | YouTube search links from exercise names | No | Free-text search URL | No | Safe for fallback presentation only | Needs approved media rows for reliable demos |
| Private trainer spreadsheets under `private-reference/trainer-spreadsheets/` | Operational evidence of spreadsheet-style exercise libraries, muscle maps, equipment and prescription formulas | No | Workbook sheets with structural library/prescription patterns | Private files, not committed | Useful for pattern extraction only | Must remain private; import must stage structure without client data |

## 3. Proposed Canonical Taxonomy Model

| Entity | Purpose | Required fields | Optional fields | Source-of-truth role | Audit/versioning needs | Migration risk |
| --- | --- | --- | --- | --- | --- | --- |
| `exercise_templates` | Stable canonical exercise identity | `id`, `exercise_key`, `status`, `taxonomy_version_id`, `display_name_default`, `created_at`, `updated_at` | `name_pt`, `name_en`, `description`, `level`, `umbrella_category`, `created_by`, `visibility_scope`, `retired_at`, `replacement_exercise_id` | Owns the exercise as a thing, independent from display text | Immutable key after approval; status transitions audited | High: must not break existing free-text plan/session rendering |
| `exercise_aliases` | Approved names that resolve to a template | `id`, `exercise_template_id`, `alias`, `normalized_alias`, `locale`, `status` | `source`, `confidence`, `approved_by`, `approved_at`, `import_batch_id` | Owns alias resolution after approval | Alias add/merge/reject events; uniqueness on normalized alias per scope | Medium: duplicate aliases can silently map wrong exercises |
| `exercise_muscle_map` | Maps exercises to muscles and contribution roles | `id`, `exercise_template_id`, `muscle_key`, `role`, `effective_set_weight`, `taxonomy_version_id` | `side`, `region`, `confidence`, `evidence_source`, `trainer_override_id`, `notes` | Owns deterministic volume contribution | Version every weight/role change; retain old maps for old plans | High: wrong weights corrupt volume and progression decisions |
| `exercise_movement_patterns` | Controlled movement-pattern membership | `id`, `exercise_template_id`, `pattern_key`, `is_primary`, `taxonomy_version_id` | `confidence`, `notes` | Owns movement pattern volume and progression grouping | Version changes; controlled vocabulary migrations | Medium |
| `exercise_equipment_tags` | Equipment and setup requirements | `id`, `exercise_template_id`, `equipment_key`, `requirement_type` | `setup_notes`, `loadable`, `substitution_relevance`, `minimum_equipment_group` | Owns deterministic equipment filtering | Version changes and vocabulary edits | Medium |
| `exercise_constraint_tags` | Safety, contraindication, skill, and caution metadata | `id`, `exercise_template_id`, `constraint_key`, `severity`, `taxonomy_version_id` | `body_region`, `condition_key`, `evidence_source`, `notes` | Owns deterministic filtering and warning gates | Audit each tag add/remove; evidence required for high-severity tags | High: safety-sensitive |
| `exercise_media` | Approved demos, images, videos, and technique references | `id`, `exercise_template_id`, `media_type`, `provider`, `url_or_asset_key`, `status` | `locale`, `quality_status`, `caption`, `source`, `verified_by`, `verified_at` | Owns reliable demo links and future media | Media verification status and replacement history | Low to medium |
| `exercise_substitution_edges` | Approved substitution graph | `id`, `from_exercise_template_id`, `to_exercise_template_id`, `reason_key`, `status` | `equivalence_score`, `goal_context`, `equipment_context`, `contraindication_context`, `notes`, `approved_by` | Owns substitution recommendations | Version substitutions and retain deprecated edges | High: substitutions affect safety and training intent |
| `exercise_taxonomy_versions` | Publishes a coherent taxonomy snapshot | `id`, `version_label`, `status`, `created_at`, `created_by` | `published_at`, `published_by`, `changelog`, `source_hash`, `previous_version_id` | Owns version boundary used by plans and audits | Draft/active/retired transitions; immutable published snapshots | Medium |
| `exercise_import_batches` | Tracks staged imports from spreadsheets or future libraries | `id`, `source_type`, `source_name`, `status`, `created_at`, `created_by` | `source_checksum`, `staged_count`, `approved_count`, `rejected_count`, `error_summary`, `taxonomy_version_id`, `rollback_of_batch_id` | Owns import provenance without storing private source files | Import lifecycle audit and rollback link | Medium |

## 4. Exercise Identity Rules

- `exercise_key` is the stable canonical identifier. It should be ASCII, lowercase, unique, durable, and never derived at read time from mutable display text.
- `display_name_default` is presentation text, not identity.
- Locale-specific names belong on template fields or approved alias rows, not in separate ungoverned UI maps.
- `normalized_name` should be produced by a deterministic normalizer that lowercases, strips accents/punctuation where appropriate, collapses whitespace, and removes harmless suffix formatting without deleting meaningful variants.
- Aliases resolve only after approval. Unapproved aliases remain in import staging or local trainer-created exercise review queues.
- Unknown exercises should use an explicit fallback such as `unknown:<normalized_name>` in adapters, but this must not become canonical automatically.
- Duplicate detection should compare normalized aliases, movement pattern, equipment, muscle map, and imported source hints before creating a new template.
- Trainer-created exercises need a policy: local-to-trainer only by default, with optional promotion to global taxonomy after review.
- Imported library exercises should enter staging first, then become approved templates only through an import batch and taxonomy version.
- Retired or deprecated exercises should retain their historical key and point to a replacement when appropriate. Historical plans and sessions must keep resolving under the taxonomy version they used.
- Published taxonomy versions should be immutable. Corrections create a new version or explicit patch event.

## 5. Muscle Mapping Rules

Protocol should model muscle contribution as a versioned map, not as ad hoc plan JSON arrays.

Required role strategy:

- Prime movers: primary target tissues for the exercise; eligible for full hard-set contribution when the set is within the effective intensity range.
- Synergists: meaningful secondary contributors; default contribution may be fractional.
- Stabilizers: involved tissues that should usually not receive full hypertrophy volume credit.
- Antagonists: optional metadata for movement balance and substitution reasoning, not default volume credit.
- Left/right or unilateral notes: track whether an exercise is unilateral, alternating, loaded asymmetrically, or side-specific.
- Region/group abbreviations: use controlled `muscle_key` values, with aliases for imported abbreviations.
- Effective set weights: store as explicit numeric values with role, confidence, evidence, and taxonomy version.
- Confidence level: required for imported or AI-suggested maps; low-confidence rows cannot become production defaults without review.
- Source/evidence field: required for defaults that drive volume math.
- Trainer override: allowed only as a tracked override, either local to a trainer/client or proposed for taxonomy review.

Prime/synergist/stabilizer default weights are product and evidence decisions. They should not become production defaults until Protocol decides the weighting policy and has enough evidence to defend it.

## 6. Movement, Equipment, and Constraint Taxonomy

Controlled vocabularies should be narrow enough for deterministic filtering and broad enough for trainer use.

Controlled vocabulary candidates:

- Movement pattern: squat, hinge, lunge, horizontal_push, vertical_push, horizontal_pull, vertical_pull, carry, rotation, anti_rotation, gait, jump, isolation_push, isolation_pull, core_flexion, core_extension, mobility, conditioning.
- Joint action, where useful: knee_extension, knee_flexion, hip_extension, hip_flexion, shoulder_abduction, shoulder_horizontal_adduction, elbow_flexion, elbow_extension, ankle_plantarflexion, trunk_rotation.
- Body region: lower, upper, core, full_body.
- Equipment: mapped to `equipment-catalog` keys, including bodyweight, barbell, dumbbells, kettlebells, bench, cable_machine, bands, pull_up_bar, machines, cardio_machine, suspension_trainer.
- Setup: bilateral, unilateral, alternating, supported, unsupported, seated, standing, prone, supine, incline, decline.
- Skill level: beginner, intermediate, advanced, rehab_caution, technical.
- Loading type: external_load, bodyweight, assisted_bodyweight, machine_guided, cable, ballistic, isometric, carries, cyclical_cardio.
- Range of motion type: full_rom, partial_rom, long_length_bias, short_length_bias, pain_free_rom, tempo_controlled.
- Contraindication/risk tags: lumbar_flexion_load, spinal_compression, overhead_load, knee_deep_flexion, shoulder_abduction_external_rotation, high_impact, balance_demand, grip_demand, high_valsalva_demand.
- Substitution tags: same_pattern, same_prime_mover, similar_equipment, lower_skill_variant, lower_load_variant, home_equipment_variant, pain_modified_variant.

Controlled by Protocol/admin:

- Canonical keys, movement patterns, muscle keys, role names, effective set weight defaults, risk tags, substitution edge status, published taxonomy versions.

Trainer-editable:

- Local aliases, local exercise notes, trainer-created exercises in a staging/local scope, local substitutions, and local overrides with audit records.

## 7. Import Strategy

Private source files must stay private and uncommitted. Imports should use structure and approved rows, not raw client workbook content.

Safe import sequence:

1. Source file remains in `private-reference/` or another private location and is never committed.
2. Import script reads workbook structure locally and maps configured columns to staging fields.
3. Staging rows are created with source metadata, normalized names, candidate aliases, candidate muscle maps, equipment tags, and validation status.
4. Required-field validation checks exercise name, normalized alias, candidate key, at least one movement or muscle signal, and source batch.
5. Duplicate detection compares normalized aliases, candidate keys, movement pattern, equipment, and muscle maps against existing templates.
6. Alias merging proposes existing-template matches instead of creating new templates automatically.
7. Unknown muscle abbreviations are blocked into a review queue, not guessed into production fields.
8. Review queue separates approve, reject, merge, needs-evidence, and local-only decisions.
9. Approved import batch creates or updates draft taxonomy rows under a draft `exercise_taxonomy_versions` record.
10. Publishing a version freezes the approved rows and records counts, errors, source hash, reviewer, and changelog.
11. Rollback deactivates the published version or restores the previous active version. It should not delete historical rows used by plans.

The import path should support future non-spreadsheet libraries with the same staging and approval rules.

## 8. Deterministic Engine Dependencies

- `exerciseTaxonomyEngine`: resolves exercise keys, aliases, retired templates, unknown fallbacks, and taxonomy version snapshots.
- `volumeEngine`: uses `exercise_muscle_map` and effective set weights to calculate planned and performed volume by muscle and pattern.
- `substitutionEngine`: uses equipment tags, constraint tags, substitution edges, movement patterns, and muscle maps.
- `progressionEngine`: needs stable exercise identity, movement pattern, loading type, skill level, and history continuity across aliases and versions.
- `prescriptionEngine`: needs searchable templates filtered by client equipment, contraindications, goal, movement pattern, volume targets, and trainer constraints.
- `readinessEngine`: needs constraint tags and body-region mapping to reduce, warn, or block exercises when recovery or pain signals are present.
- `auditEngine`: needs taxonomy version, template IDs, input hashes, override IDs, and decision payloads.
- PDF and session presentation: uses canonical display names, localized names, approved aliases, media, and versioned display snapshots.
- Multilingual exercise names: use aliases and locale-specific display fields without changing identity.
- Future media/demo integration: reads approved `exercise_media`, falling back to search only when no verified media exists.

## 9. AI Minimization

Must be deterministic:

- Exercise lookup after aliases are approved.
- Alias resolution for persisted plans and sessions.
- Muscle volume contribution.
- Substitution graph traversal and filtering.
- Contraindication filtering.
- Equipment filtering.
- Retired exercise replacement suggestions from approved edges.
- Unknown exercise fallback and review queue placement.

Trainer judgment required:

- Approving new exercises.
- Overriding muscle maps.
- Deciding whether a substitution is acceptable for the client and goal.
- Resolving ambiguous imported exercises.
- Promoting trainer-local exercises to global taxonomy.
- Approving high-impact safety or contraindication tags.

AI may assist:

- Suggesting aliases for staged imports.
- Proposing initial muscle maps for review.
- Normalizing messy imported names.
- Suggesting likely substitutions.
- Explaining why two exercises may or may not be equivalent.
- Summarizing review rationale for trainers/admins.

AI output must always remain staged until a trainer/admin approves it. It must not write directly to canonical exercise templates, muscle maps, constraint tags, substitution edges, or taxonomy versions.

## 10. Schema/Migration Roadmap

| PR | Goal | Expected files | Risk level | Tests needed | Stop conditions |
| --- | --- | --- | --- | --- | --- |
| PR 1 - taxonomy import plan doc | Record this design and approval path | `docs/protocol/architecture/exercise-taxonomy-schema-import-plan-v1.md` | Low | Existing test/build/check only | Any need to implement schema or import code |
| PR 2 - schema migration draft for taxonomy tables | Add draft tables for templates, aliases, maps, tags, versions, imports | `supabase/migrations/*`, generated types, schema docs | High | Migration smoke, RLS/permissions, type generation, rollback review | Field list, approval policy, or versioning policy not approved |
| PR 3 - seed/import script dry run | Build private-safe dry-run import from code taxonomy and structural spreadsheet mappings | `scripts/*`, tests, docs | Medium | Dry-run fixture, no private data output, duplicate detection | Import would expose private data or require package installs |
| PR 4 - import staging and validation report | Stage candidate taxonomy rows and produce validation report without making them active | Import scripts, docs/reports, tests | Medium | Missing fields, duplicate detection, alias merge, unknown abbreviations | Review queue policy missing |
| PR 5 - pure volume engine reads taxonomy fixtures | Make volume math depend on taxonomy fixtures, not generated muscle arrays | `src/lib` or engine folder, tests | Medium | Planned/performed volume, effective set weights, unknown exercise fallback | Effective set weights undecided |
| PR 6 - replace free-text plan references with `exercise_key` where safe | Add canonical identity alongside display names for new plans | Server generation/adapters, day/session schema tests | High | Backward compatibility, export/log UI, legacy plan migration fixtures | Existing plans cannot be read safely |
| PR 7 - substitution engine | Use approved substitution edges and constraint tags for deterministic suggestions | Engine module, tests, maybe route/server integration | High | Equipment filtering, contraindication filtering, same-pattern replacement, audit payload | Safety tags or trainer approval policy unclear |
| PR 8 - trainer-created exercise workflow | Let trainers create local exercises and submit candidates for approval | Routes/components/server functions, audit tests | High | Local scope, promotion, alias conflicts, override audit | Product has not decided global vs local editability |

## 11. Testing Plan

- Alias normalization: accents, punctuation, casing, language variants, suffixes, and whitespace.
- Duplicate detection: exact alias, normalized alias, near-duplicate key, same name with different equipment, and variant names.
- Muscle map validation: required muscle keys, role validity, weight range, confidence, and published-version immutability.
- Effective set calculation fixture: prime/synergist/stabilizer weighting, unilateral handling, optional/failed sets, and unknown exercise behavior.
- Substitution filtering: same movement pattern, same prime mover, equipment availability, contraindications, skill level, and retired exercise replacement.
- Unknown exercise fallback: display remains intact, calculations warn, review queue receives candidate, and no silent canonical write occurs.
- Import batch validation: missing required columns, unknown abbreviations, duplicate candidates, rejected rows, approved rows, rollback.
- Versioning/retirement behavior: old plans resolve under old version, new plans use active version, retired exercise keeps history and replacement link.
- Session continuity: history lookup resolves approved aliases to the same exercise template without breaking legacy free-text sessions.
- Audit payloads: engine decisions include taxonomy version and input hash.

## 12. Human-Only Decisions Needed

- Default muscle abbreviation vocabulary.
- Default effective set weights for prime movers, synergists, and stabilizers.
- Whether trainers can edit taxonomy globally, locally, or only through admin review.
- Whether imported exercises require admin approval before global use.
- Visibility of muscle-volume metrics to trainers and clients.
- Strictness for unknown exercises: warn only, block deterministic calculations, or require trainer resolution before approval.
- Default movement-pattern vocabulary and whether patterns can be multi-valued.
- Media/demo provider direction and quality threshold.
- Whether substitution edges are global defaults, trainer-local, or client-specific.
- How much taxonomy complexity is acceptable in v1.

## 13. Stop Conditions Before Implementation

- No approved canonical field list for taxonomy tables.
- No decision on effective set weights.
- No decision on trainer-created exercise scope.
- No import approval policy.
- No unknown exercise policy.
- No migration and rollback plan for taxonomy versions.
- No private-safe import staging process.
- No decision on whether existing generated muscle arrays remain as display snapshots or become ignored for calculations.
- No compatibility plan for legacy `workout_plan_days.content`, `workout_plans.plan_data`, and `workout_sessions.entries`.
