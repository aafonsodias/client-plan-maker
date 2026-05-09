
-- 1. Add default_cadence_days to capacity_domains
ALTER TABLE public.capacity_domains
  ADD COLUMN IF NOT EXISTS default_cadence_days integer NOT NULL DEFAULT 28;

-- Seed evidence-based defaults
UPDATE public.capacity_domains SET default_cadence_days = 28 WHERE slug = 'cardiorespiratory';
UPDATE public.capacity_domains SET default_cadence_days = 28 WHERE slug = 'muscular_strength';
UPDATE public.capacity_domains SET default_cadence_days = 21 WHERE slug = 'muscular_endurance';
UPDATE public.capacity_domains SET default_cadence_days = 14 WHERE slug = 'flexibility';
UPDATE public.capacity_domains SET default_cadence_days = 28 WHERE slug = 'body_composition';
UPDATE public.capacity_domains SET default_cadence_days = 28 WHERE slug = 'power';
UPDATE public.capacity_domains SET default_cadence_days = 14 WHERE slug = 'balance';
UPDATE public.capacity_domains SET default_cadence_days = 21 WHERE slug = 'coordination';
UPDATE public.capacity_domains SET default_cadence_days = 21 WHERE slug = 'agility';
UPDATE public.capacity_domains SET default_cadence_days = 21 WHERE slug = 'cognitive_motor';
UPDATE public.capacity_domains SET default_cadence_days = 28 WHERE slug = 'movement_quality';
UPDATE public.capacity_domains SET default_cadence_days = 14 WHERE slug = 'autonomic_regulation';

-- 2. Per-client per-domain override table
CREATE TABLE IF NOT EXISTS public.client_measurement_cadence (
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  domain_slug text NOT NULL REFERENCES public.capacity_domains(slug) ON DELETE CASCADE,
  interval_days integer NOT NULL CHECK (interval_days BETWEEN 7 AND 90),
  set_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, domain_slug)
);

ALTER TABLE public.client_measurement_cadence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer full access cadence"
  ON public.client_measurement_cadence
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.trainer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.trainer_id = auth.uid()));

CREATE TRIGGER trg_cadence_updated_at
  BEFORE UPDATE ON public.client_measurement_cadence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
