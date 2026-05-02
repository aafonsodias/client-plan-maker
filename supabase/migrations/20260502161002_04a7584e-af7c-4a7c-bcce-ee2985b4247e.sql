
-- 1. client_measurements: daily + periodic logs
CREATE TABLE public.client_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL,
  client_id UUID NOT NULL,
  measured_on DATE NOT NULL DEFAULT CURRENT_DATE,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily','periodic')),
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_measurements_client_date
  ON public.client_measurements (client_id, measured_on DESC);
ALTER TABLE public.client_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainers manage own measurements"
  ON public.client_measurements FOR ALL
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

-- 2. client_measurement_prefs: per-client field selection + cadence
CREATE TABLE public.client_measurement_prefs (
  client_id UUID PRIMARY KEY,
  trainer_id UUID NOT NULL,
  daily_fields TEXT[] NOT NULL DEFAULT '{}',
  periodic_fields TEXT[] NOT NULL DEFAULT '{}',
  periodic_interval_days INT NOT NULL DEFAULT 14,
  reassessment_interval_days INT NOT NULL DEFAULT 56,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_measurement_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainers manage own measurement prefs"
  ON public.client_measurement_prefs FOR ALL
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);
CREATE TRIGGER trg_client_measurement_prefs_updated_at
  BEFORE UPDATE ON public.client_measurement_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. assessment kind (full vs reassessment)
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'full';

-- 4. trainer_summary on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS trainer_summary TEXT;

-- 5. completion_state on workout_plans
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS completion_state TEXT;
