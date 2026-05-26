# Exercise Taxonomy SQL Review v1

## Executive summary

This package is a review artifact, not a database migration. The SQL draft lives at `docs/protocol/architecture/sql-drafts/exercise-taxonomy-migration-draft-v1.sql` so the canonical exercise taxonomy design can be reviewed before anything is placed under `supabase/migrations/`.

The core v1 draft covers the minimum tables needed to start canonical exercise identity, imports, aliases, and strict hypertrophy muscle mapping:

- `exercise_taxonomy_versions`
- `exercise_import_batches`
- `exercise_templates`
- `exercise_aliases`
- `exercise_muscle_map`

Movement patterns, equipment tags, constraint tags, media, and substitution edges are included only as later-phase draft tables. They should not be part of the first real migration unless the migration scope is explicitly expanded and reviewed.

Before converting this into a real migration, Protocol needs review on RLS, global read exposure, alias uniqueness, published immutability, and import approval workflow. Runtime app behavior should remain unchanged until a later integration PR.

## Table review

| Table | Purpose | Key columns | Risk level | Unresolved questions | First migration? |
|---|---|---|---|---|---|
| `exercise_taxonomy_versions` | Version and publish lifecycle for global taxonomy snapshots. | `version_label`, `status`, `previous_version_id`, `published_at`, `published_by` | Medium | Whether one active version is enough; exact immutability trigger behavior; rollback/supersede policy. | Yes |
| `exercise_import_batches` | Track sanitized import batches before approval and publishing. | `sanitized_source_label`, `source_type`, `status`, `validation_summary`, `taxonomy_version_id` | Medium | Whether import batches are admin-only or staff-reviewer accessible; exact validation summary shape. | Yes |
| `exercise_templates` | Canonical exercise identity and trainer-local drafts. | `exercise_key`, `display_name`, `normalized_name`, `owner_scope`, `trainer_id`, `taxonomy_version_id`, `status` | High | Unknown exercise fallback behavior in runtime; promotion of trainer-local drafts to global; whether aliases or localized names need a separate names table. | Yes |
| `exercise_aliases` | Approved aliases and localized display/search variants. | `alias`, `normalized_alias`, `locale`, `exercise_template_id`, `taxonomy_version_id`, `owner_scope` | High | Whether aliases must be globally unique per locale; collision handling for multilingual names; whether locale default `und` is enough. | Yes |
| `exercise_muscle_map` | Strict hypertrophy volume contribution by muscle and role. | `muscle_key`, `role`, `strict_hypertrophy_effective_set_weight`, `confidence`, `source` | High | Exact 10 muscle keys; whether role defaults should be enforced by constraint or policy table; source/evidence levels. | Yes |
| `exercise_movement_patterns` | Controlled movement pattern tagging. | `pattern_key`, `is_primary`, `taxonomy_version_id` | Medium | Final vocabulary and whether multi-pattern exercises need weights. | Later |
| `exercise_equipment_tags` | Equipment requirements for search and substitution filtering. | `equipment_key`, `requirement`, `taxonomy_version_id` | Medium | Equipment vocabulary ownership and how to handle common substitutions. | Later |
| `exercise_constraint_tags` | Contraindication, setup, and risk tags. | `constraint_key`, `severity`, `taxonomy_version_id` | High | Safety vocabulary, trainer override rules, and whether tags should block or warn. | Later |
| `exercise_media` | Demo video/image/external links. | `media_type`, `url`, `locale`, `provider`, `status` | Medium | Media provider direction, link rot checks, and moderation/approval policy. | Later |
| `exercise_substitution_edges` | Approved substitution graph between exercises. | `from_exercise_id`, `to_exercise_id`, `reason_tags`, `constraint_tags`, `confidence` | High | Directionality, safety governance, client constraints, and whether trainer-local substitutions are allowed. | Later |

## RLS review

The draft follows existing repo patterns:

- Admin checks use `public.has_role(auth.uid(), 'admin'::public.app_role)`.
- Trainer-local rows use `trainer_id = auth.uid()`.
- Global approved taxonomy is proposed as readable by authenticated users.
- Import batches are admin-only in the draft.
- No unauthenticated writes are proposed.
- No trainer can read or write another trainer's local drafts.
- Later-phase tables enable RLS but intentionally define no policies, so they are deny-by-default until separately reviewed.

Global approved taxonomy read options:

| Option | Benefit | Risk | Draft recommendation |
|---|---|---|---|
| Authenticated read | Matches trainer workflow and existing system-data patterns. | Any logged-in user can inspect taxonomy. | Recommended for v1 review. |
| Anon read | Simplifies public flows if taxonomy is needed before auth. | Exposes taxonomy publicly and may leak proprietary curation. | Do not use by default. |
| Server-only read | Tightest control. | More server endpoints/adapters needed for basic trainer UI. | Consider if taxonomy is treated as proprietary. |

RLS assumptions that must be confirmed:

- `admin` remains the only role needed for import approval in v1.
- No separate `staff`, `reviewer`, or `taxonomy_admin` role is required.
- Trainer-created exercises are private to the owning trainer until explicitly promoted.
- Global approved taxonomy rows can be read by authenticated users without exposing private client data.
- Later-phase substitution and constraint tables need a separate RLS review before use.

## Constraint and index review

The draft uses checks only where policy appears stable:

- Status fields are constrained to a small lifecycle set.
- `owner_scope` is constrained to `global` or `trainer_local`.
- Trainer-local rows require `trainer_id`; global rows require `trainer_id` to be null.
- Confidence and strict hypertrophy weights are constrained to `0..1`.
- Muscle roles are constrained to `prime_mover`, `synergist`, `stabilizer`, and `antagonist`.

The draft avoids overconstraining uncertain policy:

- Exact muscle keys are not hardcoded until the 10-key list is approved.
- Effective set weights are not locked to role defaults because v1 values are product heuristics and must remain migratable.
- Movement, equipment, and constraint vocabularies are not strongly constrained in core v1.

Key indexes and uniqueness:

- Global exercise keys and normalized names are unique per taxonomy version for approved/active global templates.
- Trainer-local exercise keys are unique per trainer while not retired.
- Global aliases are unique per taxonomy version, locale, and normalized alias for approved/active aliases.
- Trainer-local aliases are unique per trainer, locale, and normalized alias while not retired.
- Muscle map rows are unique by exercise, taxonomy version, muscle, and role for approved/active mappings.

Alias collision handling remains a high-risk area. The first real migration should decide whether ambiguous aliases are rejected, staged for review, or allowed with confidence and context fields.

## Effective set weighting review

The approved v1 strict hypertrophy volume heuristic is:

| Role | Strict hypertrophy effective set weight |
|---|---:|
| Prime mover | `1.0` |
| Synergist | `0.5` |
| Stabilizer | `0.0` |

Stabilizers are still tracked as metadata, but excluded from strict hypertrophy totals in v1. This avoids pretending stabilizer involvement is equivalent to direct hypertrophy volume.

Future exposure or fatigue scoring should be modeled separately from strict hypertrophy volume. The draft names the field `strict_hypertrophy_effective_set_weight` to prevent future code from treating it as a universal biological truth.

Open review points:

- Whether role defaults should live in code, a policy table, or generated fixtures.
- Whether `antagonist` should always be `0.0` for strict hypertrophy volume.
- Whether confidence/source fields are sufficient to audit uncertain mappings.

## Privacy review

The draft contains no raw private spreadsheet data and no private spreadsheet filenames. Import batches use `sanitized_source_label` so operators can track provenance without committing personal or client-identifiable labels.

Private source files must remain outside the repository. `private-reference/` is already gitignored by previous work and should stay that way.

Any future import script should:

- Read private workbooks locally.
- Map rows into staging records.
- Store only sanitized source labels in the database.
- Reject or redact client names, trainer notes, contacts, dates of birth, or private comments.
- Produce validation summaries without exposing personal values.

## Migration readiness checklist

- [ ] Exact 10 muscle keys approved.
- [ ] RLS helper functions confirmed for production and staging.
- [ ] Global read policy decided: authenticated, anon, or server-only.
- [ ] Alias uniqueness and ambiguous-alias behavior decided.
- [ ] Trainer-local promotion policy decided.
- [ ] Import approval lifecycle confirmed.
- [ ] Published immutability enforcement decided.
- [ ] Rollback reviewed.
- [ ] Staging application plan written.

## Recommendation

The next PR should convert only the core v1 tables into a real migration after the readiness checklist is approved. Keep movement patterns, equipment tags, constraint tags, media, and substitution edges deferred unless product review decides they are required immediately.

Do not move the draft wholesale into `supabase/migrations/` without narrowing scope and adding final RLS, immutability, and rollback decisions.
