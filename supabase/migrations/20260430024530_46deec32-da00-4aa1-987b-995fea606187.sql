-- Add ACSM-aligned key fields as columns + a JSONB blob for the rest
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS parq_passed boolean,
  ADD COLUMN IF NOT EXISTS acsm_risk_category text,
  ADD COLUMN IF NOT EXISTS waist_cm numeric,
  ADD COLUMN IF NOT EXISTS hip_cm numeric,
  ADD COLUMN IF NOT EXISTS body_fat_pct numeric,
  ADD COLUMN IF NOT EXISTS body_fat_method text,
  ADD COLUMN IF NOT EXISTS smart_specific text,
  ADD COLUMN IF NOT EXISTS smart_measurable text,
  ADD COLUMN IF NOT EXISTS smart_deadline date,
  ADD COLUMN IF NOT EXISTS readiness_stage text,
  ADD COLUMN IF NOT EXISTS medications text,
  ADD COLUMN IF NOT EXISTS med_flags text[],
  ADD COLUMN IF NOT EXISTS extended jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Onboarding checklist tracking on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_steps jsonb NOT NULL DEFAULT '{}'::jsonb;