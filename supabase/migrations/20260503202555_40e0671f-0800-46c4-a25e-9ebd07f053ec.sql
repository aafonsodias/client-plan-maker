-- ============================================================
-- Migration A (R2.1) — ACSM 12e screening schema spine
-- ============================================================

-- 1) workout_plans.prescription_parameters (typed FITT-VP block)
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS prescription_parameters jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.workout_plans.prescription_parameters IS
  'Typed FITT-VP prescription block { cardio, resistance, flexibility, citations[], safety_floors }. '
  'Sources: ACSM 12e (R2), Bompa 6e periodization (R2.5), special-population overlays (R3). '
  'Empty object {} indicates pre-R2 plan; UI hides the FITT-VP chip in that case.';

-- 2) assessments — screening output columns
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS signs_symptoms jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cvd_risk_factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submax_test jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS exerciser_status text,
  ADD COLUMN IF NOT EXISTS medical_clearance_required boolean,
  ADD COLUMN IF NOT EXISTS medical_clearance_reason text;

COMMENT ON COLUMN public.assessments.signs_symptoms IS
  'ACSM 12e Box 2.1 — 9 cardinal signs/symptoms suggestive of CV/metabolic/renal disease. '
  'Canonical keys (boolean when present): chest_discomfort, unreasonable_dyspnea, '
  'dizziness_syncope, orthopnea_pnd, ankle_edema, palpitations_tachycardia, '
  'intermittent_claudication, known_heart_murmur, unusual_fatigue.';

COMMENT ON COLUMN public.assessments.cvd_risk_factors IS
  'Derived ACSM CVD risk factor count + flags (computed by runPreparticipationAlgorithm in R2.2). '
  'Empty object {} = not yet classified.';

COMMENT ON COLUMN public.assessments.submax_test IS
  'Sub-max cardio test payload: { protocol: rockport|one_and_half_mile, hr_peak, vo2_estimated, '
  'time_seconds, stop_reason, performed_on }.';

COMMENT ON COLUMN public.assessments.exerciser_status IS
  'ACSM definition: current (≥30 min moderate ≥3 d/wk for ≥3 mo) vs not_current.';

-- 3) Extend protect_assessment_intake_columns to lock new trainer-graded fields
CREATE OR REPLACE FUNCTION public.protect_assessment_intake_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.trainer_id THEN
    RETURN NEW;
  END IF;

  NEW.id                   := OLD.id;
  NEW.trainer_id           := OLD.trainer_id;
  NEW.client_id            := OLD.client_id;
  NEW.created_at           := OLD.created_at;
  NEW.acsm_risk_category   := OLD.acsm_risk_category;
  NEW.parq_passed          := OLD.parq_passed;
  NEW.med_flags            := OLD.med_flags;
  NEW.squat_depth_score        := OLD.squat_depth_score;
  NEW.overhead_reach_score     := OLD.overhead_reach_score;
  NEW.hip_hinge_score          := OLD.hip_hinge_score;
  NEW.single_leg_balance_score := OLD.single_leg_balance_score;
  -- R2 trainer-graded screening outputs:
  NEW.cvd_risk_factors           := OLD.cvd_risk_factors;
  NEW.medical_clearance_required := OLD.medical_clearance_required;
  NEW.medical_clearance_reason   := OLD.medical_clearance_reason;
  RETURN NEW;
END;
$function$;

-- 4) Validation trigger for screening shape + ranges
CREATE OR REPLACE FUNCTION public.validate_assessment_screening_ranges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _hr      numeric;
  _vo2     numeric;
  _key     text;
BEGIN
  -- exerciser_status enum
  IF NEW.exerciser_status IS NOT NULL
     AND NEW.exerciser_status NOT IN ('current','not_current') THEN
    RAISE EXCEPTION 'exerciser_status must be current or not_current';
  END IF;

  -- submax_test ranges + protocol enum
  IF NEW.submax_test IS NOT NULL AND NEW.submax_test <> '{}'::jsonb THEN
    IF NEW.submax_test ? 'protocol'
       AND NEW.submax_test->>'protocol' NOT IN ('rockport','one_and_half_mile') THEN
      RAISE EXCEPTION 'submax_test.protocol must be rockport or one_and_half_mile';
    END IF;

    IF NEW.submax_test ? 'hr_peak' THEN
      BEGIN
        _hr := (NEW.submax_test->>'hr_peak')::numeric;
        IF _hr < 40 OR _hr > 230 THEN
          RAISE EXCEPTION 'submax_test.hr_peak must be between 40 and 230';
        END IF;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'submax_test.hr_peak must be numeric';
      END;
    END IF;

    IF NEW.submax_test ? 'vo2_estimated' THEN
      BEGIN
        _vo2 := (NEW.submax_test->>'vo2_estimated')::numeric;
        IF _vo2 < 0 OR _vo2 > 100 THEN
          RAISE EXCEPTION 'submax_test.vo2_estimated must be between 0 and 100';
        END IF;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'submax_test.vo2_estimated must be numeric';
      END;
    END IF;
  END IF;

  -- signs_symptoms shape: object + 9 cardinal keys must be boolean when present
  IF NEW.signs_symptoms IS NOT NULL AND NEW.signs_symptoms <> '{}'::jsonb THEN
    IF jsonb_typeof(NEW.signs_symptoms) <> 'object' THEN
      RAISE EXCEPTION 'signs_symptoms must be a JSON object';
    END IF;
    FOR _key IN SELECT unnest(ARRAY[
      'chest_discomfort','unreasonable_dyspnea','dizziness_syncope',
      'orthopnea_pnd','ankle_edema','palpitations_tachycardia',
      'intermittent_claudication','known_heart_murmur','unusual_fatigue'
    ]) LOOP
      IF NEW.signs_symptoms ? _key
         AND jsonb_typeof(NEW.signs_symptoms->_key) <> 'boolean' THEN
        RAISE EXCEPTION 'signs_symptoms.% must be boolean', _key;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_assessment_screening_ranges ON public.assessments;
CREATE TRIGGER trg_validate_assessment_screening_ranges
  BEFORE INSERT OR UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.validate_assessment_screening_ranges();

-- 5) acsm_thresholds reference table (seeded in a separate insert step)
CREATE TABLE IF NOT EXISTS public.acsm_thresholds (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parameter   text NOT NULL,
  applies_to  text NOT NULL,
  value_low   numeric,
  value_high  numeric,
  unit        text,
  severity    text NOT NULL DEFAULT 'default',
  citation    text NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parameter, applies_to)
);

COMMENT ON TABLE public.acsm_thresholds IS
  'Runtime source-of-truth for the 17 conservative ACSM 12e thresholds (gap report §E). '
  'severity ∈ safety_floor | default | validator.';

ALTER TABLE public.acsm_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read acsm thresholds" ON public.acsm_thresholds;
CREATE POLICY "authenticated read acsm thresholds"
  ON public.acsm_thresholds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.validate_acsm_threshold_severity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.severity NOT IN ('safety_floor','default','validator') THEN
    RAISE EXCEPTION 'acsm_thresholds.severity must be safety_floor, default or validator';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_acsm_threshold_severity ON public.acsm_thresholds;
CREATE TRIGGER trg_validate_acsm_threshold_severity
  BEFORE INSERT OR UPDATE ON public.acsm_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.validate_acsm_threshold_severity();

DROP TRIGGER IF EXISTS trg_acsm_thresholds_updated_at ON public.acsm_thresholds;
CREATE TRIGGER trg_acsm_thresholds_updated_at
  BEFORE UPDATE ON public.acsm_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();