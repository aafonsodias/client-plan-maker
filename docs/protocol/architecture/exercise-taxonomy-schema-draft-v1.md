# Exercise Taxonomy Schema Draft v1

Date: 2026-05-26

Scope: documentation only. This draft describes the intended database schema for canonical exercise taxonomy tables. It does not create migrations, update generated Supabase types, seed data, run imports, or change runtime behavior.

## 1. Executive Summary

Protocol needs canonical database tables for exercise taxonomy because deterministic prescription cannot rely on raw exercise names in plan JSON, session JSON, or code-only seed data. Stable exercise identity, approved aliases, versioned muscle maps, equipment tags, contraindication tags, substitution edges, and import provenance are prerequisites for deterministic volume calculation, substitution filtering, progression continuity, audit trails, and trainer-visible metrics.

This schema is drafted before writing SQL so the team can review table boundaries, ownership, RLS expectations, versioning, and backward compatibility without creating production obligations too early. The prior decision register approved v1 defaults: 10 muscle groups, effective set weights of prime `1.0`, synergist `0.5`, stabilizer `0.0`, unknown exercise preservation without strict volume credit, trainer-local drafts, staged imports, approved substitution edges, immutable published versions, required audit records, and trainer-first visibility for volume metrics.

This unlocks the next deterministic engine work: a taxonomy read service, pure volume fixtures, import validation, substitution filtering, and eventually canonical prescription rows. Out of scope for this document: SQL migration files, RLS implementation, app integration, seed/import scripts, UI approval workflows, plan/session backfills, and any private spreadsheet extraction.

## 2. Proposed Tables

| Table | Purpose | Required columns | Optional columns | Primary key | Foreign keys | Unique constraints | Indexes | RLS assumptions | Audit/versioning needs | Migration risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `exercise_taxonomy_versions` | Published or draft taxonomy snapshot boundary | `id`, `version_label`, `status`, `created_at`, `created_by` | `published_at`, `published_by`, `retired_at`, `retired_by`, `previous_version_id`, `source_import_batch_id`, `changelog`, `source_hash`, `notes` | `id uuid` | `created_by`, `published_by`, `retired_by` -> `auth.users`; `previous_version_id` -> self; `source_import_batch_id` -> `exercise_import_batches` | `version_label`; one active version via partial unique index on `status='active'` | `status`; `published_at desc`; `previous_version_id` | Authenticated trainers can read active/published versions. Admins manage drafts and publishing. Service role may read/write for import jobs. | Published versions immutable except retirement/supersede metadata. Publishing writes audit event. | High: versioning is hard to retrofit if skipped. |
| `exercise_import_batches` | Tracks source/import lifecycle without storing private files | `id`, `source_type`, `source_name`, `status`, `created_at`, `created_by` | `source_checksum`, `parser_version`, `validation_summary`, `staged_count`, `approved_count`, `rejected_count`, `error_summary`, `taxonomy_version_id`, `supersedes_batch_id`, `notes` | `id uuid` | `created_by` -> `auth.users`; `taxonomy_version_id` -> `exercise_taxonomy_versions`; `supersedes_batch_id` -> self | Optional unique `source_checksum` for approved batches | `status`; `created_at desc`; `created_by`; `taxonomy_version_id` | Admin/staff can manage. Trainers can read batches only if they own a local import scope in future. Raw source file never stored. | Status transitions audited. Published batch should not be mutated except rollback/supersede metadata. | Medium: import governance affects private data safety. |
| `exercise_templates` | Canonical or trainer-local exercise identity | `id`, `exercise_key`, `display_name`, `normalized_name`, `locale`, `type`, `status`, `owner_scope`, `taxonomy_version_id`, `created_at`, `updated_at` | `level`, `description`, `created_by`, `owner_trainer_id`, `source`, `import_batch_id`, `retired_at`, `retired_by`, `replacement_exercise_id`, `metadata` | `id uuid` | `taxonomy_version_id` -> `exercise_taxonomy_versions`; `created_by`, `retired_by`, `owner_trainer_id` -> `auth.users`; `import_batch_id` -> `exercise_import_batches`; `replacement_exercise_id` -> self | Global approved `exercise_key` unique per taxonomy version; trainer-local `exercise_key` unique per `owner_trainer_id`; `normalized_name + locale + owner_scope + owner_trainer_id` partial unique where appropriate | `exercise_key`; `normalized_name`; `status`; `owner_scope`; `owner_trainer_id`; `taxonomy_version_id` | Global approved rows readable by authenticated users. Trainer-local rows readable/manageable only by owner trainer and service role. Admins can manage global rows. | Published global rows immutable by version. Local drafts mutable but audited when promoted/approved. | High: identity and local/global scope bugs can corrupt joins. |
| `exercise_aliases` | Approved or staged names resolving to a template | `id`, `exercise_template_id`, `alias`, `normalized_alias`, `locale`, `status`, `created_at` | `confidence`, `source`, `created_by`, `approved_by`, `approved_at`, `owner_scope`, `owner_trainer_id`, `import_batch_id`, `notes` | `id uuid` | `exercise_template_id` -> `exercise_templates`; `created_by`, `approved_by`, `owner_trainer_id` -> `auth.users`; `import_batch_id` -> `exercise_import_batches` | Approved global `normalized_alias + locale + taxonomy_version_id` unique through template/version; trainer-local alias unique per trainer/template/locale | `normalized_alias`; `exercise_template_id`; `status`; `locale`; `owner_trainer_id` | Same scope as template. Global approved aliases readable by authenticated users; trainer-local aliases only by owner. Admins approve global aliases. | Alias approve/merge/reject events audited. Published aliases immutable by version. | High: alias collisions can map sessions to wrong exercises. |
| `exercise_muscle_map` | Versioned muscle contribution and role weights | `id`, `exercise_template_id`, `muscle_key`, `role`, `effective_set_weight`, `taxonomy_version_id`, `status`, `created_at` | `confidence`, `source`, `approved_by`, `approved_at`, `region_key`, `side`, `evidence_source`, `notes` | `id uuid` | `exercise_template_id` -> `exercise_templates`; `taxonomy_version_id` -> `exercise_taxonomy_versions`; `approved_by` -> `auth.users` | `exercise_template_id + muscle_key + role + taxonomy_version_id` | `exercise_template_id`; `muscle_key`; `role`; `taxonomy_version_id`; `status` | Global approved rows readable by authenticated users. Admins manage global maps. Trainer-local maps require explicit owner fields if allowed later. | Role/weight changes require new taxonomy version or explicit patch event. | High: wrong weights directly affect volume decisions. |
| `exercise_movement_patterns` | Movement-pattern membership for grouping, progression, and filters | `id`, `exercise_template_id`, `pattern_key`, `is_primary`, `taxonomy_version_id`, `status` | `confidence`, `source`, `approved_by`, `approved_at`, `notes` | `id uuid` | `exercise_template_id` -> `exercise_templates`; `taxonomy_version_id` -> `exercise_taxonomy_versions`; `approved_by` -> `auth.users` | `exercise_template_id + pattern_key + taxonomy_version_id` | `pattern_key`; `exercise_template_id`; `taxonomy_version_id`; partial index where `is_primary=true` | Global approved rows readable by authenticated users; admin-managed writes. | Pattern changes versioned and audited. | Medium: pattern drift affects progression and analytics. |
| `exercise_equipment_tags` | Required/optional equipment and setup tags | `id`, `exercise_template_id`, `equipment_key`, `requirement_type`, `taxonomy_version_id`, `status` | `loadable`, `setup_notes`, `minimum_equipment_group`, `source`, `approved_by`, `approved_at` | `id uuid` | `exercise_template_id` -> `exercise_templates`; `taxonomy_version_id` -> `exercise_taxonomy_versions`; `approved_by` -> `auth.users` | `exercise_template_id + equipment_key + requirement_type + taxonomy_version_id` | `equipment_key`; `exercise_template_id`; `requirement_type`; `taxonomy_version_id` | Global approved rows readable by authenticated users; admin-managed writes. | Equipment changes versioned and audited. | Medium: equipment mismatches affect prescription eligibility. |
| `exercise_constraint_tags` | Contraindication, caution, risk, and skill constraints | `id`, `exercise_template_id`, `constraint_key`, `severity`, `taxonomy_version_id`, `status` | `body_region`, `condition_key`, `evidence_source`, `source`, `approved_by`, `approved_at`, `notes` | `id uuid` | `exercise_template_id` -> `exercise_templates`; `taxonomy_version_id` -> `exercise_taxonomy_versions`; `approved_by` -> `auth.users` | `exercise_template_id + constraint_key + taxonomy_version_id` | `constraint_key`; `severity`; `body_region`; `exercise_template_id`; `taxonomy_version_id` | Global approved rows readable by authenticated users; admin-managed writes. | Safety-sensitive changes require audit and possibly review reason. | High: unsafe tags can cause harmful substitutions/prescriptions. |
| `exercise_media` | Verified or candidate demo/media references | `id`, `exercise_template_id`, `media_type`, `provider`, `status`, `created_at` | `url_or_asset_key`, `locale`, `quality_status`, `caption`, `source`, `verified_by`, `verified_at`, `expires_at`, `notes` | `id uuid` | `exercise_template_id` -> `exercise_templates`; `verified_by` -> `auth.users` | Optional unique `exercise_template_id + provider + url_or_asset_key` | `exercise_template_id`; `status`; `locale`; `provider`; `quality_status` | Approved global media readable by authenticated users. Admins manage global media. Trainer-local media can be scoped later. | Verification and link replacement audited. Not critical for engine v1. | Low to medium: link rot and provider lock-in. |
| `exercise_substitution_edges` | Approved graph of acceptable substitutions | `id`, `from_exercise_id`, `to_exercise_id`, `status`, `taxonomy_version_id`, `created_at` | `reason_tags`, `constraint_tags`, `goal_context`, `equipment_context`, `confidence`, `source`, `approved_by`, `approved_at`, `owner_scope`, `owner_trainer_id`, `notes` | `id uuid` | `from_exercise_id`, `to_exercise_id` -> `exercise_templates`; `taxonomy_version_id` -> `exercise_taxonomy_versions`; `approved_by`, `owner_trainer_id` -> `auth.users` | `from_exercise_id + to_exercise_id + taxonomy_version_id + owner_scope + owner_trainer_id` | `from_exercise_id`; `to_exercise_id`; `status`; `taxonomy_version_id`; `owner_trainer_id`; GIN indexes for tag arrays if implemented as arrays/jsonb | Global approved edges readable by authenticated users. Admins manage global edges. Trainer-local edges only by owner. | Approve/reject/retire audited. AI suggestions may stage but never activate directly. | High: substitutions affect safety and intent. |

## 3. Field-Level Draft

### `exercise_templates`

| Field | Draft type | Required? | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key, default generated UUID. |
| `exercise_key` | `text` | Yes | Stable identity key. Lowercase ASCII slug. Immutable once approved/published. |
| `display_name` | `text` | Yes | Default display name for current locale/context. Not identity. |
| `normalized_name` | `text` | Yes | Deterministic normalized form for duplicate detection and fallback mapping. |
| `locale` | `text` | Yes | Recommended default `pt` or `en`; open question whether constrained enum. |
| `level` | `text` | Optional | Seed from current `LEVELS`: beginner, intermediate, advanced, rehab_sensitive, performance. |
| `type` | `text` | Yes | Suggested: strength, mobility, cardio_conditioning, balance_coordination, power_speed, motor_control, preparation_recovery, play_games. |
| `status` | `text` | Yes | Suggested: draft, staged, approved, active, retired, rejected. Exact enum vs lookup table unresolved. |
| `created_by` | `uuid` | Optional | User who created row; nullable for system seed/import service if needed. |
| `owner_scope` | `text` | Yes | Suggested: global, trainer_local, import_staging. |
| `owner_trainer_id` | `uuid` | Optional | Required for trainer-local rows; null for global rows. |
| `taxonomy_version_id` | `uuid` | Optional at draft, required once published | Links global approved rows to version. Trainer-local drafts may be null or linked to source version. |
| `source` | `text` | Optional | Suggested: code_seed, import_batch, trainer_created, admin_created, ai_suggested_staged. |
| `import_batch_id` | `uuid` | Optional | Provenance for imported rows. |
| `replacement_exercise_id` | `uuid` | Optional | For retired rows. |
| `created_at` | `timestamptz` | Yes | Default now. |
| `updated_at` | `timestamptz` | Yes | Existing repo has update timestamp patterns. |
| `retired_at` | `timestamptz` | Optional | Set when status becomes retired. |

### `exercise_muscle_map`

| Field | Draft type | Required? | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `exercise_template_id` | `uuid` | Yes | FK to `exercise_templates`. |
| `muscle_key` | `text` | Yes | Approved v1 set: `chest`, `back`, `quads`, `hamstrings`, `glutes`, `shoulders`, `biceps`, `triceps`, `calves`, `core`. |
| `role` | `text` | Yes | Suggested: prime_mover, synergist, stabilizer, antagonist. |
| `effective_set_weight` | `numeric(4,3)` | Yes | Defaults by role: `1.000`, `0.500`, `0.000`, `0.000`. Stored value keeps future configurability. |
| `confidence` | `numeric(4,3)` | Optional | 0-1 confidence for imported/suggested mappings. |
| `source` | `text` | Optional | code_seed, import_batch, admin_review, trainer_override, ai_suggested_staged. |
| `approved_by` | `uuid` | Optional | Required for approved global mappings. |
| `approved_at` | `timestamptz` | Optional | Required for approved global mappings. |
| `taxonomy_version_id` | `uuid` | Yes for global published maps | Version boundary. |
| `status` | `text` | Yes | draft, staged, approved, active, retired, rejected. |
| `evidence_source` | `text` | Optional | Short reference key or product decision note. |
| `region_key` | `text` | Optional | Future subregion support without v1 hierarchy. |
| `side` | `text` | Optional | bilateral, left, right, unilateral, alternating. |

### `exercise_aliases`

| Field | Draft type | Required? | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `alias` | `text` | Yes | Human-facing alias. |
| `normalized_alias` | `text` | Yes | Deterministic normalized key for lookup/collision detection. |
| `locale` | `text` | Yes | Locale-scoped to reduce multilingual collisions. |
| `exercise_template_id` | `uuid` | Yes | FK to target template. |
| `confidence` | `numeric(4,3)` | Optional | Import/AI suggestion confidence. |
| `source` | `text` | Optional | code_seed, import_batch, trainer_created, admin_created, ai_suggested_staged. |
| `status` | `text` | Yes | staged, approved, active, rejected, retired. |
| `owner_scope` | `text` | Yes | global or trainer_local. |
| `owner_trainer_id` | `uuid` | Optional | Required for trainer-local aliases. |
| `approved_by` | `uuid` | Optional | Required for global approved aliases. |
| `approved_at` | `timestamptz` | Optional | Required for global approved aliases. |

### `exercise_substitution_edges`

| Field | Draft type | Required? | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `from_exercise_id` | `uuid` | Yes | Source exercise. |
| `to_exercise_id` | `uuid` | Yes | Candidate substitute. Must not equal source. |
| `reason_tags` | `text[]` or `jsonb` | Optional | Suggested tags: same_pattern, same_prime_mover, lower_skill_variant, pain_modified_variant, equipment_variant. |
| `constraint_tags` | `text[]` or `jsonb` | Optional | Conditions where edge applies or is blocked. |
| `confidence` | `numeric(4,3)` | Optional | Review confidence, not automatic approval. |
| `approved_by` | `uuid` | Optional | Required for approved global edge. |
| `approved_at` | `timestamptz` | Optional | Required for approved global edge. |
| `status` | `text` | Yes | staged, approved, active, retired, rejected. |
| `taxonomy_version_id` | `uuid` | Yes for global approved edge | Version boundary. |
| `owner_scope` | `text` | Yes | global or trainer_local. |
| `owner_trainer_id` | `uuid` | Optional | Required for trainer-local edge. |

## 4. RLS and Ownership Model

Draft intended behavior only:

- Global approved taxonomy: authenticated users can read active/published global taxonomy rows. Writes require admin/staff role, likely via existing `public.has_role(auth.uid(), 'admin')` pattern.
- Trainer-local draft exercises: trainers can create/read/update/delete their own draft/local rows where `owner_scope='trainer_local'` and `owner_trainer_id=auth.uid()`. Other trainers cannot see them.
- Admin/staff approved imports: import batches and global staged rows are managed by admins/staff or service role. Trainers should not see private source names or validation payloads unless the batch is scoped to their account.
- Import batches: no raw private file content stored. Batch metadata may be admin-only until published. Published batch summary can be readable for provenance if it does not expose private source data.
- Trainer overrides: not implemented in this schema draft, but taxonomy rows should carry enough scope fields to support trainer-local aliases/templates/substitution preferences later.
- Read-only use inside plans/sessions: server functions and service role can resolve taxonomy for plan/session adapters. Client-visible reads should be limited to approved global rows and trainer-owned local rows needed for that trainer's plans.
- Public intake/client portal: should not get broad taxonomy write access. Any display resolution should be read-only through server functions or narrowly scoped policies.

## 5. Import Staging Lifecycle

1. Raw private file stays outside the repo and outside committed artifacts.
2. Local/parser import reads the private source and emits sanitized staging candidates.
3. `exercise_import_batches` row is created with source metadata, parser version, status, counts, and no raw private cell data.
4. Staging rows are validated for required identity, alias, muscle, movement, equipment, and source fields. A future implementation may need `exercise_import_staging_rows` even though it is not part of the core 10-table publish schema.
5. Duplicate and alias detection compares `normalized_name`, `normalized_alias`, equipment tags, movement patterns, and muscle maps against existing templates.
6. Unknown muscle abbreviations enter review. They are not guessed into canonical keys.
7. Admin/trainer review actions: approve, reject, merge, local-only, needs-evidence.
8. Approved rows become draft taxonomy rows linked to the batch.
9. Publishing creates or activates an `exercise_taxonomy_versions` row and freezes the associated global rows.
10. Rollback/supersede retires the new active version and restores the previous active version without deleting rows used by historical plans.

## 6. Backward Compatibility

Existing plan and session data should coexist with taxonomy tables at first.

- Existing `workout_plan_days.content.exercises`, `workout_plans.plan_data`, `workout_sessions.entries`, and `session_set_logs.exercise_name` remain valid.
- `exercise_key` should be nullable in future plan/session adapter layers initially. Do not require all legacy rows to resolve.
- Unknown exercise fallback should preserve the visible name and use a deterministic key such as `unknown:<normalized_name>`.
- Unknown/unmapped exercises should be excluded from strict canonical volume totals until mapped, but still shown in plans, sessions, exports, and history.
- Plan/session adapters can resolve known names through approved aliases and emit warnings for unknowns.
- No destructive migration should rewrite historical JSON in the first taxonomy migration.
- Gradual migration path: add taxonomy tables, seed current code taxonomy, build read service, run dry-run resolution reports, add nullable keys to new generated plans/sessions only when safe, then plan historical backfills separately.

## 7. Deterministic Engine Integration

- `volumeEngine`: reads `exercise_muscle_map`, role weights, taxonomy version, and unknown warnings to compute strict planned/performed volume.
- `substitutionEngine`: reads approved `exercise_substitution_edges`, constraint tags, equipment tags, movement patterns, and muscle maps.
- `prescriptionEngine`: filters `exercise_templates` by status, owner scope, equipment tags, movement patterns, level, and constraints.
- `progressionEngine`: groups history by `exercise_key` and approved aliases instead of raw exercise names.
- `auditEngine`: records taxonomy version, import batch, actor, approval state, input hash, unknown counts, and override decisions.
- PDF/session presentation: uses `display_name`, locale-specific aliases, approved media, and fallback original names.
- Multilingual exercise names: aliases and template display fields support PT/EN without changing identity.
- Future media/demo integration: `exercise_media` stores verified media; free-text search remains fallback until media is verified.

## 8. Open Questions / Implementation Blockers

- Exact 10 muscle keys are product-approved conceptually, but SQL should still choose whether to enforce by check constraint, enum, or lookup table.
- Enum vs lookup table choices remain open for status, role, owner scope, locale, movement pattern, equipment key, constraint severity, and media status.
- RLS policy details need review, especially trainer-local taxonomy, admin/staff access, and service-role import jobs.
- Admin role model should reuse `user_roles`/`has_role`, but staff/non-admin import reviewer roles are not defined.
- Import approval UI timing is unresolved; schema can support staging before UI exists, but production imports should wait.
- Trainer-local exercises can later be promoted globally, but promotion mechanics and duplicate merge rules need design.
- `effective_set_weight` should likely be stored as numeric to preserve versioned product heuristics; deriving solely from role would make future per-exercise tuning harder.
- Alias global uniqueness per locale is recommended, but exact partial indexes must handle trainer-local aliases and retired taxonomy versions.
- Whether to add a dedicated `exercise_import_staging_rows` table in the first migration is unresolved; import lifecycle probably needs it before real imports.

## 9. Proposed Migration PR Sequence

| PR | Goal | Files likely touched | Tests needed | Risk level | Stop conditions |
| --- | --- | --- | --- | --- | --- |
| PR 1 - SQL migration draft for taxonomy tables | Create the SQL migration for core taxonomy tables, RLS, constraints, indexes, and audit assumptions | `supabase/migrations/*`, docs | Migration review, RLS policy inspection, rollback script review | High | RLS/admin role unclear; enum vs lookup unresolved; no rollback plan |
| PR 2 - generated Supabase types update | Regenerate `src/integrations/supabase/types.ts` after migration is accepted | `src/integrations/supabase/types.ts` | Type compile/build, generated diff review | Medium | Types require remote/schema access not available safely |
| PR 3 - seed current code taxonomy into import batch fixture | Represent current `src/lib/exercise-taxonomy.ts` as a non-private seed/import batch fixture | `scripts/*`, `docs/*`, possibly fixtures | Seed validation, no private data, duplicate detection | Medium | Seed would require app behavior changes or private data |
| PR 4 - import validation script dry-run | Validate staged rows without writing production taxonomy | `scripts/*`, tests, docs/reports | Required fields, alias collisions, unknown muscle/equipment tags | Medium | Script prints private data or requires new packages |
| PR 5 - taxonomy read service | Add read-only service for resolving active taxonomy and aliases | `src/server` or `src/lib`, tests | Alias resolution, scope visibility, unknown fallback | Medium | RLS/service boundary unclear |
| PR 6 - volume engine fixture reads taxonomy | Pure volume engine fixture uses taxonomy data and approved role weights | Engine/lib tests | Effective set weights, unknown exclusion, taxonomy version audit | Medium | Weight policy changes or fixture cannot represent schema |
| PR 7 - UI/admin approval surface later | Build approval/review UI for imports, aliases, maps, and substitutions | Routes/components/server functions/tests | Auth/RLS, approval actions, audit events | High | Product workflow not ready; admin role unclear |

## 10. Test Plan

- Uniqueness constraints: global `exercise_key`, normalized alias per locale/version, trainer-local uniqueness, substitution edge uniqueness.
- Alias resolution: locale-scoped aliases, retired aliases, trainer-local aliases, collisions, unknown fallback.
- Unknown exercise fallback: preserve display name, create deterministic unknown key, exclude from strict volume, emit warning.
- Trainer-local visibility: trainer can see own local draft; other trainer cannot; admin can review as intended.
- Global taxonomy read access: authenticated users can read active approved global taxonomy; unauthenticated/public access remains restricted unless explicitly exposed by server function.
- Effective set weight validation: role values, weight range, default 1.0/0.5/0.0, stabilizer excluded from strict hypertrophy volume.
- Substitution edge validation: source != target, approved status required for automatic use, constraint/equipment tags validated.
- Import batch validation: lifecycle transitions, counts, duplicate detection, unknown abbreviation review, no raw private data persisted.
- Version immutability: published rows cannot be mutated in place; supersede/retire creates auditable version transition.
- Audit coverage: import publish, alias approve/merge/reject, muscle map approval, template retirement, substitution approval, trainer-local promotion.
