create table public.assessment_injuries (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  trainer_id uuid not null,
  body_zone text not null,
  body_view text not null check (body_view in ('front','back')),
  severity int not null check (severity between 1 and 5),
  injury_label text,
  note text,
  source text not null default 'self_reported' check (source in ('self_reported','medical_documented','trainer_observed')),
  medical_document_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assessment_injuries_assessment on public.assessment_injuries(assessment_id);
create index idx_assessment_injuries_client on public.assessment_injuries(client_id);

alter table public.assessment_injuries enable row level security;

create policy "trainers manage own client injuries"
on public.assessment_injuries
for all
to authenticated
using (auth.uid() = trainer_id)
with check (auth.uid() = trainer_id);

create policy "public intake can insert own injuries"
on public.assessment_injuries
for insert
to anon, authenticated
with check (
  client_id in (
    select c.id from public.clients c
    where c.intake_token is not null
      and c.intake_token::text = ((current_setting('request.headers', true))::json->>'x-intake-token')
      and c.intake_token_expires_at > now()
      and c.intake_status <> 'reviewed'::intake_status
      and c.trainer_id = assessment_injuries.trainer_id
  )
);

create policy "public intake can read own injuries"
on public.assessment_injuries
for select
to anon, authenticated
using (
  client_id in (
    select c.id from public.clients c
    where c.intake_token is not null
      and c.intake_token::text = ((current_setting('request.headers', true))::json->>'x-intake-token')
      and c.intake_token_expires_at > now()
  )
);

create policy "public intake can delete own injuries"
on public.assessment_injuries
for delete
to anon, authenticated
using (
  client_id in (
    select c.id from public.clients c
    where c.intake_token is not null
      and c.intake_token::text = ((current_setting('request.headers', true))::json->>'x-intake-token')
      and c.intake_token_expires_at > now()
      and c.intake_status <> 'reviewed'::intake_status
  )
);

create policy "public intake can update own injuries"
on public.assessment_injuries
for update
to anon, authenticated
using (
  client_id in (
    select c.id from public.clients c
    where c.intake_token is not null
      and c.intake_token::text = ((current_setting('request.headers', true))::json->>'x-intake-token')
      and c.intake_token_expires_at > now()
      and c.intake_status <> 'reviewed'::intake_status
  )
);

create trigger trg_assessment_injuries_updated_at
before update on public.assessment_injuries
for each row execute function public.update_updated_at_column();