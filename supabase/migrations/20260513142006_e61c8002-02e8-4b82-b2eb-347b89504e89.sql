
-- ============================================================================
-- audit_events: append-only domain audit log
-- ============================================================================
CREATE TABLE public.audit_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid NOT NULL,
  actor_id uuid,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  engine_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  upstream_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_trainer_created ON public.audit_events(trainer_id, created_at DESC);
CREATE INDEX idx_audit_events_entity ON public.audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_type ON public.audit_events(event_type);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers read own audit events"
  ON public.audit_events FOR SELECT
  TO authenticated
  USING (auth.uid() = trainer_id);

-- No INSERT/UPDATE/DELETE policies for users — only service role writes.

-- Block any update / delete even via service role guards
CREATE OR REPLACE FUNCTION public.audit_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

CREATE TRIGGER trg_audit_events_no_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();

CREATE TRIGGER trg_audit_events_no_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();

-- ============================================================================
-- screening_evaluations: PAR-Q+ / ePARmed-X+ / future protocols
-- ============================================================================
CREATE TABLE public.screening_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid NOT NULL,
  client_id uuid NOT NULL,
  assessment_id uuid,
  protocol text NOT NULL,
  protocol_version text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_band text NOT NULL CHECK (risk_band IN ('green','yellow','red')),
  intensity_ceiling text NOT NULL CHECK (intensity_ceiling IN ('light','moderate','vigorous')),
  clearance_required boolean NOT NULL DEFAULT false,
  clearance_reason text,
  structured_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluator_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_screening_evals_client_created
  ON public.screening_evaluations(client_id, created_at DESC);
CREATE INDEX idx_screening_evals_trainer
  ON public.screening_evaluations(trainer_id);

ALTER TABLE public.screening_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own client screenings"
  ON public.screening_evaluations FOR ALL
  TO authenticated
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "clients read own screenings"
  ON public.screening_evaluations FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

CREATE TRIGGER trg_screening_evals_no_update
  BEFORE UPDATE ON public.screening_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();
