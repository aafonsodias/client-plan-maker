
-- ============================================================================
-- R-D.1 + R-D.2: Adaptation gate tables
-- ============================================================================

-- adaptation_proposals -------------------------------------------------------
CREATE TABLE public.adaptation_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  client_id uuid NOT NULL,
  prior_plan_id uuid NOT NULL,
  proposal jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  engine_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  inputs_hash text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','decided','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_adaptation_proposals_trainer ON public.adaptation_proposals(trainer_id);
CREATE INDEX idx_adaptation_proposals_client ON public.adaptation_proposals(client_id);
CREATE INDEX idx_adaptation_proposals_prior_plan ON public.adaptation_proposals(prior_plan_id);
CREATE INDEX idx_adaptation_proposals_pending
  ON public.adaptation_proposals(trainer_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.adaptation_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own adaptation proposals"
  ON public.adaptation_proposals
  FOR ALL TO authenticated
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "clients read own adaptation proposals"
  ON public.adaptation_proposals
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER trg_adaptation_proposals_updated_at
  BEFORE UPDATE ON public.adaptation_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- adaptation_decisions -------------------------------------------------------
CREATE TABLE public.adaptation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.adaptation_proposals(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('continueAsIs','adjustCurrentSession','adjustUpcoming','defer','accept')),
  rationale text NOT NULL CHECK (length(rationale) >= 1),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_adaptation_decisions_proposal ON public.adaptation_decisions(proposal_id);
CREATE INDEX idx_adaptation_decisions_trainer ON public.adaptation_decisions(trainer_id);

ALTER TABLE public.adaptation_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers read own adaptation decisions"
  ON public.adaptation_decisions
  FOR SELECT TO authenticated
  USING (auth.uid() = trainer_id);

CREATE POLICY "trainers insert own adaptation decisions"
  ON public.adaptation_decisions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = trainer_id AND auth.uid() = decided_by);

CREATE POLICY "clients read own adaptation decisions"
  ON public.adaptation_decisions
  FOR SELECT TO authenticated
  USING (proposal_id IN (
    SELECT p.id FROM public.adaptation_proposals p
    JOIN public.clients c ON c.id = p.client_id
    WHERE c.user_id = auth.uid()
  ));

-- Immutability: same pattern as audit_events
CREATE OR REPLACE FUNCTION public.adaptation_decisions_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'adaptation_decisions is append-only';
END;
$$;

CREATE TRIGGER trg_adaptation_decisions_no_update
  BEFORE UPDATE ON public.adaptation_decisions
  FOR EACH ROW EXECUTE FUNCTION public.adaptation_decisions_immutable();

CREATE TRIGGER trg_adaptation_decisions_no_delete
  BEFORE DELETE ON public.adaptation_decisions
  FOR EACH ROW EXECUTE FUNCTION public.adaptation_decisions_immutable();

-- progress_markers -----------------------------------------------------------
CREATE TABLE public.progress_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL,
  client_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  week_index integer,
  metric text NOT NULL,
  scope text,
  value numeric NOT NULL,
  inputs_hash text NOT NULL,
  engine_version text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_progress_markers_plan ON public.progress_markers(plan_id);
CREATE INDEX idx_progress_markers_client_metric
  ON public.progress_markers(client_id, metric, computed_at DESC);

ALTER TABLE public.progress_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own progress markers"
  ON public.progress_markers
  FOR ALL TO authenticated
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "clients read own progress markers"
  ON public.progress_markers
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
