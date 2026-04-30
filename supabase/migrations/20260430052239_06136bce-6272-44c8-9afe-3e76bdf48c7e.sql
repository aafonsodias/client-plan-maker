-- Revoke broad EXECUTE on the branding function and grant only to service_role.
-- The intake server function uses supabaseAdmin (service role), so this is sufficient.
REVOKE EXECUTE ON FUNCTION public.get_intake_branding(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_intake_branding(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_intake_branding(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_intake_branding(UUID) TO service_role;

-- protect_client_intake_columns is a trigger function only — never called directly.
REVOKE EXECUTE ON FUNCTION public.protect_client_intake_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_client_intake_columns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_client_intake_columns() FROM authenticated;