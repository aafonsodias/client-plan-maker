
-- R78: cost guard columns on workout_plans
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS quota_reserved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generation_lock_acquired_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_lock_owner uuid;

CREATE INDEX IF NOT EXISTS workout_plans_quota_reserved_idx
  ON public.workout_plans (trainer_id)
  WHERE quota_reserved = true AND generation_status <> 'complete';

-- R78: drop auto-trial. Landing promises "1 plano grátis" with no trial; the
-- trigger contradicted that and inflated entitlement silently.
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_trial();
