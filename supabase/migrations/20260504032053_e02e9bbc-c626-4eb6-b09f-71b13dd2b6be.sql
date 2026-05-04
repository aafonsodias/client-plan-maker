ALTER TABLE public.workout_plan_days
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS assessment_completion_pct integer
  CHECK (assessment_completion_pct IS NULL OR (assessment_completion_pct BETWEEN 0 AND 100));

CREATE INDEX IF NOT EXISTS idx_workout_plan_days_plan_day
  ON public.workout_plan_days (plan_id, day_number);