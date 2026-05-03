REVOKE EXECUTE ON FUNCTION public.sync_plan_quota_from_subscriber() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tier_to_plan_quota(text) FROM PUBLIC, anon, authenticated;