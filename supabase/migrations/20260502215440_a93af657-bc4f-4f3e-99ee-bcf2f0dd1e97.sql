-- Plan templates: trainers save and reuse plan structures
CREATE TABLE public.plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_plan_id UUID,
  duration_weeks INTEGER NOT NULL DEFAULT 4,
  plan_data JSONB NOT NULL DEFAULT '{"weeks": []}'::jsonb,
  blueprint JSONB,
  programming_variables JSONB,
  brief JSONB,
  tags TEXT[] NOT NULL DEFAULT '{}',
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers manage own plan templates"
ON public.plan_templates FOR ALL
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);

CREATE INDEX idx_plan_templates_trainer ON public.plan_templates(trainer_id, updated_at DESC);

CREATE TRIGGER trg_plan_templates_updated_at
BEFORE UPDATE ON public.plan_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();