-- Protect sensitive assessment columns from being overwritten via public intake token
CREATE OR REPLACE FUNCTION public.protect_assessment_intake_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Trainer (the row owner) bypasses lockdown
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.trainer_id THEN
    RETURN NEW;
  END IF;

  -- Anonymous/intake updates: revert protected columns to OLD values
  NEW.id                   := OLD.id;
  NEW.trainer_id           := OLD.trainer_id;
  NEW.client_id            := OLD.client_id;
  NEW.created_at           := OLD.created_at;
  NEW.acsm_risk_category   := OLD.acsm_risk_category;
  NEW.parq_passed          := OLD.parq_passed;
  NEW.med_flags            := OLD.med_flags;
  -- Trainer-graded movement screen scores stay locked
  NEW.squat_depth_score        := OLD.squat_depth_score;
  NEW.overhead_reach_score     := OLD.overhead_reach_score;
  NEW.hip_hinge_score          := OLD.hip_hinge_score;
  NEW.single_leg_balance_score := OLD.single_leg_balance_score;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_assessment_intake_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_assessment_intake_columns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_assessment_intake_columns() FROM authenticated;

DROP TRIGGER IF EXISTS assessments_protect_intake_columns ON public.assessments;
CREATE TRIGGER assessments_protect_intake_columns
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_assessment_intake_columns();