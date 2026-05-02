
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.workout_plans ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS demo_seeded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clients_trainer_demo ON public.clients(trainer_id, is_demo);
CREATE INDEX IF NOT EXISTS idx_plans_trainer_demo ON public.workout_plans(trainer_id, is_demo);

CREATE OR REPLACE FUNCTION public.bump_plan_quota_on_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.generation_status = 'complete'
     AND (OLD.generation_status IS DISTINCT FROM 'complete')
     AND COALESCE(NEW.is_demo, false) = false THEN
    UPDATE public.profiles
       SET plan_quota_used = plan_quota_used + 1
     WHERE user_id = NEW.trainer_id;
  END IF;
  RETURN NEW;
END;
$function$;
