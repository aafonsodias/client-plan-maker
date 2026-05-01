alter table public.assessments
  add column if not exists section_analyses_locale jsonb not null default '{}'::jsonb,
  add column if not exists systolic_bp_mmhg int,
  add column if not exists diastolic_bp_mmhg int,
  add column if not exists bp_measured_at timestamptz,
  add column if not exists squat_form_criteria  jsonb not null default '{}'::jsonb,
  add column if not exists hinge_form_criteria  jsonb not null default '{}'::jsonb,
  add column if not exists push_form_criteria   jsonb not null default '{}'::jsonb,
  add column if not exists pull_form_criteria   jsonb not null default '{}'::jsonb,
  add column if not exists carry_form_criteria  jsonb not null default '{}'::jsonb,
  add column if not exists lunge_form_criteria  jsonb not null default '{}'::jsonb,
  add column if not exists squat_capacity  jsonb not null default '{}'::jsonb,
  add column if not exists hinge_capacity  jsonb not null default '{}'::jsonb,
  add column if not exists push_capacity   jsonb not null default '{}'::jsonb,
  add column if not exists pull_capacity   jsonb not null default '{}'::jsonb,
  add column if not exists carry_capacity  jsonb not null default '{}'::jsonb,
  add column if not exists lunge_capacity  jsonb not null default '{}'::jsonb,
  add column if not exists screen_not_assessed jsonb not null default '{}'::jsonb,
  add column if not exists current_capacity_vs_pb int;

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
  IF NEW.systolic_bp_mmhg IS NOT NULL AND (NEW.systolic_bp_mmhg < 70 OR NEW.systolic_bp_mmhg > 220) THEN
    RAISE EXCEPTION 'systolic_bp_mmhg must be between 70 and 220';
  END IF;
  IF NEW.diastolic_bp_mmhg IS NOT NULL AND (NEW.diastolic_bp_mmhg < 40 OR NEW.diastolic_bp_mmhg > 130) THEN
    RAISE EXCEPTION 'diastolic_bp_mmhg must be between 40 and 130';
  END IF;
  IF NEW.current_capacity_vs_pb IS NOT NULL AND (NEW.current_capacity_vs_pb < 1 OR NEW.current_capacity_vs_pb > 10) THEN
    RAISE EXCEPTION 'current_capacity_vs_pb must be between 1 and 10';
  END IF;
  RETURN NEW;
END;
$function$;