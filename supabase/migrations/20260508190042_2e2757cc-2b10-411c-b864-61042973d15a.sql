-- 1. capacity_domains template
CREATE TABLE public.capacity_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_key text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('health_related','skill_related','integrative')),
  display_order int NOT NULL,
  evidence_summary_key text NOT NULL,
  reference_assessments jsonb NOT NULL DEFAULT '[]'::jsonb,
  norm_reference_source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_capacity_domains_tier_order ON public.capacity_domains(tier, display_order);

ALTER TABLE public.capacity_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read capacity domains"
  ON public.capacity_domains FOR SELECT TO authenticated
  USING (true);

-- 2. client_capacity_snapshots
CREATE TABLE public.client_capacity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  domain_slug text NOT NULL REFERENCES public.capacity_domains(slug),
  measured_at timestamptz NOT NULL DEFAULT now(),
  raw_value numeric,
  raw_unit text,
  normalized_score numeric CHECK (normalized_score BETWEEN 0 AND 100),
  test_used text,
  provenance text NOT NULL CHECK (provenance IN ('self_report','pt_assessed','device_measured','ai_inferred','intake_derived')),
  notes text,
  evidence_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_capacity_snapshots_client_domain
  ON public.client_capacity_snapshots(client_id, domain_slug, measured_at DESC);

ALTER TABLE public.client_capacity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer full access snapshots"
  ON public.client_capacity_snapshots FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = client_id AND c.trainer_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = client_id AND c.trainer_id = auth.uid())
  );

CREATE POLICY "client read own snapshots"
  ON public.client_capacity_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = client_id AND c.user_id = auth.uid())
  );

-- 3. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_capacity_snapshots;

-- 4. Seed the 11 capacity domains
INSERT INTO public.capacity_domains (slug, name_key, tier, display_order, evidence_summary_key, norm_reference_source) VALUES
  ('cardiorespiratory', 'capacity.cardiorespiratory.name', 'health_related', 1, 'capacity.cardiorespiratory.evidence', 'ACSM 12e'),
  ('muscular_strength', 'capacity.muscular_strength.name', 'health_related', 2, 'capacity.muscular_strength.evidence', 'ACSM 12e'),
  ('muscular_endurance', 'capacity.muscular_endurance.name', 'health_related', 3, 'capacity.muscular_endurance.evidence', 'ACSM 12e'),
  ('flexibility', 'capacity.flexibility.name', 'health_related', 4, 'capacity.flexibility.evidence', 'ACSM 12e'),
  ('body_composition', 'capacity.body_composition.name', 'health_related', 5, 'capacity.body_composition.evidence', 'NHANES 2017-2020'),
  ('power', 'capacity.power.name', 'skill_related', 6, 'capacity.power.evidence', 'NSCA Essentials 4e'),
  ('balance', 'capacity.balance.name', 'skill_related', 7, 'capacity.balance.evidence', 'Berg Balance Scale norms'),
  ('coordination', 'capacity.coordination.name', 'skill_related', 8, 'capacity.coordination.evidence', 'NSCA Essentials 4e'),
  ('agility', 'capacity.agility.name', 'skill_related', 9, 'capacity.agility.evidence', 'NSCA Essentials 4e'),
  ('cognitive_motor', 'capacity.cognitive_motor.name', 'integrative', 10, 'capacity.cognitive_motor.evidence', 'Plummer et al 2013 systematic review'),
  ('movement_quality', 'capacity.movement_quality.name', 'integrative', 11, 'capacity.movement_quality.evidence', 'FMS / SFMA literature');