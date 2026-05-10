
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS pre_readiness jsonb,
  ADD COLUMN IF NOT EXISTS post_feedback jsonb;

CREATE OR REPLACE FUNCTION public.validate_workout_session_readiness()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _v numeric;
BEGIN
  IF NEW.pre_readiness IS NOT NULL AND NEW.pre_readiness <> '{}'::jsonb THEN
    IF jsonb_typeof(NEW.pre_readiness) <> 'object' THEN
      RAISE EXCEPTION 'pre_readiness must be a JSON object';
    END IF;
    IF NEW.pre_readiness ? 'sleep' THEN
      _v := (NEW.pre_readiness->>'sleep')::numeric;
      IF _v < 1 OR _v > 5 THEN RAISE EXCEPTION 'pre_readiness.sleep must be 1..5'; END IF;
    END IF;
    IF NEW.pre_readiness ? 'energy' THEN
      _v := (NEW.pre_readiness->>'energy')::numeric;
      IF _v < 1 OR _v > 5 THEN RAISE EXCEPTION 'pre_readiness.energy must be 1..5'; END IF;
    END IF;
    IF NEW.pre_readiness ? 'soreness' THEN
      _v := (NEW.pre_readiness->>'soreness')::numeric;
      IF _v < 0 OR _v > 10 THEN RAISE EXCEPTION 'pre_readiness.soreness must be 0..10'; END IF;
    END IF;
  END IF;

  IF NEW.post_feedback IS NOT NULL AND NEW.post_feedback <> '{}'::jsonb THEN
    IF jsonb_typeof(NEW.post_feedback) <> 'object' THEN
      RAISE EXCEPTION 'post_feedback must be a JSON object';
    END IF;
    IF NEW.post_feedback ? 'session_rpe' THEN
      _v := (NEW.post_feedback->>'session_rpe')::numeric;
      IF _v < 1 OR _v > 10 THEN RAISE EXCEPTION 'post_feedback.session_rpe must be 1..10'; END IF;
    END IF;
    IF NEW.post_feedback ? 'mood'
       AND NEW.post_feedback->>'mood' NOT IN ('strong','ok','flat','crushed') THEN
      RAISE EXCEPTION 'post_feedback.mood must be strong|ok|flat|crushed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_workout_session_readiness ON public.workout_sessions;
CREATE TRIGGER trg_validate_workout_session_readiness
  BEFORE INSERT OR UPDATE ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_workout_session_readiness();
