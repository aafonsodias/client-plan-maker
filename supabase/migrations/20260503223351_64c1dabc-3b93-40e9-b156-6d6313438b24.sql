
ALTER TABLE public.assessments
  ALTER COLUMN training_location TYPE text[]
  USING CASE
    WHEN training_location IS NULL OR training_location = '' THEN NULL
    ELSE string_to_array(training_location, ',')
  END;

CREATE TABLE public.daily_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  trainer_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  steps integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, date)
);

ALTER TABLE public.daily_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own activity log"
  ON public.daily_activity_log FOR ALL
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE INDEX idx_daily_activity_log_client_date
  ON public.daily_activity_log (client_id, date DESC);

CREATE TRIGGER trg_daily_activity_log_updated
  BEFORE UPDATE ON public.daily_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
