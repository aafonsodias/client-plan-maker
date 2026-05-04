-- R46: Mission schema (foundation for assessment-completion quest path)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'mission_kind') then
    create type public.mission_kind as enum ('parq','rockport','blood_pressure','gym_class','photos','custom');
  end if;
  if not exists (select 1 from pg_type where typname = 'mission_status') then
    create type public.mission_status as enum ('pending','in_progress','done','skipped');
  end if;
end $$;

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  trainer_id uuid not null,
  kind public.mission_kind not null,
  status public.mission_status not null default 'pending',
  evidence_required boolean not null default false,
  evidence_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.missions enable row level security;

drop policy if exists "trainers manage own missions" on public.missions;
create policy "trainers manage own missions" on public.missions
  for all
  using (auth.uid() = trainer_id)
  with check (auth.uid() = trainer_id);

drop trigger if exists trg_missions_updated_at on public.missions;
create trigger trg_missions_updated_at
  before update on public.missions
  for each row execute function public.update_updated_at_column();

create index if not exists idx_missions_client on public.missions(client_id);
create index if not exists idx_missions_trainer on public.missions(trainer_id);

alter table public.clients
  add column if not exists assessment_completion integer not null default 0;