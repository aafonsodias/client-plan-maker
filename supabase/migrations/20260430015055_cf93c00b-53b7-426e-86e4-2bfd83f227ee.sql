ALTER TABLE public.assessments
  ADD COLUMN standing_posture_notes text,
  ADD COLUMN known_imbalances text,
  ADD COLUMN dominant_side text,
  ADD COLUMN squat_depth_score integer,
  ADD COLUMN squat_depth_note text,
  ADD COLUMN overhead_reach_score integer,
  ADD COLUMN overhead_reach_note text,
  ADD COLUMN hip_hinge_score integer,
  ADD COLUMN hip_hinge_note text,
  ADD COLUMN single_leg_balance_score integer,
  ADD COLUMN single_leg_balance_note text,
  ADD COLUMN years_training numeric,
  ADD COLUMN previous_program_style text,
  ADD COLUMN max_lifts text,
  ADD COLUMN resting_heart_rate integer,
  ADD COLUMN cardio_capacity text;

CREATE OR REPLACE FUNCTION public.validate_assessment_ranges()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  IF NEW.squat_depth_score IS NOT NULL AND (NEW.squat_depth_score < 1 OR NEW.squat_depth_score > 5) THEN
    RAISE EXCEPTION 'squat_depth_score must be between 1 and 5';
  END IF;
  IF NEW.overhead_reach_score IS NOT NULL AND (NEW.overhead_reach_score < 1 OR NEW.overhead_reach_score > 5) THEN
    RAISE EXCEPTION 'overhead_reach_score must be between 1 and 5';
  END IF;
  IF NEW.hip_hinge_score IS NOT NULL AND (NEW.hip_hinge_score < 1 OR NEW.hip_hinge_score > 5) THEN
    RAISE EXCEPTION 'hip_hinge_score must be between 1 and 5';
  END IF;
  IF NEW.single_leg_balance_score IS NOT NULL AND (NEW.single_leg_balance_score < 1 OR NEW.single_leg_balance_score > 5) THEN
    RAISE EXCEPTION 'single_leg_balance_score must be between 1 and 5';
  END IF;
  IF NEW.resting_heart_rate IS NOT NULL AND (NEW.resting_heart_rate < 20 OR NEW.resting_heart_rate > 220) THEN
    RAISE EXCEPTION 'resting_heart_rate must be between 20 and 220';
  END IF;
  IF NEW.years_training IS NOT NULL AND (NEW.years_training < 0 OR NEW.years_training > 80) THEN
    RAISE EXCEPTION 'years_training must be between 0 and 80';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_assessment_ranges_trigger ON public.assessments;
CREATE TRIGGER validate_assessment_ranges_trigger
  BEFORE INSERT OR UPDATE ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_assessment_ranges();