CREATE TABLE public.plan_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.workout_plans(id) ON DELETE SET NULL,
  author text NOT NULL CHECK (author IN ('client','trainer','bot','system')),
  category text NOT NULL CHECK (category IN ('pain','question','complaint','praise','app_bug','ux')),
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE INDEX idx_plan_feedback_client_created ON public.plan_feedback (client_id, created_at DESC);
CREATE INDEX idx_plan_feedback_trainer_status ON public.plan_feedback (trainer_id, status, created_at DESC);

ALTER TABLE public.plan_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own plan feedback"
ON public.plan_feedback
FOR ALL
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);

CREATE TRIGGER update_plan_feedback_updated_at
BEFORE UPDATE ON public.plan_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();