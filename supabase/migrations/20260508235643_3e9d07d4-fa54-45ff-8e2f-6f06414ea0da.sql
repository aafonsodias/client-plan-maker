-- ============================================================================
-- R70 — Casa do cliente (golden standard)
-- 1. client_checkins table — daily sleep/soreness/energy from the client.
--    Reused later by autoreg (programNextWeek) to detect days when the
--    client is undertraining vs. cooked. One row per (client, date).
-- 2. storage policies for "progress" subfolder in the existing
--    private client-photos bucket — owner is the client (not the trainer).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  trainer_id      uuid NOT NULL,
  checked_on      date NOT NULL DEFAULT CURRENT_DATE,
  sleep_quality   integer,
  soreness_level  integer,
  energy_level    integer,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, checked_on)
);

CREATE INDEX IF NOT EXISTS idx_client_checkins_client_date
  ON public.client_checkins (client_id, checked_on DESC);

-- Range validation via trigger (CHECK constraints would be fine here but the
-- trigger keeps us consistent with the rest of the project).
CREATE OR REPLACE FUNCTION public.validate_client_checkin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sleep_quality IS NOT NULL AND (NEW.sleep_quality < 1 OR NEW.sleep_quality > 5) THEN
    RAISE EXCEPTION 'sleep_quality must be between 1 and 5';
  END IF;
  IF NEW.soreness_level IS NOT NULL AND (NEW.soreness_level < 0 OR NEW.soreness_level > 10) THEN
    RAISE EXCEPTION 'soreness_level must be between 0 and 10';
  END IF;
  IF NEW.energy_level IS NOT NULL AND (NEW.energy_level < 1 OR NEW.energy_level > 5) THEN
    RAISE EXCEPTION 'energy_level must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_client_checkin ON public.client_checkins;
CREATE TRIGGER trg_validate_client_checkin
  BEFORE INSERT OR UPDATE ON public.client_checkins
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_checkin();

DROP TRIGGER IF EXISTS trg_client_checkins_updated ON public.client_checkins;
CREATE TRIGGER trg_client_checkins_updated
  BEFORE UPDATE ON public.client_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.client_checkins ENABLE ROW LEVEL SECURITY;

-- Trainer (owns the client) — full access
CREATE POLICY "trainers manage own client checkins"
  ON public.client_checkins
  FOR ALL
  TO authenticated
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

-- Coached client — read/insert/update their own check-ins
CREATE POLICY "client read own checkins"
  ON public.client_checkins
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_checkins.client_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "client insert own checkins"
  ON public.client_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_checkins.client_id
      AND c.user_id = auth.uid()
      AND c.trainer_id = client_checkins.trainer_id
  ));

CREATE POLICY "client update own checkins"
  ON public.client_checkins
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_checkins.client_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_checkins.client_id AND c.user_id = auth.uid()
  ));

-- ============================================================================
-- Storage: client-uploaded progress photos in the existing private bucket.
-- Path convention: progress/{clientId}/{filename}
-- Trainer of that client can also read.
-- ============================================================================

-- Coached client uploads their own progress photo.
CREATE POLICY "client upload own progress photo"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = 'progress'
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND c.user_id = auth.uid()
    )
  );

-- Coached client reads their own progress photos.
CREATE POLICY "client read own progress photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = 'progress'
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND c.user_id = auth.uid()
    )
  );

-- Coached client deletes their own progress photos (e.g. mistake upload).
CREATE POLICY "client delete own progress photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = 'progress'
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND c.user_id = auth.uid()
    )
  );

-- Trainer reads progress photos of their clients.
CREATE POLICY "trainer read clients progress photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = 'progress'
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND c.trainer_id = auth.uid()
    )
  );