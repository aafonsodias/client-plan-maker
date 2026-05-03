REVOKE EXECUTE ON FUNCTION public.bump_plan_quota_on_complete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_trial() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_create_more_plans(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_access(uuid) FROM PUBLIC, anon, authenticated;

DROP TABLE IF EXISTS public.backup_workout_plans_20260430;
DROP TABLE IF EXISTS public.backup_workout_plan_days_20260430;