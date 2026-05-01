ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS programming_variables JSONB,
  ADD COLUMN IF NOT EXISTS red_flag_accommodations JSONB;