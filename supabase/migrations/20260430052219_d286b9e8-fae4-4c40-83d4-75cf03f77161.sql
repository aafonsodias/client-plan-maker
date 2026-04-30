-- ============================================================
-- SECURITY HARDENING — Forge red-team remediations
-- ============================================================

-- ── 1) Add expiry for share_token on workout_plans ─────────
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS workout_plans_share_token_idx
  ON public.workout_plans(share_token)
  WHERE share_token IS NOT NULL;

-- ── 2) Lock down clients UPDATE for public intake ──────────
-- Drop the over-permissive policy that lets the intake-token holder
-- modify trainer_id, intake_token, intake_status, etc.
DROP POLICY IF EXISTS "public intake can update own client row" ON public.clients;

-- Replacement: intake holder may UPDATE only a small whitelist of
-- profile fields. Sensitive routing/auth columns are off-limits.
-- We enforce this with a BEFORE UPDATE trigger that reverts any
-- change to a protected column when the call comes from the anon role
-- (i.e., an intake-token request, not a logged-in trainer).
CREATE OR REPLACE FUNCTION public.protect_client_intake_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trainers (authenticated as the row owner) bypass the lockdown.
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.trainer_id THEN
    RETURN NEW;
  END IF;

  -- For anon/intake updates: revert any change to protected columns.
  NEW.id                       := OLD.id;
  NEW.trainer_id               := OLD.trainer_id;
  NEW.intake_token             := OLD.intake_token;
  NEW.intake_token_expires_at  := OLD.intake_token_expires_at;
  NEW.intake_status            := OLD.intake_status;
  NEW.intake_submitted_at      := OLD.intake_submitted_at;
  NEW.created_at               := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_protect_intake_columns ON public.clients;
CREATE TRIGGER clients_protect_intake_columns
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_client_intake_columns();

-- Re-create a narrowed UPDATE policy.
CREATE POLICY "public intake can update own client row"
ON public.clients
FOR UPDATE
TO anon, authenticated
USING (
  intake_token IS NOT NULL
  AND (intake_token)::text = ((current_setting('request.headers', true))::json ->> 'x-intake-token')
  AND intake_token_expires_at > now()
)
WITH CHECK (
  intake_token IS NOT NULL
  AND (intake_token)::text = ((current_setting('request.headers', true))::json ->> 'x-intake-token')
  AND intake_token_expires_at > now()
);

-- ── 3) Replace profiles branding policy with safe RPC ──────
-- Drop the policy that exposed the entire profiles row (incl. contact_email/phone).
DROP POLICY IF EXISTS "public intake can read trainer branding" ON public.profiles;

-- Public-safe branding-only function. Returns the minimal fields the
-- intake form needs and nothing else.
CREATE OR REPLACE FUNCTION public.get_intake_branding(_token UUID)
RETURNS TABLE (
  business_name TEXT,
  full_name     TEXT,
  logo_url      TEXT,
  primary_color TEXT,
  tagline       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.business_name, p.full_name, p.logo_url, p.primary_color, p.tagline
  FROM public.profiles p
  JOIN public.clients c ON c.trainer_id = p.user_id
  WHERE c.intake_token = _token
    AND c.intake_token_expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_intake_branding(UUID) TO anon, authenticated;