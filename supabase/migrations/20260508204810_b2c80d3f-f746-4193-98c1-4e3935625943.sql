-- ============================================================================
-- Round 3 Phase A — Measurement consolidation
-- 1. Insert 'autonomic_regulation' as 12th capacity domain
-- 2. Idempotent backfill: assessments anthro -> body_composition snapshots
-- 3. Idempotent backfill: client_measurements -> per-domain snapshots
-- ============================================================================

-- Step 1: 12th capacity domain (autonomic regulation)
INSERT INTO public.capacity_domains
  (slug, name_key, tier, display_order, evidence_summary_key, norm_reference_source, reference_assessments)
VALUES (
  'autonomic_regulation',
  'capacity.autonomic_regulation.name',
  'integrative',
  12,
  'capacity.autonomic_regulation.evidence',
  'ESC, Framingham',
  '[
    {"slug":"resting_heart_rate","name_key":"capacity.tests.resting_heart_rate","unit":"bpm"},
    {"slug":"blood_pressure_systolic","name_key":"capacity.tests.blood_pressure_systolic","unit":"mmHg"},
    {"slug":"blood_pressure_diastolic","name_key":"capacity.tests.blood_pressure_diastolic","unit":"mmHg"},
    {"slug":"hrv_rmssd","name_key":"capacity.tests.hrv_rmssd","unit":"ms"},
    {"slug":"breath_rate_resting","name_key":"capacity.tests.breath_rate_resting","unit":"breaths/min"},
    {"slug":"orthostatic_test","name_key":"capacity.tests.orthostatic_test","unit":"Δ bpm"}
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Step 2: idempotent backfill function (anthropometry from assessments)
CREATE OR REPLACE FUNCTION public.backfill_measurement_snapshots_phase_a()
RETURNS TABLE(source text, inserted_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ins_anthro integer := 0;
  _ins_meas integer := 0;
BEGIN
  -- Anthro from assessments: waist_cm
  WITH ins AS (
    INSERT INTO public.client_capacity_snapshots
      (client_id, domain_slug, test_used, raw_value, raw_unit,
       measured_at, provenance, notes, created_by)
    SELECT a.client_id, 'body_composition', 'waist_circumference',
           a.waist_cm, 'cm', a.created_at, 'intake_derived',
           'Backfilled from assessment intake', a.trainer_id
    FROM public.assessments a
    WHERE a.waist_cm IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.client_capacity_snapshots s
        WHERE s.client_id = a.client_id
          AND s.domain_slug = 'body_composition'
          AND s.test_used = 'waist_circumference'
          AND s.measured_at = a.created_at
      )
    RETURNING 1
  )
  SELECT count(*) INTO _ins_anthro FROM ins;

  WITH ins AS (
    INSERT INTO public.client_capacity_snapshots
      (client_id, domain_slug, test_used, raw_value, raw_unit,
       measured_at, provenance, notes, created_by)
    SELECT a.client_id, 'body_composition', 'hip_circumference',
           a.hip_cm, 'cm', a.created_at, 'intake_derived',
           'Backfilled from assessment intake', a.trainer_id
    FROM public.assessments a
    WHERE a.hip_cm IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.client_capacity_snapshots s
        WHERE s.client_id = a.client_id
          AND s.domain_slug = 'body_composition'
          AND s.test_used = 'hip_circumference'
          AND s.measured_at = a.created_at
      )
    RETURNING 1
  )
  SELECT _ins_anthro + count(*) INTO _ins_anthro FROM ins;

  WITH ins AS (
    INSERT INTO public.client_capacity_snapshots
      (client_id, domain_slug, test_used, raw_value, raw_unit,
       measured_at, provenance, notes, created_by)
    SELECT a.client_id, 'body_composition',
           COALESCE('body_fat_' || NULLIF(a.body_fat_method,''), 'body_fat_percent'),
           a.body_fat_pct, '%', a.created_at, 'intake_derived',
           'Backfilled from assessment intake', a.trainer_id
    FROM public.assessments a
    WHERE a.body_fat_pct IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.client_capacity_snapshots s
        WHERE s.client_id = a.client_id
          AND s.domain_slug = 'body_composition'
          AND s.test_used = COALESCE('body_fat_' || NULLIF(a.body_fat_method,''), 'body_fat_percent')
          AND s.measured_at = a.created_at
      )
    RETURNING 1
  )
  SELECT _ins_anthro + count(*) INTO _ins_anthro FROM ins;

  -- Step 3: backfill from client_measurements rows (jsonb values)
  WITH map(key, dom, test, unit) AS (VALUES
    ('vo2max',          'cardiorespiratory',     'vo2max_submax',           'ml/kg/min'),
    ('rhr',             'autonomic_regulation',  'resting_heart_rate',      'bpm'),
    ('bp_systolic',     'autonomic_regulation',  'blood_pressure_systolic', 'mmHg'),
    ('bp_diastolic',    'autonomic_regulation',  'blood_pressure_diastolic','mmHg'),
    ('dead_hang_s',     'muscular_endurance',    'dead_hang',               'seconds'),
    ('active_hang_s',   'muscular_endurance',    'active_hang',             'seconds'),
    ('plank_s',         'muscular_endurance',    'plank_hold',              'seconds'),
    ('box_squats_reps', 'muscular_endurance',    'box_squats_bodyweight',   'reps'),
    ('waist_cm',        'body_composition',      'waist_circumference',     'cm'),
    ('hip_cm',          'body_composition',      'hip_circumference',       'cm'),
    ('chest_cm',        'body_composition',      'chest_circumference',     'cm'),
    ('arm_cm',          'body_composition',      'arm_circumference',       'cm'),
    ('thigh_cm',        'body_composition',      'thigh_circumference',     'cm'),
    ('calf_cm',         'body_composition',      'calf_circumference',      'cm')
  ),
  candidates AS (
    SELECT
      m.client_id,
      m.trainer_id,
      mp.dom AS domain_slug,
      mp.test AS test_used,
      mp.unit AS raw_unit,
      ((m.values ->> mp.key))::numeric AS raw_value,
      (m.measured_on::timestamptz) AS measured_at,
      m.notes
    FROM public.client_measurements m
    CROSS JOIN map mp
    WHERE m.values ? mp.key
      AND m.values ->> mp.key IS NOT NULL
      AND m.values ->> mp.key <> ''
  ),
  ins AS (
    INSERT INTO public.client_capacity_snapshots
      (client_id, domain_slug, test_used, raw_value, raw_unit,
       measured_at, provenance, notes, created_by)
    SELECT c.client_id, c.domain_slug, c.test_used, c.raw_value, c.raw_unit,
           c.measured_at, 'pt_assessed', c.notes, c.trainer_id
    FROM candidates c
    WHERE c.raw_value IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.client_capacity_snapshots s
        WHERE s.client_id = c.client_id
          AND s.domain_slug = c.domain_slug
          AND s.test_used = c.test_used
          AND s.measured_at = c.measured_at
      )
    RETURNING 1
  )
  SELECT count(*) INTO _ins_meas FROM ins;

  RETURN QUERY VALUES ('assessments_anthro', _ins_anthro), ('client_measurements', _ins_meas);
END;
$$;

-- Run the backfill once on apply (idempotent, safe to re-run)
SELECT * FROM public.backfill_measurement_snapshots_phase_a();