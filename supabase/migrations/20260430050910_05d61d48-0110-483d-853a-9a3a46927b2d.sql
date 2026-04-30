-- Add quick status field for plan-vs-actual day marking
DO $$ BEGIN
  CREATE TYPE public.session_status AS ENUM ('done', 'partial', 'missed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS status public.session_status NOT NULL DEFAULT 'done';

CREATE INDEX IF NOT EXISTS workout_sessions_plan_week_day_idx
  ON public.workout_sessions (plan_id, week_number, day_label);