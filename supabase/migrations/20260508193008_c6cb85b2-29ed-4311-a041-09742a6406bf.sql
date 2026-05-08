
-- Seed reference_assessments per capacity domain
UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"cooper_12min","name_key":"capacity.tests.cooper_12min","unit":"ml/kg/min"},
  {"slug":"rockport_walk","name_key":"capacity.tests.rockport_walk","unit":"ml/kg/min"},
  {"slug":"step_test_3min","name_key":"capacity.tests.step_test_3min","unit":"bpm"},
  {"slug":"vo2max_device","name_key":"capacity.tests.vo2max_device","unit":"ml/kg/min"}
]'::jsonb WHERE slug = 'cardiorespiratory';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"1rm_squat","name_key":"capacity.tests.1rm_squat","unit":"kg"},
  {"slug":"1rm_bench","name_key":"capacity.tests.1rm_bench","unit":"kg"},
  {"slug":"1rm_deadlift","name_key":"capacity.tests.1rm_deadlift","unit":"kg"},
  {"slug":"5rm_estimated_squat","name_key":"capacity.tests.5rm_estimated_squat","unit":"kg"},
  {"slug":"5rm_estimated_bench","name_key":"capacity.tests.5rm_estimated_bench","unit":"kg"},
  {"slug":"handgrip","name_key":"capacity.tests.handgrip","unit":"kg"}
]'::jsonb WHERE slug = 'muscular_strength';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"pushups_max","name_key":"capacity.tests.pushups_max","unit":"reps"},
  {"slug":"plank_hold","name_key":"capacity.tests.plank_hold","unit":"s"},
  {"slug":"wall_sit","name_key":"capacity.tests.wall_sit","unit":"s"},
  {"slug":"bodyweight_squats_60s","name_key":"capacity.tests.bodyweight_squats_60s","unit":"reps"}
]'::jsonb WHERE slug = 'muscular_endurance';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"sit_and_reach","name_key":"capacity.tests.sit_and_reach","unit":"cm"},
  {"slug":"shoulder_flexion_rom","name_key":"capacity.tests.shoulder_flexion_rom","unit":"deg"},
  {"slug":"hip_flexion_rom","name_key":"capacity.tests.hip_flexion_rom","unit":"deg"},
  {"slug":"ankle_dorsiflexion_rom","name_key":"capacity.tests.ankle_dorsiflexion_rom","unit":"deg"}
]'::jsonb WHERE slug = 'flexibility';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"body_fat_percent","name_key":"capacity.tests.body_fat_percent","unit":"%"},
  {"slug":"waist_circumference","name_key":"capacity.tests.waist_circumference","unit":"cm"},
  {"slug":"waist_to_hip","name_key":"capacity.tests.waist_to_hip","unit":"ratio"},
  {"slug":"bmi","name_key":"capacity.tests.bmi","unit":"kg/m²"}
]'::jsonb WHERE slug = 'body_composition';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"vertical_jump","name_key":"capacity.tests.vertical_jump","unit":"cm"},
  {"slug":"broad_jump","name_key":"capacity.tests.broad_jump","unit":"cm"},
  {"slug":"medicine_ball_throw","name_key":"capacity.tests.medicine_ball_throw","unit":"m"},
  {"slug":"5_bound","name_key":"capacity.tests.5_bound","unit":"m"}
]'::jsonb WHERE slug = 'power';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"single_leg_stance_eyes_open","name_key":"capacity.tests.single_leg_stance_eyes_open","unit":"s"},
  {"slug":"single_leg_stance_eyes_closed","name_key":"capacity.tests.single_leg_stance_eyes_closed","unit":"s"},
  {"slug":"y_balance","name_key":"capacity.tests.y_balance","unit":"cm"},
  {"slug":"berg_balance_scale","name_key":"capacity.tests.berg_balance_scale","unit":"score"}
]'::jsonb WHERE slug = 'balance';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"hand_eye_wall_toss","name_key":"capacity.tests.hand_eye_wall_toss","unit":"catches/30s"},
  {"slug":"agility_ladder_run","name_key":"capacity.tests.agility_ladder_run","unit":"s"},
  {"slug":"single_leg_hop_test","name_key":"capacity.tests.single_leg_hop_test","unit":"cm"}
]'::jsonb WHERE slug = 'coordination';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"505_agility","name_key":"capacity.tests.505_agility","unit":"s"},
  {"slug":"t_test","name_key":"capacity.tests.t_test","unit":"s"},
  {"slug":"pro_agility_5_10_5","name_key":"capacity.tests.pro_agility_5_10_5","unit":"s"},
  {"slug":"illinois_agility","name_key":"capacity.tests.illinois_agility","unit":"s"}
]'::jsonb WHERE slug = 'agility';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"tug_dual_task","name_key":"capacity.tests.tug_dual_task","unit":"s"},
  {"slug":"walking_while_talking","name_key":"capacity.tests.walking_while_talking","unit":"% gait change"},
  {"slug":"stroop_walk","name_key":"capacity.tests.stroop_walk","unit":"errors"}
]'::jsonb WHERE slug = 'cognitive_motor';

UPDATE public.capacity_domains SET reference_assessments = '[
  {"slug":"fms_total","name_key":"capacity.tests.fms_total","unit":"score 0-21"},
  {"slug":"overhead_squat_assessment","name_key":"capacity.tests.overhead_squat_assessment","unit":"score 0-3"},
  {"slug":"single_leg_squat_assessment","name_key":"capacity.tests.single_leg_squat_assessment","unit":"score 0-3"},
  {"slug":"sfma_total","name_key":"capacity.tests.sfma_total","unit":"score 0-100"}
]'::jsonb WHERE slug = 'movement_quality';
