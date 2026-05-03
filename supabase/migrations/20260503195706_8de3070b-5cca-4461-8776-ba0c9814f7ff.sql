CREATE TABLE public.acsm_populations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  population text NOT NULL,
  trigger_criteria text,
  one_line_summary text,
  source_chapter integer,
  citation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acsm_populations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainers read acsm populations"
  ON public.acsm_populations
  FOR SELECT
  TO authenticated
  USING (true);
