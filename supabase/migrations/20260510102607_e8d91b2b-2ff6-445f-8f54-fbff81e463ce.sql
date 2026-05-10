-- R-C: log unmatched skill aspirations for founder review and future template curation
CREATE TABLE public.assessment_unmatched_aspirations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  trainer_id uuid NOT NULL,
  aspiration_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_unmatched_aspirations_trainer ON public.assessment_unmatched_aspirations(trainer_id, created_at DESC);
CREATE INDEX idx_unmatched_aspirations_client  ON public.assessment_unmatched_aspirations(client_id);

ALTER TABLE public.assessment_unmatched_aspirations ENABLE ROW LEVEL SECURITY;

-- Trainers can fully manage entries for their own clients.
CREATE POLICY "trainers manage own unmatched aspirations"
ON public.assessment_unmatched_aspirations
FOR ALL
TO authenticated
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);

-- Public intake (anon w/ valid intake token on the client row) may insert.
CREATE POLICY "public intake can insert unmatched aspirations"
ON public.assessment_unmatched_aspirations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.intake_token IS NOT NULL
      AND (c.intake_token)::text = ((current_setting('request.headers', true))::json ->> 'x-intake-token')
      AND c.intake_token_expires_at > now()
      AND c.trainer_id = assessment_unmatched_aspirations.trainer_id
  )
);