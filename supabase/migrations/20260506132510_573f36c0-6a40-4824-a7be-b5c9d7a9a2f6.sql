-- R73 — Programmable Knowledge Layer (PKL) Phase 1 + System Governance

-- ============================================================
-- A. Roles
-- ============================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin','coach');
  end if;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "users read own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create policy "admins manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Seed founder as admin (idempotent)
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = 'aafonsodias@gmail.com'
on conflict do nothing;

-- ============================================================
-- B. Knowledge profiles + version history
-- ============================================================
create table if not exists public.knowledge_profiles (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  name text not null,
  description text not null default '',
  is_system boolean not null default false,
  is_default boolean not null default false,
  version int not null default 1,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists knowledge_profiles_default_unique
  on public.knowledge_profiles (trainer_id) where is_default;

alter table public.knowledge_profiles enable row level security;

create policy "trainers manage own profiles"
  on public.knowledge_profiles for all to authenticated
  using (auth.uid() = trainer_id)
  with check (auth.uid() = trainer_id);

create policy "anyone reads system profiles"
  on public.knowledge_profiles for select to authenticated
  using (is_system = true);

create table if not exists public.knowledge_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.knowledge_profiles(id) on delete cascade,
  trainer_id uuid not null,
  version int not null,
  rules jsonb not null,
  changed_by uuid,
  change_summary text not null default '',
  created_at timestamptz not null default now(),
  unique (profile_id, version)
);
alter table public.knowledge_profile_versions enable row level security;

create policy "trainers read own version history"
  on public.knowledge_profile_versions for select to authenticated
  using (auth.uid() = trainer_id);

create policy "trainers insert own version history"
  on public.knowledge_profile_versions for insert to authenticated
  with check (auth.uid() = trainer_id);

-- Bump version + snapshot history when rules change.
create or replace function public.bump_knowledge_profile_version()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if NEW.rules is distinct from OLD.rules then
    insert into public.knowledge_profile_versions (profile_id, trainer_id, version, rules, changed_by, change_summary)
    values (OLD.id, OLD.trainer_id, OLD.version, OLD.rules, auth.uid(), '');
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_bump_knowledge_profile_version on public.knowledge_profiles;
create trigger trg_bump_knowledge_profile_version
  before update on public.knowledge_profiles
  for each row execute function public.bump_knowledge_profile_version();

-- ============================================================
-- C. Plan stamping
-- ============================================================
alter table public.workout_plans
  add column if not exists knowledge_profile_id uuid references public.knowledge_profiles(id),
  add column if not exists knowledge_profile_version int;

-- ============================================================
-- D. System iterations log
-- ============================================================
create table if not exists public.system_iterations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  summary text not null,
  affected_modules text[] not null default '{}',
  shipped_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.system_iterations enable row level security;

create policy "admins read iterations"
  on public.system_iterations for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "admins write iterations"
  on public.system_iterations for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Seed a few iterations from existing memory (idempotent via unique code).
insert into public.system_iterations (code, title, summary, affected_modules, shipped_at) values
  ('R64', 'Intensity Cockpit', '5 knobs (wave_model, rpe_ceiling, intensity_volume_tradeoff, deload_frequency, autoreg_strictness) + 6 presets. Drives buildWavePlan() and stage4 deload cadence.', '{phased,programming-defaults,brief-editor}', now() - interval '90 days'),
  ('R65', 'programNextWeek', 'Único caminho para gerar Semana N+1 com base em sessões loggeadas. Aplica autoreg_strictness sobre drift de RPE.', '{program-next-week,autoreg}', now() - interval '60 days'),
  ('R72.2', 'Multi-modality engine', 'Brief expandido para gym + running + climbing + calisthenics + mobility + sport_skill. Inferência por regex no goal_text.', '{schemas,stage1,stage3,training-zones}', now() - interval '7 days'),
  ('R73', 'Programmable Knowledge Layer (PKL) + Governance', 'Sistema editável de regras (volume, intensidade, recovery, progressão) com versioning imutável. Adiciona /knowledge, /admin/system, user_roles e has_role().', '{knowledge,admin,phased,governance}', now())
on conflict (code) do nothing;