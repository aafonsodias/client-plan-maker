
-- 1. Auto-create a 14-day trial subscriber row whenever a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, trial_end)
  VALUES (
    NEW.id,
    NEW.email,
    false,
    'trialing',
    now() + interval '14 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Ensure user_id is unique so the ON CONFLICT works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscribers_user_id_unique'
  ) THEN
    ALTER TABLE public.subscribers ADD CONSTRAINT subscribers_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();

-- 2. Backfill: any existing trainer without a subscriber row gets a 14-day trial starting now.
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, trial_end)
SELECT u.id, u.email, false, 'trialing', now() + interval '14 days'
FROM auth.users u
LEFT JOIN public.subscribers s ON s.user_id = u.id
WHERE s.user_id IS NULL;

-- 3. has_active_access(user_id): true if trial active OR subscription active.
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscribers
    WHERE user_id = _user_id
      AND (
        (subscribed = true AND (current_period_end IS NULL OR current_period_end > now()))
        OR (trial_end IS NOT NULL AND trial_end > now())
      )
  );
$$;

-- 4. Service role already bypasses RLS — no need for write policies. Block client-side writes explicitly.
-- (subscribers already has only a SELECT policy for own row, which is what we want.)
