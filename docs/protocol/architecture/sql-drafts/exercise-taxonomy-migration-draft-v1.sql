-- REVIEW DRAFT ONLY - NOT A SUPABASE MIGRATION.
-- This file is intentionally outside supabase/migrations/.
-- Do not apply this SQL until schema, RLS, rollback, and staging plans are reviewed.
--
-- Purpose:
-- - Draft canonical exercise taxonomy tables for Protocol's deterministic prescription engine.
-- - Keep current runtime behavior unchanged.
-- - Avoid committing private spreadsheet data or private source filenames.
--
-- Existing repo assumptions observed before this draft:
-- - public.has_role(auth.uid(), 'admin') exists and is used for admin checks.
-- - trainer-owned data commonly uses auth.uid() = trainer_id.
-- - audit_events exists and is written by trusted server/service paths.
-- - global/system rows are commonly readable by authenticated users.
--
-- Proposed global approved taxonomy read model for review:
-- - authenticated read.
-- - anon read is deferred because public exercise taxonomy exposure is a product/security decision.
-- - server-only read is safer but less useful for client-side trainer workflows.
--
-- Published immutability review note:
-- - Published taxonomy versions are intended to be immutable.
-- - This draft does not claim final immutability enforcement.
-- - Real migration should add reviewed triggers and/or policies before publishing live data.

begin;

-- ---------------------------------------------------------------------------
-- Core v1 tables
-- ---------------------------------------------------------------------------

create table if not exists public.exercise_taxonomy_versions (
  id uuid primary key default gen_random_uuid(),
  version_label text not null,
  status text not null default 'draft',
  changelog text not null default '',
  source_hash text,
  previous_version_id uuid references public.exercise_taxonomy_versions(id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  retired_at timestamptz,
  retired_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_taxonomy_versions_status_check
    check (status in ('draft', 'active', 'retired', 'superseded')),
  constraint exercise_taxonomy_versions_active_requires_publish_check
    check (status <> 'active' or published_at is not null)
);

create unique index if not exists exercise_taxonomy_versions_version_label_uidx
  on public.exercise_taxonomy_versions (version_label);

create unique index if not exists exercise_taxonomy_versions_one_active_uidx
  on public.exercise_taxonomy_versions (status)
  where status = 'active';

create index if not exists exercise_taxonomy_versions_status_idx
  on public.exercise_taxonomy_versions (status);

alter table public.exercise_taxonomy_versions enable row level security;

create policy "Authenticated users can read non-draft taxonomy versions"
  on public.exercise_taxonomy_versions
  for select
  to authenticated
  using (status in ('active', 'retired', 'superseded'));

create policy "Admins can manage taxonomy versions"
  on public.exercise_taxonomy_versions
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table if not exists public.exercise_import_batches (
  id uuid primary key default gen_random_uuid(),
  sanitized_source_label text not null,
  source_type text not null default 'sanitized_import',
  status text not null default 'draft',
  taxonomy_version_id uuid references public.exercise_taxonomy_versions(id) on delete set null,
  imported_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  validation_summary jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_import_batches_status_check
    check (status in ('draft', 'validated', 'approved', 'rejected', 'published', 'rolled_back'))
);

create index if not exists exercise_import_batches_status_idx
  on public.exercise_import_batches (status);

create index if not exists exercise_import_batches_taxonomy_version_idx
  on public.exercise_import_batches (taxonomy_version_id);

alter table public.exercise_import_batches enable row level security;

create policy "Admins can read import batches"
  on public.exercise_import_batches
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins can manage import batches"
  on public.exercise_import_batches
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table if not exists public.exercise_templates (
  id uuid primary key default gen_random_uuid(),
  exercise_key text not null,
  display_name text not null,
  normalized_name text not null,
  type text not null default 'strength',
  level text,
  status text not null default 'draft',
  owner_scope text not null default 'global',
  trainer_id uuid references auth.users(id) on delete cascade,
  taxonomy_version_id uuid references public.exercise_taxonomy_versions(id) on delete restrict,
  source text not null default 'manual',
  import_batch_id uuid references public.exercise_import_batches(id) on delete set null,
  replacement_exercise_id uuid references public.exercise_templates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_templates_status_check
    check (status in ('draft', 'approved', 'active', 'rejected', 'retired')),
  constraint exercise_templates_owner_scope_check
    check (owner_scope in ('global', 'trainer_local')),
  constraint exercise_templates_owner_scope_trainer_check
    check (
      (owner_scope = 'global' and trainer_id is null)
      or (owner_scope = 'trainer_local' and trainer_id is not null)
    ),
  constraint exercise_templates_approved_requires_approval_check
    check (status not in ('approved', 'active') or approved_at is not null)
);

create index if not exists exercise_templates_exercise_key_idx
  on public.exercise_templates (exercise_key);

create index if not exists exercise_templates_normalized_name_idx
  on public.exercise_templates (normalized_name);

create index if not exists exercise_templates_taxonomy_version_status_idx
  on public.exercise_templates (taxonomy_version_id, status);

create index if not exists exercise_templates_owner_scope_trainer_idx
  on public.exercise_templates (owner_scope, trainer_id);

create unique index if not exists exercise_templates_global_key_version_uidx
  on public.exercise_templates (taxonomy_version_id, exercise_key)
  where owner_scope = 'global' and status in ('approved', 'active');

create unique index if not exists exercise_templates_global_name_version_uidx
  on public.exercise_templates (taxonomy_version_id, normalized_name)
  where owner_scope = 'global' and status in ('approved', 'active');

create unique index if not exists exercise_templates_trainer_local_key_uidx
  on public.exercise_templates (trainer_id, exercise_key)
  where owner_scope = 'trainer_local' and status <> 'retired';

alter table public.exercise_templates enable row level security;

create policy "Authenticated users can read approved global exercise templates"
  on public.exercise_templates
  for select
  to authenticated
  using (owner_scope = 'global' and status in ('approved', 'active'));

create policy "Trainers can read their local exercise drafts"
  on public.exercise_templates
  for select
  to authenticated
  using (owner_scope = 'trainer_local' and trainer_id = auth.uid());

create policy "Trainers can manage their local exercise drafts"
  on public.exercise_templates
  for all
  to authenticated
  using (owner_scope = 'trainer_local' and trainer_id = auth.uid())
  with check (owner_scope = 'trainer_local' and trainer_id = auth.uid());

create policy "Admins can manage global exercise templates"
  on public.exercise_templates
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table if not exists public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  taxonomy_version_id uuid references public.exercise_taxonomy_versions(id) on delete restrict,
  alias text not null,
  normalized_alias text not null,
  locale text not null default 'und',
  status text not null default 'draft',
  owner_scope text not null default 'global',
  trainer_id uuid references auth.users(id) on delete cascade,
  confidence numeric(4,3),
  source text not null default 'manual',
  import_batch_id uuid references public.exercise_import_batches(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_aliases_status_check
    check (status in ('draft', 'approved', 'active', 'rejected', 'retired')),
  constraint exercise_aliases_owner_scope_check
    check (owner_scope in ('global', 'trainer_local')),
  constraint exercise_aliases_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint exercise_aliases_owner_scope_trainer_check
    check (
      (owner_scope = 'global' and trainer_id is null)
      or (owner_scope = 'trainer_local' and trainer_id is not null)
    )
);

create index if not exists exercise_aliases_template_idx
  on public.exercise_aliases (exercise_template_id);

create index if not exists exercise_aliases_normalized_alias_idx
  on public.exercise_aliases (normalized_alias);

create index if not exists exercise_aliases_taxonomy_locale_alias_idx
  on public.exercise_aliases (taxonomy_version_id, locale, normalized_alias);

create index if not exists exercise_aliases_owner_scope_trainer_idx
  on public.exercise_aliases (owner_scope, trainer_id);

create unique index if not exists exercise_aliases_global_alias_version_locale_uidx
  on public.exercise_aliases (taxonomy_version_id, locale, normalized_alias)
  where owner_scope = 'global' and status in ('approved', 'active');

create unique index if not exists exercise_aliases_trainer_local_alias_uidx
  on public.exercise_aliases (trainer_id, locale, normalized_alias)
  where owner_scope = 'trainer_local' and status <> 'retired';

alter table public.exercise_aliases enable row level security;

create policy "Authenticated users can read approved global exercise aliases"
  on public.exercise_aliases
  for select
  to authenticated
  using (owner_scope = 'global' and status in ('approved', 'active'));

create policy "Trainers can read their local exercise aliases"
  on public.exercise_aliases
  for select
  to authenticated
  using (owner_scope = 'trainer_local' and trainer_id = auth.uid());

create policy "Trainers can manage their local exercise aliases"
  on public.exercise_aliases
  for all
  to authenticated
  using (owner_scope = 'trainer_local' and trainer_id = auth.uid())
  with check (owner_scope = 'trainer_local' and trainer_id = auth.uid());

create policy "Admins can manage global exercise aliases"
  on public.exercise_aliases
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table if not exists public.exercise_muscle_map (
  id uuid primary key default gen_random_uuid(),
  exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  taxonomy_version_id uuid references public.exercise_taxonomy_versions(id) on delete restrict,
  muscle_key text not null,
  role text not null,
  strict_hypertrophy_effective_set_weight numeric(4,3) not null,
  confidence numeric(4,3),
  source text not null default 'manual',
  status text not null default 'draft',
  import_batch_id uuid references public.exercise_import_batches(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_muscle_map_role_check
    check (role in ('prime_mover', 'synergist', 'stabilizer', 'antagonist')),
  constraint exercise_muscle_map_status_check
    check (status in ('draft', 'approved', 'active', 'rejected', 'retired')),
  constraint exercise_muscle_map_strict_weight_check
    check (
      strict_hypertrophy_effective_set_weight >= 0
      and strict_hypertrophy_effective_set_weight <= 1
    ),
  constraint exercise_muscle_map_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

comment on column public.exercise_muscle_map.strict_hypertrophy_effective_set_weight is
  'Strict hypertrophy volume weight for v1 deterministic hard-set totals. Approved v1 defaults: prime_mover=1.0, synergist=0.5, stabilizer=0.0. Future exposure/fatigue scoring must use separate fields or policy tables.';

create index if not exists exercise_muscle_map_template_idx
  on public.exercise_muscle_map (exercise_template_id);

create index if not exists exercise_muscle_map_taxonomy_muscle_role_idx
  on public.exercise_muscle_map (taxonomy_version_id, muscle_key, role);

create index if not exists exercise_muscle_map_status_idx
  on public.exercise_muscle_map (status);

create unique index if not exists exercise_muscle_map_template_muscle_role_version_uidx
  on public.exercise_muscle_map (exercise_template_id, taxonomy_version_id, muscle_key, role)
  where status in ('approved', 'active');

alter table public.exercise_muscle_map enable row level security;

create policy "Authenticated users can read approved exercise muscle maps"
  on public.exercise_muscle_map
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.exercise_templates template
      where template.id = exercise_muscle_map.exercise_template_id
        and (
          (
            template.owner_scope = 'global'
            and template.status in ('approved', 'active')
            and exercise_muscle_map.status in ('approved', 'active')
          )
          or (
            template.owner_scope = 'trainer_local'
            and template.trainer_id = auth.uid()
          )
        )
    )
  );

create policy "Admins can manage exercise muscle maps"
  on public.exercise_muscle_map
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- Later-phase table drafts
-- ---------------------------------------------------------------------------
-- These tables are useful for the full deterministic engine but should not be
-- included in the first real migration unless scope is explicitly approved.

create table if not exists public.exercise_movement_patterns (
  id uuid primary key default gen_random_uuid(),
  exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  taxonomy_version_id uuid references public.exercise_taxonomy_versions(id) on delete restrict,
  pattern_key text not null,
  is_primary boolean not null default false,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_movement_patterns_status_check
    check (status in ('draft', 'approved', 'active', 'rejected', 'retired'))
);

create index if not exists exercise_movement_patterns_template_idx
  on public.exercise_movement_patterns (exercise_template_id);

create index if not exists exercise_movement_patterns_pattern_idx
  on public.exercise_movement_patterns (taxonomy_version_id, pattern_key);

alter table public.exercise_movement_patterns enable row level security;

create table if not exists public.exercise_equipment_tags (
  id uuid primary key default gen_random_uuid(),
  exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  taxonomy_version_id uuid references public.exercise_taxonomy_versions(id) on delete restrict,
  equipment_key text not null,
  requirement text not null default 'required',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_equipment_tags_requirement_check
    check (requirement in ('required', 'optional', 'alternative')),
  constraint exercise_equipment_tags_status_check
    check (status in ('draft', 'approved', 'active', 'rejected', 'retired'))
);

create index if not exists exercise_equipment_tags_template_idx
  on public.exercise_equipment_tags (exercise_template_id);

create index if not exists exercise_equipment_tags_equipment_idx
  on public.exercise_equipment_tags (taxonomy_version_id, equipment_key);

alter table public.exercise_equipment_tags enable row level security;

create table if not exists public.exercise_constraint_tags (
  id uuid primary key default gen_random_uuid(),
  exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  taxonomy_version_id uuid references public.exercise_taxonomy_versions(id) on delete restrict,
  constraint_key text not null,
  severity text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_constraint_tags_status_check
    check (status in ('draft', 'approved', 'active', 'rejected', 'retired'))
);

create index if not exists exercise_constraint_tags_template_idx
  on public.exercise_constraint_tags (exercise_template_id);

create index if not exists exercise_constraint_tags_constraint_idx
  on public.exercise_constraint_tags (taxonomy_version_id, constraint_key);

alter table public.exercise_constraint_tags enable row level security;

create table if not exists public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  exercise_template_id uuid not null references public.exercise_templates(id) on delete cascade,
  taxonomy_version_id uuid references public.exercise_taxonomy_versions(id) on delete restrict,
  media_type text not null,
  url text not null,
  locale text not null default 'und',
  provider text,
  status text not null default 'draft',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_media_type_check
    check (media_type in ('demo_video', 'image', 'external_link')),
  constraint exercise_media_status_check
    check (status in ('draft', 'approved', 'active', 'rejected', 'retired'))
);

create index if not exists exercise_media_template_idx
  on public.exercise_media (exercise_template_id);

create index if not exists exercise_media_status_idx
  on public.exercise_media (status);

alter table public.exercise_media enable row level security;

create table if not exists public.exercise_substitution_edges (
  id uuid primary key default gen_random_uuid(),
  from_exercise_id uuid not null references public.exercise_templates(id) on delete cascade,
  to_exercise_id uuid not null references public.exercise_templates(id) on delete cascade,
  taxonomy_version_id uuid references public.exercise_taxonomy_versions(id) on delete restrict,
  reason_tags text[] not null default array[]::text[],
  constraint_tags text[] not null default array[]::text[],
  confidence numeric(4,3),
  status text not null default 'draft',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_substitution_edges_status_check
    check (status in ('draft', 'approved', 'active', 'rejected', 'retired')),
  constraint exercise_substitution_edges_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint exercise_substitution_edges_no_self_check
    check (from_exercise_id <> to_exercise_id)
);

create index if not exists exercise_substitution_edges_from_idx
  on public.exercise_substitution_edges (from_exercise_id);

create index if not exists exercise_substitution_edges_to_idx
  on public.exercise_substitution_edges (to_exercise_id);

create unique index if not exists exercise_substitution_edges_pair_version_uidx
  on public.exercise_substitution_edges (taxonomy_version_id, from_exercise_id, to_exercise_id)
  where status in ('approved', 'active');

alter table public.exercise_substitution_edges enable row level security;

-- Later-phase RLS policies are intentionally not drafted here. RLS is enabled
-- so the default posture is deny-until-reviewed if this draft is copied into a
-- real migration. Exact admin/reviewer roles, global read policy, and
-- trainer-local substitution governance need product review first.

-- ---------------------------------------------------------------------------
-- Published immutability review placeholder
-- ---------------------------------------------------------------------------
-- Real migration must decide whether published version rows and all child rows
-- are locked by trigger, RLS, append-only eventing, or a combination. A common
-- trigger can reject updates/deletes after a taxonomy version is active, but it
-- must be reviewed against admin rollback and supersede flows before adoption.

-- ---------------------------------------------------------------------------
-- Rollback notes for a future real migration
-- ---------------------------------------------------------------------------
-- No runtime code depends on these tables at the time of this draft.
-- If applied in a future migration before runtime integration, drop order is:
-- 1. exercise_substitution_edges
-- 2. exercise_media
-- 3. exercise_constraint_tags
-- 4. exercise_equipment_tags
-- 5. exercise_movement_patterns
-- 6. exercise_muscle_map
-- 7. exercise_aliases
-- 8. exercise_templates
-- 9. exercise_import_batches
-- 10. exercise_taxonomy_versions
-- A real rollback must first confirm no deployed runtime path reads or writes
-- these tables.

rollback;
