
-- 1. Assessments: eager per-section analysis cache
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS section_analyses     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sections_analysed_at jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Workout plans: phased generation state
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS generation_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brief             jsonb,
  ADD COLUMN IF NOT EXISTS blueprint         jsonb,
  ADD COLUMN IF NOT EXISTS progression_plan  jsonb;

-- 3. Profiles: per-trainer rollout flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phased_generation_enabled boolean NOT NULL DEFAULT false;

-- 4. Generation log
CREATE TABLE IF NOT EXISTS public.generation_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id      uuid NOT NULL,
  plan_id         uuid,
  assessment_id   uuid,
  stage           text NOT NULL,
  model_used      text NOT NULL,
  input_tokens    integer NOT NULL DEFAULT 0,
  output_tokens   integer NOT NULL DEFAULT 0,
  cost_usd        numeric(10,6) NOT NULL DEFAULT 0,
  zod_passed      boolean NOT NULL,
  retry_count     integer NOT NULL DEFAULT 0,
  duration_ms     integer NOT NULL DEFAULT 0,
  error           text,
  input_snapshot  jsonb,
  output_snapshot jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_log_trainer_created_idx
  ON public.generation_log (trainer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS generation_log_plan_idx
  ON public.generation_log (plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS generation_log_assessment_idx
  ON public.generation_log (assessment_id) WHERE assessment_id IS NOT NULL;

ALTER TABLE public.generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers view own generation log"
  ON public.generation_log
  FOR SELECT
  USING (auth.uid() = trainer_id);

CREATE POLICY "trainers insert own generation log"
  ON public.generation_log
  FOR INSERT
  WITH CHECK (auth.uid() = trainer_id);
