
-- ACSM 12th Edition knowledge spine (Round 1)

CREATE TABLE public.acsm_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_number int NOT NULL UNIQUE,
  title text NOT NULL,
  page_start int,
  page_end int,
  paraphrased_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.acsm_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.acsm_chapters(id) ON DELETE CASCADE,
  section_code text NOT NULL,
  title text NOT NULL,
  page_start int,
  page_end int,
  paraphrased_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, section_code)
);

CREATE TABLE public.acsm_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  population text NOT NULL DEFAULT 'general',
  parameter text NOT NULL,
  value_low numeric,
  value_high numeric,
  unit text,
  citation text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX acsm_rec_topic_pop_idx ON public.acsm_recommendations (topic, population);

CREATE TABLE public.acsm_contraindications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition text NOT NULL,
  modality text NOT NULL,
  severity text NOT NULL DEFAULT 'relative',
  citation text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX acsm_contra_condition_idx ON public.acsm_contraindications (condition);

CREATE TABLE public.acsm_normatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test text NOT NULL,
  sex text,
  age_low int,
  age_high int,
  percentile int,
  value numeric NOT NULL,
  unit text,
  citation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX acsm_norm_test_idx ON public.acsm_normatives (test, sex, age_low, age_high);

-- RLS: paraphrased prose locked to service role; derived facts readable by signed-in trainers
ALTER TABLE public.acsm_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acsm_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acsm_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acsm_contraindications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acsm_normatives ENABLE ROW LEVEL SECURITY;

-- No client-readable policy for chapters/sections (only service role bypasses RLS)

CREATE POLICY "trainers read acsm recommendations"
  ON public.acsm_recommendations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "trainers read acsm contraindications"
  ON public.acsm_contraindications FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "trainers read acsm normatives"
  ON public.acsm_normatives FOR SELECT
  TO authenticated USING (true);

-- updated_at triggers (reuse existing helper)
CREATE TRIGGER trg_acsm_chapters_updated BEFORE UPDATE ON public.acsm_chapters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_acsm_sections_updated BEFORE UPDATE ON public.acsm_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_acsm_recommendations_updated BEFORE UPDATE ON public.acsm_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_acsm_contraindications_updated BEFORE UPDATE ON public.acsm_contraindications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
