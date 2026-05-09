-- Realtime + replica identity for live message updates
ALTER TABLE public.plan_feedback REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'plan_feedback'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_feedback';
  END IF;
END $$;

-- Let the linked client read their own messages (RLS).
-- The existing trainer policy stays untouched.
CREATE POLICY "clients read own plan_feedback"
ON public.plan_feedback
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
);

-- Let the linked client insert messages tied to their own record.
CREATE POLICY "clients insert own plan_feedback"
ON public.plan_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  author = 'client'
  AND client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
);