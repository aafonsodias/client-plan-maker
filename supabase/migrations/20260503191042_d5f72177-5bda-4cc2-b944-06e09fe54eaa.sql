
REVOKE EXECUTE ON FUNCTION public.bump_pack_sessions_used() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_client_pack() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_client_booking() FROM PUBLIC, anon, authenticated;
