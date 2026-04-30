-- 1. Intake status enum
DO $$ BEGIN
  CREATE TYPE public.intake_status AS ENUM ('not_sent', 'sent', 'opened', 'submitted', 'reviewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. New columns on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS intake_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS intake_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS intake_status public.intake_status NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS intake_submitted_at timestamptz;

CREATE INDEX IF NOT EXISTS clients_intake_token_idx ON public.clients(intake_token);

-- 3. Public read of minimal client fields when a valid token is supplied via request header.
--    The intake page sets PostgREST header `x-intake-token: <uuid>` on its supabase client,
--    which surfaces inside RLS as request.header.
CREATE POLICY "public intake can read own client row"
  ON public.clients
  FOR SELECT
  TO anon, authenticated
  USING (
    intake_token IS NOT NULL
    AND intake_token::text = current_setting('request.headers', true)::json->>'x-intake-token'
    AND intake_token_expires_at > now()
  );

-- 4. Allow public intake to read trainer branding (only fields exposed by SELECT cols below — but RLS is row-level, so we expose the row; the route only selects the branding columns).
CREATE POLICY "public intake can read trainer branding"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    user_id IN (
      SELECT trainer_id FROM public.clients
      WHERE intake_token IS NOT NULL
        AND intake_token::text = current_setting('request.headers', true)::json->>'x-intake-token'
        AND intake_token_expires_at > now()
    )
  );

-- 5. Allow public intake to upsert/update the matching assessment row
CREATE POLICY "public intake can read own assessment"
  ON public.assessments
  FOR SELECT
  TO anon, authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE intake_token IS NOT NULL
        AND intake_token::text = current_setting('request.headers', true)::json->>'x-intake-token'
        AND intake_token_expires_at > now()
        AND intake_status <> 'reviewed'
    )
  );

CREATE POLICY "public intake can insert own assessment"
  ON public.assessments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE intake_token IS NOT NULL
        AND intake_token::text = current_setting('request.headers', true)::json->>'x-intake-token'
        AND intake_token_expires_at > now()
        AND intake_status <> 'reviewed'
    )
  );

CREATE POLICY "public intake can update own assessment"
  ON public.assessments
  FOR UPDATE
  TO anon, authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE intake_token IS NOT NULL
        AND intake_token::text = current_setting('request.headers', true)::json->>'x-intake-token'
        AND intake_token_expires_at > now()
        AND intake_status <> 'reviewed'
    )
  );

-- 6. Allow public intake to update its own client row (status transitions only — column-level
--    restriction enforced in app code; RLS still scoped to matching token).
CREATE POLICY "public intake can update own client row"
  ON public.clients
  FOR UPDATE
  TO anon, authenticated
  USING (
    intake_token IS NOT NULL
    AND intake_token::text = current_setting('request.headers', true)::json->>'x-intake-token'
    AND intake_token_expires_at > now()
  );