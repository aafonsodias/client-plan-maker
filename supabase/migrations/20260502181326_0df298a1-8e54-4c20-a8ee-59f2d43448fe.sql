CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_inprogress_unique
  ON public.workout_sessions (plan_id, week_number, day_label, session_date, logged_by)
  WHERE status = 'in_progress';