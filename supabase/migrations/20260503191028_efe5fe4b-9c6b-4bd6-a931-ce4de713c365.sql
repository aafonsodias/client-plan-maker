
-- =========================================================
-- R28 · My Schedule — client_packs + client_bookings
-- =========================================================

-- Pack: a commercial commitment between trainer & client
CREATE TABLE public.client_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid NOT NULL,
  client_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Pack',
  session_type text NOT NULL DEFAULT 'in_person',
  price_per_session_eur numeric(10,2) NOT NULL DEFAULT 0,
  pack_size integer NOT NULL DEFAULT 10,
  sessions_used integer NOT NULL DEFAULT 0,
  weekly_frequency integer NOT NULL DEFAULT 2,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  color text NOT NULL DEFAULT 'emerald',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_packs_trainer ON public.client_packs(trainer_id);
CREATE INDEX idx_client_packs_client ON public.client_packs(client_id);

ALTER TABLE public.client_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own client packs"
  ON public.client_packs FOR ALL
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

-- Validation trigger (no CHECK with now() — per non-negotiables)
CREATE OR REPLACE FUNCTION public.validate_client_pack()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.session_type NOT IN ('in_person', 'online') THEN
    RAISE EXCEPTION 'session_type must be in_person or online';
  END IF;
  IF NEW.price_per_session_eur < 0 OR NEW.price_per_session_eur > 10000 THEN
    RAISE EXCEPTION 'price_per_session_eur out of range';
  END IF;
  IF NEW.pack_size < 1 OR NEW.pack_size > 500 THEN
    RAISE EXCEPTION 'pack_size out of range';
  END IF;
  IF NEW.weekly_frequency < 0 OR NEW.weekly_frequency > 14 THEN
    RAISE EXCEPTION 'weekly_frequency out of range';
  END IF;
  IF NEW.sessions_used < 0 THEN
    NEW.sessions_used := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_client_pack
  BEFORE INSERT OR UPDATE ON public.client_packs
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_pack();

CREATE TRIGGER trg_client_packs_updated_at
  BEFORE UPDATE ON public.client_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Booking: a scheduled training session
CREATE TABLE public.client_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid NOT NULL,
  client_id uuid NOT NULL,
  pack_id uuid NULL REFERENCES public.client_packs(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 60,
  session_type text NOT NULL DEFAULT 'in_person',
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_bookings_trainer ON public.client_bookings(trainer_id);
CREATE INDEX idx_client_bookings_client ON public.client_bookings(client_id);
CREATE INDEX idx_client_bookings_starts_at ON public.client_bookings(starts_at);
CREATE INDEX idx_client_bookings_pack ON public.client_bookings(pack_id);

ALTER TABLE public.client_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own client bookings"
  ON public.client_bookings FOR ALL
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE OR REPLACE FUNCTION public.validate_client_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.session_type NOT IN ('in_person', 'online') THEN
    RAISE EXCEPTION 'session_type must be in_person or online';
  END IF;
  IF NEW.status NOT IN ('scheduled', 'done', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'status must be scheduled, done, cancelled, or no_show';
  END IF;
  IF NEW.duration_min < 5 OR NEW.duration_min > 480 THEN
    RAISE EXCEPTION 'duration_min out of range (5-480)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_client_booking
  BEFORE INSERT OR UPDATE ON public.client_bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_booking();

CREATE TRIGGER trg_client_bookings_updated_at
  BEFORE UPDATE ON public.client_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Maintain client_packs.sessions_used as bookings transition to/from 'done'
CREATE OR REPLACE FUNCTION public.bump_pack_sessions_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_done boolean := (TG_OP = 'UPDATE' AND OLD.status = 'done' AND OLD.pack_id IS NOT NULL);
  is_done  boolean := (NEW.status = 'done' AND NEW.pack_id IS NOT NULL);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF is_done THEN
      UPDATE public.client_packs SET sessions_used = sessions_used + 1
      WHERE id = NEW.pack_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- pack changed
    IF was_done AND OLD.pack_id IS DISTINCT FROM NEW.pack_id THEN
      UPDATE public.client_packs SET sessions_used = GREATEST(0, sessions_used - 1)
      WHERE id = OLD.pack_id;
    END IF;
    -- transition into done
    IF is_done AND NOT was_done THEN
      UPDATE public.client_packs SET sessions_used = sessions_used + 1
      WHERE id = NEW.pack_id;
    END IF;
    -- transition out of done (same pack)
    IF was_done AND NOT is_done AND OLD.pack_id = NEW.pack_id THEN
      UPDATE public.client_packs SET sessions_used = GREATEST(0, sessions_used - 1)
      WHERE id = OLD.pack_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'done' AND OLD.pack_id IS NOT NULL THEN
      UPDATE public.client_packs SET sessions_used = GREATEST(0, sessions_used - 1)
      WHERE id = OLD.pack_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_pack_sessions_used
  AFTER INSERT OR UPDATE OR DELETE ON public.client_bookings
  FOR EACH ROW EXECUTE FUNCTION public.bump_pack_sessions_used();
