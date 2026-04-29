-- Restrict subscribers RLS — service role bypasses RLS so we don't need permissive policies
DROP POLICY IF EXISTS "edge functions insert subscriptions" ON public.subscribers;
DROP POLICY IF EXISTS "edge functions update subscriptions" ON public.subscribers;

-- Logos: drop broad SELECT, allow public read only by direct URL via trainer-owned folder
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "trainers read own logos" ON storage.objects FOR SELECT
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Lock down SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;