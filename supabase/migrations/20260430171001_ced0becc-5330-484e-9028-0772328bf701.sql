
-- Track per-day generation for resumable plan creation.
CREATE TABLE public.workout_plan_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL,
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  day_label TEXT,
  focus TEXT,
  rationale TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'done',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, week_number, day_number)
);

CREATE INDEX idx_workout_plan_days_plan ON public.workout_plan_days(plan_id, week_number, day_number);
CREATE INDEX idx_workout_plan_days_trainer ON public.workout_plan_days(trainer_id);

ALTER TABLE public.workout_plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own plan days"
  ON public.workout_plan_days FOR ALL
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE TRIGGER update_workout_plan_days_updated_at
  BEFORE UPDATE ON public.workout_plan_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track overall generation lifecycle on the plan itself.
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS generation_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_workout_plans_client_in_progress
  ON public.workout_plans(client_id)
  WHERE generation_status = 'in_progress';
