ALTER TABLE public.workout_plan_days REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_plan_days;