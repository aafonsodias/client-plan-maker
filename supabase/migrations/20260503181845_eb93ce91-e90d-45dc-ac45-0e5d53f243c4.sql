-- Sync subscription_tier → profiles.plan_quota_limit
-- Tier caps mirror Core memory: Starter 8, Pro 30, Studio 80; default (trial/none) keeps current value or 1.

CREATE OR REPLACE FUNCTION public.tier_to_plan_quota(_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_tier, ''))
    WHEN 'starter' THEN 8
    WHEN 'pro'     THEN 30
    WHEN 'studio'  THEN 80
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_plan_quota_from_subscriber()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cap integer;
BEGIN
  _cap := public.tier_to_plan_quota(NEW.subscription_tier);
  IF _cap IS NOT NULL THEN
    UPDATE public.profiles
       SET plan_quota_limit = _cap,
           updated_at = now()
     WHERE user_id = NEW.user_id
       AND plan_quota_limit IS DISTINCT FROM _cap;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_plan_quota_from_subscriber ON public.subscribers;
CREATE TRIGGER trg_sync_plan_quota_from_subscriber
AFTER INSERT OR UPDATE OF subscription_tier, subscribed ON public.subscribers
FOR EACH ROW EXECUTE FUNCTION public.sync_plan_quota_from_subscriber();

-- Backfill existing rows
UPDATE public.profiles p
   SET plan_quota_limit = public.tier_to_plan_quota(s.subscription_tier),
       updated_at = now()
  FROM public.subscribers s
 WHERE s.user_id = p.user_id
   AND public.tier_to_plan_quota(s.subscription_tier) IS NOT NULL
   AND p.plan_quota_limit IS DISTINCT FROM public.tier_to_plan_quota(s.subscription_tier);
