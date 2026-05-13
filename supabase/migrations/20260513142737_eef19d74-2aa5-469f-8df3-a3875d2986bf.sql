CREATE TABLE public.session_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  client_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  exercise_slug text NOT NULL,
  exercise_name text NOT NULL,
  movement_pattern text,
  set_index integer NOT NULL,
  prescribed_load_kg numeric,
  prescribed_reps integer,
  prescribed_rpe numeric,
  actual_load_kg numeric,
  actual_reps integer,
  actual_rpe numeric,
  pain_flag boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_set_logs_plan ON public.session_set_logs (plan_id, week_number);
CREATE INDEX idx_session_set_logs_session ON public.session_set_logs (session_id);
CREATE INDEX idx_session_set_logs_pattern ON public.session_set_logs (plan_id, movement_pattern);

ALTER TABLE public.session_set_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own set logs"
  ON public.session_set_logs
  FOR ALL
  TO authenticated
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "clients read own set logs"
  ON public.session_set_logs
  FOR SELECT
  TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER update_session_set_logs_updated_at
  BEFORE UPDATE ON public.session_set_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();