
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('coach','solo','coached_client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type public.account_type;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_self boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS clients_one_self_per_trainer
  ON public.clients (trainer_id) WHERE is_self = true;
