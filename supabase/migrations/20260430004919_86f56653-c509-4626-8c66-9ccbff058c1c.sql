ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS sleep_quality integer,
  ADD COLUMN IF NOT EXISTS stress_level integer,
  ADD COLUMN IF NOT EXISTS nutrition_habits text,
  ADD COLUMN IF NOT EXISTS hydration_glasses_per_day integer,
  ADD COLUMN IF NOT EXISTS mobility_limitations text,
  ADD COLUMN IF NOT EXISTS energy_levels text,
  ADD COLUMN IF NOT EXISTS recovery_capacity text,
  ADD COLUMN IF NOT EXISTS lifestyle text;

-- Validation trigger for ranges (1-10 scales) instead of CHECK constraints
CREATE OR REPLACE FUNCTION public.validate_assessment_ranges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sleep_quality IS NOT NULL AND (NEW.sleep_quality < 1 OR NEW.sleep_quality > 10) THEN
    RAISE EXCEPTION 'sleep_quality must be between 1 and 10';
  END IF;
  IF NEW.stress_level IS NOT NULL AND (NEW.stress_level < 1 OR NEW.stress_level > 10) THEN
    RAISE EXCEPTION 'stress_level must be between 1 and 10';
  END IF;
  IF NEW.hydration_glasses_per_day IS NOT NULL AND (NEW.hydration_glasses_per_day < 0 OR NEW.hydration_glasses_per_day > 50) THEN
    RAISE EXCEPTION 'hydration_glasses_per_day must be between 0 and 50';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_assessment_ranges_trigger ON public.assessments;
CREATE TRIGGER validate_assessment_ranges_trigger
BEFORE INSERT OR UPDATE ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION public.validate_assessment_ranges();