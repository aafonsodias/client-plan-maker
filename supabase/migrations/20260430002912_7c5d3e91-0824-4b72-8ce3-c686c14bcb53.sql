-- Add public share token to workout_plans for client log access
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE;

-- Workout sessions: one per logged session (date + day reference)
CREATE TABLE public.workout_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL,
  week_number INTEGER NOT NULL,
  day_label TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_by TEXT NOT NULL DEFAULT 'trainer', -- 'trainer' | 'client'
  entries JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{exercise_name, planned:{sets,reps,rest,notes}, actual:{sets,reps,weight,notes}}]
  session_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own sessions"
ON public.workout_sessions
FOR ALL
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);

CREATE TRIGGER update_workout_sessions_updated_at
BEFORE UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_workout_sessions_plan ON public.workout_sessions(plan_id, session_date DESC);