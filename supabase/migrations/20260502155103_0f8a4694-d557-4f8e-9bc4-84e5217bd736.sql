
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS block_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prior_plan_id uuid REFERENCES public.workout_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS block_transition_summary text;

CREATE INDEX IF NOT EXISTS idx_workout_plans_prior_plan_id ON public.workout_plans(prior_plan_id);

CREATE TABLE IF NOT EXISTS public.demo_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  plan_id uuid REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'client',
  status text NOT NULL DEFAULT 'running',
  error text,
  cancelled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_runs_trainer_updated ON public.demo_runs(trainer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_runs_plan ON public.demo_runs(plan_id);

ALTER TABLE public.demo_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own demo runs"
  ON public.demo_runs
  FOR ALL
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE TRIGGER update_demo_runs_updated_at
  BEFORE UPDATE ON public.demo_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
