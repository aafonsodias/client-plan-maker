
-- 1. Cleanup existing demo clients (cascade-ish manually)
DELETE FROM public.workout_sessions WHERE plan_id IN (SELECT id FROM public.workout_plans WHERE is_demo = true);
DELETE FROM public.workout_plan_days WHERE plan_id IN (SELECT id FROM public.workout_plans WHERE is_demo = true);
DELETE FROM public.generation_log WHERE plan_id IN (SELECT id FROM public.workout_plans WHERE is_demo = true);
DELETE FROM public.workout_plans WHERE is_demo = true;
DELETE FROM public.assessments WHERE client_id IN (SELECT id FROM public.clients WHERE is_demo = true);
DELETE FROM public.client_measurements WHERE client_id IN (SELECT id FROM public.clients WHERE is_demo = true);
DELETE FROM public.client_bookings WHERE client_id IN (SELECT id FROM public.clients WHERE is_demo = true);
DELETE FROM public.client_packs WHERE client_id IN (SELECT id FROM public.clients WHERE is_demo = true);
DELETE FROM public.daily_activity_log WHERE client_id IN (SELECT id FROM public.clients WHERE is_demo = true);
DELETE FROM public.demo_runs;
DELETE FROM public.clients WHERE is_demo = true;

-- 2. Add user_id link on clients (nullable; one client per auth user max).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_uniq ON public.clients(user_id) WHERE user_id IS NOT NULL;

-- 3. RLS: a coached client can read own client row + own assessment.
DROP POLICY IF EXISTS "coached client reads own row" ON public.clients;
CREATE POLICY "coached client reads own row"
  ON public.clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "coached client reads own assessment" ON public.assessments;
CREATE POLICY "coached client reads own assessment"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
