ALTER TABLE public.workout_plan_days
  ADD COLUMN IF NOT EXISTS validation_meta jsonb NOT NULL DEFAULT '{}'::jsonb;