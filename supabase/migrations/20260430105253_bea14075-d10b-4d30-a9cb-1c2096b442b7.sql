
REVOKE EXECUTE ON FUNCTION public.has_active_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_trial() FROM anon, authenticated;
