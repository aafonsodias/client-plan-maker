-- Tighten public-intake INSERT on assessments: trainer_id MUST match the client's real trainer.
DROP POLICY IF EXISTS "public intake can insert own assessment" ON public.assessments;

CREATE POLICY "public intake can insert own assessment"
ON public.assessments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.intake_token IS NOT NULL
      AND (c.intake_token)::text = ((current_setting('request.headers', true))::json ->> 'x-intake-token')
      AND c.intake_token_expires_at > now()
      AND c.intake_status <> 'reviewed'
      AND c.trainer_id = assessments.trainer_id
  )
);