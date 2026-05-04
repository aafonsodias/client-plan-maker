-- Round 55 P0.c: plan_data_version stamps for stale-session detection.
-- When a plan's structure changes (regen-with-feedback), we bump plan_data_version
-- so older workout_sessions can be visually segregated in the Logbook
-- ("X sessions before the last redesign") instead of shown as missing data.

ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS plan_data_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS plan_data_version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_plan_version
  ON public.workout_sessions (plan_id, plan_data_version);
