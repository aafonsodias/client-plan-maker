-- Wave B: free-plan quota gate per account
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_quota_used  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_quota_limit INTEGER NOT NULL DEFAULT 1;

-- Backfill quota_used from existing completed plans so existing trainers
-- aren't accidentally given more free plans on top of what they already have.
UPDATE public.profiles p
SET plan_quota_used = sub.cnt
FROM (
  SELECT trainer_id, COUNT(*)::int AS cnt
  FROM public.workout_plans
  WHERE generation_status = 'complete'
  GROUP BY trainer_id
) sub
WHERE p.user_id = sub.trainer_id;

-- Trigger: increment trainer's plan_quota_used the first time a plan
-- transitions into generation_status = 'complete'. Runs in the same
-- transaction as the UPDATE so it's race-safe.
CREATE OR REPLACE FUNCTION public.bump_plan_quota_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.generation_status = 'complete'
     AND (OLD.generation_status IS DISTINCT FROM 'complete') THEN
    UPDATE public.profiles
       SET plan_quota_used = plan_quota_used + 1
     WHERE user_id = NEW.trainer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_plan_quota ON public.workout_plans;
CREATE TRIGGER trg_bump_plan_quota
AFTER UPDATE OF generation_status ON public.workout_plans
FOR EACH ROW
EXECUTE FUNCTION public.bump_plan_quota_on_complete();

-- Helper: free trainer = no active subscriber row.
CREATE OR REPLACE FUNCTION public.can_create_more_plans(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_active_access(_user_id)
    OR COALESCE((
      SELECT plan_quota_used < plan_quota_limit
      FROM public.profiles
      WHERE user_id = _user_id
    ), true);
$$;