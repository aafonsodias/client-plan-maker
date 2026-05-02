ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS demo_critique jsonb;