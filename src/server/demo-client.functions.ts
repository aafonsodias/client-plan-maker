import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FORM_CRITERIA, CAPACITY_FIELDS, PATTERN_IDS, derivePatternScore, type PatternId } from "@/lib/movement-criteria";
import { pickDemoAvatar } from "@/lib/demo-avatars";

/**
 * Creates a fully-populated demo client + assessment so trainers can preview
 * the planning flow without manually keying 60+ fields. Ten archetypes, each
 * with internally-consistent anthropometry, lifestyle, movement screen
 * (form-criteria + capacity), PAR-Q+, risk factors, mobility scores, etc.
 *
 * Each archetype declares `expected_red_flags`: the rubric the AI judge uses
 * later to grade whether the generated plan respected the persona's
 * constraints. Stored in `assessments.extended.demo_meta`.
 *
 * No LLM here on purpose: deterministic templates with per-field jitter are
 * cheaper, faster, and produce *falsifiable* expectations (e.g. archetype X
 * MUST trigger `no_axial_loading`). The planner downstream still uses real AI.
 */

type Persona = {
  name_pool: string[];
  sex: "male" | "female";
  age: [number, number];
  height_cm: [number, number];
  weight_kg: [number, number];
  experience_level: "beginner" | "intermediate" | "advanced";
  primary_goal: string;
  secondary_goals: string[];
  training_days_per_week: number;
  session_duration_minutes: number;
  available_equipment: string[];
  training_location: string;
  injuries: string;
  medical_conditions: string;
  preferences: string;
  notes: string;
  // Lifestyle 1-10 (sleep) / stress / steps
  sleep: [number, number];
  stress: [number, number];
  hours_seated: [number, number];
  daily_steps: [number, number];
  hydration: [number, number];
  // Per-pattern form-criteria pass rate (0..1) — drives form_criteria booleans.
  form_quality: Partial<Record<PatternId, number>>;
  // Per-pattern capacity overrides (numeric or null). Patterns absent → marked not_assessed.
  capacity: Partial<Record<PatternId, Record<string, number | null>>>;
  // PAR-Q+ answers (q1..q7 → true/false). True = "yes" = flag.
  parq: Partial<Record<"q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7", boolean>>;
  // Risk-strat factors (extended.risk).
  risk_factors: {
    family_cvd?: boolean;
    smoking?: "never" | "former" | "current";
    sedentary?: boolean;
    bmi_category?: "normal" | "overweight" | "obese";
    dyslipidemia?: boolean;
    prediabetes?: boolean;
    hypertension?: boolean;
  };
  // Mobility 1-5 per joint (extended.mob_*).
  mobility: { shoulder: number; hip: number; ankle: number; thoracic: number; wrist: number; knee: number };
  // The narrative posture/imbalance notes.
  standing_posture_notes: string;
  known_imbalances: string;
  body_fat_pct?: [number, number];
  body_fat_method?: "skinfold" | "bioimpedance" | "dexa" | "navy_tape";
  // Goal
  smart_specific: string;
  smart_measurable: string;
  readiness_stage: "preparation" | "action" | "maintenance";
  // Risk
  resting_hr: [number, number];
  systolic: [number, number];
  diastolic: [number, number];
  years_training: [number, number];
  // Medications free-text + structured flags.
  medications: string;
  med_flags: string[];
  // EXPECTED red-flag tags the planner SHOULD respect. Drives the AI judge.
  // Examples: "no_axial_loading", "bp_monitor", "unilateral_emphasis",
  //   "low_volume_start", "avoid_overhead", "knee_friendly", "post_partum_core".
  expected_red_flags: string[];
  archetype_label: string;
};

const PERSONAS: Persona[] = [
  // ============== 1. Beginner female — disc history ==============
  {
    archetype_label: "beginner_female_disc_history",
    name_pool: ["Sofia Martins", "Beatriz Almeida", "Inês Correia", "Mariana Lopes", "Catarina Ferreira"],
    sex: "female",
    age: [28, 38],
    height_cm: [162, 172],
    weight_kg: [58, 70],
    experience_level: "beginner",
    primary_goal: "Aumentar força funcional e melhorar postura, sem sobrecarregar a coluna lombar",
    secondary_goals: ["Reduzir dor lombar pontual", "Construir hábito 3×/semana"],
    training_days_per_week: 3,
    session_duration_minutes: 50,
    available_equipment: ["Dumbbells", "Kettlebells", "Bands", "Cable machine", "Bench"],
    training_location: "Ginásio comercial",
    injuries: "Lombar sensível ao agachar com barra; hérnia L5-S1 sem indicação cirúrgica (assintomática há 2 anos).",
    medical_conditions: "",
    preferences: "Prefere treinar de manhã antes do trabalho. Não gosta de cardio em passadeira.",
    notes: "Profissional de escritório, motivada mas com pouco tempo. Boa técnica em padrões básicos após instrução.",
    sleep: [6, 8],
    stress: [4, 6],
    hours_seated: [7, 9],
    daily_steps: [5000, 8000],
    hydration: [6, 9],
    form_quality: { squat: 0.6, hinge: 0.6, push: 0.7, pull: 0.5, carry: 0.7, lunge: 0.6 },
    capacity: {
      squat: { reps_to_failure: 18, one_rm_kg: null },
      hinge: { kb_swings_60s: 25, rdl_one_rm_kg: 30 },
      push: { strict_pushups: 4, shoulder_press_one_rm_kg: 12 },
      pull: { dead_hang_seconds: 15, pullups: 0 },
      carry: { load_kg: 12, distance_m: 20 },
    },
    parq: { q1: false, q2: false, q3: false, q4: false, q5: true, q6: false, q7: false },
    risk_factors: { sedentary: true, bmi_category: "normal" },
    mobility: { shoulder: 4, hip: 3, ankle: 4, thoracic: 3, wrist: 5, knee: 4 },
    standing_posture_notes: "Hipercifose torácica leve. Ombros protraídos.",
    known_imbalances: "Glúteo médio fraco bilateralmente; quad dominante.",
    body_fat_pct: [22, 28],
    body_fat_method: "bioimpedance",
    smart_specific: "Realizar 5 hip thrusts a 60kg com técnica controlada",
    smart_measurable: "5 reps × 60kg @ RPE 8",
    readiness_stage: "action",
    resting_hr: [62, 72],
    systolic: [110, 122],
    diastolic: [70, 78],
    years_training: [0, 2],
    medications: "Anticoncecional oral.",
    med_flags: [],
    expected_red_flags: ["no_axial_loading", "low_back_friendly", "glute_med_bias", "low_volume_start"],
  },
  // ============== 2. Intermediate male — recomp ==============
  {
    archetype_label: "intermediate_male_recomp",
    name_pool: ["André Pereira", "João Ribeiro", "Tiago Sousa", "Miguel Costa", "Rui Carvalho"],
    sex: "male",
    age: [32, 45],
    height_cm: [172, 185],
    weight_kg: [78, 92],
    experience_level: "intermediate",
    primary_goal: "Recomposição corporal — perder 5kg de gordura mantendo força",
    secondary_goals: ["Voltar a fazer pull-ups", "Melhorar mobilidade de tornozelo"],
    training_days_per_week: 4,
    session_duration_minutes: 60,
    available_equipment: ["Barbell", "Dumbbells", "Kettlebells", "Cable machine", "Bench", "Pull-up bar"],
    training_location: "Ginásio comercial",
    injuries: "Lesão antiga no manguito rotador direito (2019), totalmente recuperada. Tornozelo direito com mobilidade limitada após entorse.",
    medical_conditions: "",
    preferences: "Gosta de treinos com carga progressiva, evita aulas de grupo. Disponível terça/quinta/sábado/domingo.",
    notes: "Treinou regularmente entre 2018-2022, parou 18 meses. Baseline neuromuscular ainda presente.",
    sleep: [5, 7],
    stress: [5, 7],
    hours_seated: [8, 10],
    daily_steps: [4000, 7000],
    hydration: [5, 8],
    form_quality: { squat: 0.9, hinge: 0.7, push: 0.8, pull: 0.8, carry: 0.9, lunge: 0.7 },
    capacity: {
      squat: { reps_to_failure: 35, one_rm_kg: 110 },
      hinge: { kb_swings_60s: 45, rdl_one_rm_kg: 90 },
      push: { strict_pushups: 28, shoulder_press_one_rm_kg: 45 },
      pull: { dead_hang_seconds: 45, pullups: 3 },
      carry: { load_kg: 32, distance_m: 30 },
      lunge: { walking_lunge_reps_per_side: 12, bulgarian_one_rm_kg: 25 },
    },
    parq: { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false },
    risk_factors: { bmi_category: "overweight", sedentary: true },
    mobility: { shoulder: 4, hip: 4, ankle: 2, thoracic: 4, wrist: 5, knee: 4 },
    standing_posture_notes: "Postura globalmente OK. Ligeira anteversão pélvica.",
    known_imbalances: "Tornozelo direito hipomóvel — limita profundidade de squat.",
    body_fat_pct: [20, 26],
    body_fat_method: "bioimpedance",
    smart_specific: "Fazer 5 pull-ups estritas seguidas",
    smart_measurable: "5 reps com peso corporal sem kipping",
    readiness_stage: "action",
    resting_hr: [58, 68],
    systolic: [118, 128],
    diastolic: [74, 82],
    years_training: [3, 6],
    medications: "",
    med_flags: [],
    expected_red_flags: ["ankle_mobility_priority", "shoulder_warmup_priority", "moderate_volume", "deficit_friendly"],
  },
  // ============== 3. Senior female — bone density / pre-HTN ==============
  {
    archetype_label: "senior_female_bone_density",
    name_pool: ["Patrícia Nunes", "Filipa Mendes", "Carolina Pinto", "Helena Brito", "Joana Silva"],
    sex: "female",
    age: [42, 55],
    height_cm: [158, 168],
    weight_kg: [62, 76],
    experience_level: "beginner",
    primary_goal: "Manter densidade óssea e prevenir sarcopenia na perimenopausa",
    secondary_goals: ["Subir escadas sem fadiga", "Carregar netos / sacos sem dor"],
    training_days_per_week: 2,
    session_duration_minutes: 45,
    available_equipment: ["Dumbbells", "Kettlebells", "Bands", "Bench"],
    training_location: "Estúdio pequeno (sem barra olímpica)",
    injuries: "Joelho esquerdo com condromalácia patelar leve. Evitar agachamento profundo com carga.",
    medical_conditions: "Pré-hipertensão controlada com dieta. Sem medicação cardiovascular.",
    preferences: "Treinos curtos e seguros. Quer evitar exercícios em decúbito ventral.",
    notes: "Nova no treino estruturado. Precisa de ênfase em técnica e RPE conservador (≤7) nas primeiras 8 semanas.",
    sleep: [6, 8],
    stress: [3, 5],
    hours_seated: [5, 7],
    daily_steps: [6000, 9000],
    hydration: [7, 10],
    form_quality: { squat: 0.4, hinge: 0.4, push: 0.6, pull: 0.4, carry: 0.6, lunge: 0.3 },
    capacity: {
      squat: { reps_to_failure: 10, one_rm_kg: null },
      hinge: { kb_swings_60s: 15, rdl_one_rm_kg: 20 },
      push: { strict_pushups: 2, shoulder_press_one_rm_kg: 8 },
      pull: { dead_hang_seconds: 8, pullups: 0 },
      carry: { load_kg: 8, distance_m: 15 },
    },
    parq: { q1: false, q2: false, q3: false, q4: true, q5: true, q6: false, q7: true },
    risk_factors: { hypertension: true, bmi_category: "overweight", sedentary: false },
    mobility: { shoulder: 3, hip: 3, ankle: 3, thoracic: 3, wrist: 4, knee: 2 },
    standing_posture_notes: "Cifose torácica acentuada típica de perimenopausa.",
    known_imbalances: "Joelho esquerdo: défice de força do quadricípete vs direito.",
    body_fat_pct: [28, 36],
    body_fat_method: "skinfold",
    smart_specific: "Fazer 8 goblet squats a 12kg com paragem na profundidade",
    smart_measurable: "3×8 @ 12kg, RPE 7",
    readiness_stage: "preparation",
    resting_hr: [68, 78],
    systolic: [125, 138],
    diastolic: [78, 86],
    years_training: [0, 1],
    medications: "Suplementação de vitamina D e cálcio.",
    med_flags: [],
    expected_red_flags: ["bp_monitor", "knee_friendly", "low_volume_start", "bone_loading_priority", "rpe_cap_7"],
  },
  // ============== 4. Post-partum (6 months) ==============
  {
    archetype_label: "post_partum_6mo",
    name_pool: ["Rita Fonseca", "Ana Margarida Reis", "Diana Tavares", "Liliana Matos"],
    sex: "female",
    age: [29, 36],
    height_cm: [160, 172],
    weight_kg: [60, 75],
    experience_level: "beginner",
    primary_goal: "Recuperar força do core e pavimento pélvico pós-parto",
    secondary_goals: ["Aliviar dor lombar de carregar bebé", "Reganhar 5kg de massa magra"],
    training_days_per_week: 3,
    session_duration_minutes: 40,
    available_equipment: ["Dumbbells", "Bands", "Kettlebells", "Bench"],
    training_location: "Casa (espaço limitado)",
    injuries: "Diástase abdominal de 2cm (resolvida parcialmente). Rastreio de pavimento pélvico OK.",
    medical_conditions: "Pós-parto há 6 meses, parto vaginal. Amamentação ativa.",
    preferences: "Treinos curtos (30-40min). Evitar abdominais clássicos e impacto.",
    notes: "Sono fragmentado, baseline de fadiga elevada. Precisa de pacing conservador.",
    sleep: [4, 6],
    stress: [5, 7],
    hours_seated: [4, 7],
    daily_steps: [3000, 6000],
    hydration: [6, 9],
    form_quality: { squat: 0.5, hinge: 0.5, push: 0.5, pull: 0.4, carry: 0.7, lunge: 0.4 },
    capacity: {
      squat: { reps_to_failure: 12, one_rm_kg: null },
      hinge: { kb_swings_60s: 20, rdl_one_rm_kg: 16 },
      push: { strict_pushups: 3, shoulder_press_one_rm_kg: 6 },
      pull: { dead_hang_seconds: 10, pullups: 0 },
      carry: { load_kg: 10, distance_m: 20 },
    },
    parq: { q1: false, q2: false, q3: false, q4: false, q5: true, q6: false, q7: false },
    risk_factors: { sedentary: false, bmi_category: "normal" },
    mobility: { shoulder: 4, hip: 3, ankle: 4, thoracic: 3, wrist: 4, knee: 4 },
    standing_posture_notes: "Anteversão pélvica marcada. Ombros protraídos por amamentação.",
    known_imbalances: "Core anterior em défice; cadeia posterior preservada.",
    body_fat_pct: [26, 34],
    body_fat_method: "navy_tape",
    smart_specific: "Fechar diástase abaixo de 1cm e fazer 10 dead bugs estritos",
    smart_measurable: "Diástase < 1cm + 3×10 dead bugs com bracing",
    readiness_stage: "preparation",
    resting_hr: [70, 82],
    systolic: [108, 118],
    diastolic: [68, 76],
    years_training: [0, 1.5],
    medications: "Suplementação de ferro pós-parto.",
    med_flags: [],
    expected_red_flags: ["post_partum_core", "no_intra_abdominal_pressure_spikes", "no_axial_loading", "fatigue_managed", "short_sessions"],
  },
  // ============== 5. Runner with knee pain ==============
  {
    archetype_label: "runner_knee_pain",
    name_pool: ["Pedro Vieira", "Hugo Santos", "Bruno Faria", "Gonçalo Lima"],
    sex: "male",
    age: [30, 42],
    height_cm: [170, 184],
    weight_kg: [66, 80],
    experience_level: "intermediate",
    primary_goal: "Construir força para reduzir dor patelo-femoral durante corridas longas",
    secondary_goals: ["Voltar a correr 21k sem dor", "Fortalecer cadeia posterior"],
    training_days_per_week: 3,
    session_duration_minutes: 50,
    available_equipment: ["Barbell", "Dumbbells", "Cable machine", "Bench", "Bands"],
    training_location: "Ginásio do clube de atletismo",
    injuries: "Síndrome patelo-femoral bilateral, mais à direita. Pior em descidas.",
    medical_conditions: "",
    preferences: "Mantém 3 corridas/semana — treino de força não pode interferir com terça (intervalos) e domingo (long run).",
    notes: "Baseline cardiovascular excelente. Força/hipertrofia historicamente negligenciadas.",
    sleep: [6, 8],
    stress: [3, 5],
    hours_seated: [6, 8],
    daily_steps: [12000, 18000],
    hydration: [8, 12],
    form_quality: { squat: 0.7, hinge: 0.6, push: 0.7, pull: 0.7, carry: 0.8, lunge: 0.5 },
    capacity: {
      squat: { reps_to_failure: 25, one_rm_kg: 70 },
      hinge: { kb_swings_60s: 50, rdl_one_rm_kg: 60 },
      push: { strict_pushups: 22, shoulder_press_one_rm_kg: 28 },
      pull: { dead_hang_seconds: 60, pullups: 8 },
      carry: { load_kg: 24, distance_m: 40 },
    },
    parq: { q1: false, q2: false, q3: false, q4: false, q5: true, q6: false, q7: false },
    risk_factors: { bmi_category: "normal" },
    mobility: { shoulder: 4, hip: 3, ankle: 4, thoracic: 4, wrist: 5, knee: 3 },
    standing_posture_notes: "Postura atlética; ligeira hipotonia de glúteo médio bilateral.",
    known_imbalances: "VMO em défice bilateralmente. Glúteo médio fraco — Trendelenburg leve à direita.",
    body_fat_pct: [10, 16],
    body_fat_method: "skinfold",
    smart_specific: "Correr meia-maratona em <1h50 sem dor patelo-femoral",
    smart_measurable: "21.1km < 1h50, 0 dor durante e 24h após",
    readiness_stage: "action",
    resting_hr: [48, 56],
    systolic: [108, 118],
    diastolic: [66, 74],
    years_training: [1, 3],
    medications: "",
    med_flags: [],
    expected_red_flags: ["knee_friendly", "vmo_emphasis", "glute_med_bias", "no_high_impact_jumps", "running_compatible_volume"],
  },
  // ============== 6. Hypertensive untrained ==============
  {
    archetype_label: "hypertensive_untrained",
    name_pool: ["Manuel Cardoso", "Fernando Antunes", "Carlos Batista", "Luís Henriques"],
    sex: "male",
    age: [50, 62],
    height_cm: [168, 182],
    weight_kg: [88, 105],
    experience_level: "beginner",
    primary_goal: "Reduzir tensão arterial e perder 8kg sob supervisão clínica",
    secondary_goals: ["Subir escadas sem dispneia", "Melhorar força funcional"],
    training_days_per_week: 2,
    session_duration_minutes: 45,
    available_equipment: ["Dumbbells", "Kettlebells", "Cable machine", "Bench", "Bands"],
    training_location: "Ginásio comercial",
    injuries: "",
    medical_conditions: "Hipertensão grau 1 medicada (lisinopril 10mg). Colesterol elevado.",
    preferences: "Prefere manhã. Médico autorizou treino moderado com monitorização da TA.",
    notes: "Sedentário há 15 anos. Ex-fumador (parou há 3 anos).",
    sleep: [6, 8],
    stress: [4, 6],
    hours_seated: [9, 11],
    daily_steps: [3000, 5000],
    hydration: [4, 7],
    form_quality: { squat: 0.4, hinge: 0.3, push: 0.4, pull: 0.3, carry: 0.5, lunge: 0.3 },
    capacity: {
      squat: { reps_to_failure: 6, one_rm_kg: null },
      hinge: { kb_swings_60s: 10, rdl_one_rm_kg: 20 },
      push: { strict_pushups: 1, shoulder_press_one_rm_kg: 8 },
      pull: { dead_hang_seconds: 5, pullups: 0 },
      carry: { load_kg: 12, distance_m: 15 },
    },
    parq: { q1: true, q2: false, q3: false, q4: false, q5: false, q6: true, q7: false },
    risk_factors: { hypertension: true, dyslipidemia: true, smoking: "former", sedentary: true, bmi_category: "obese" },
    mobility: { shoulder: 2, hip: 2, ankle: 3, thoracic: 2, wrist: 4, knee: 3 },
    standing_posture_notes: "Cifose torácica marcada. Ventre proeminente — desafia bracing.",
    known_imbalances: "Mobilidade torácica muito limitada — overhead seguro requer regressão.",
    body_fat_pct: [28, 38],
    body_fat_method: "navy_tape",
    smart_specific: "Reduzir TA sistólica para <130 e fazer 10 sit-to-stand sem apoio",
    smart_measurable: "TA <130/80 e 10 sit-to-stand em 30s",
    readiness_stage: "preparation",
    resting_hr: [76, 88],
    systolic: [138, 152],
    diastolic: [86, 94],
    years_training: [0, 0.5],
    medications: "Lisinopril 10mg/dia. Estatina 20mg/dia.",
    med_flags: ["bp_meds", "statin"],
    expected_red_flags: ["bp_monitor", "no_valsalva", "rpe_cap_6", "low_volume_start", "avoid_overhead", "cardio_priority", "supervised_only"],
  },
  // ============== 7. Returner post-ACL ==============
  {
    archetype_label: "returner_post_acl",
    name_pool: ["Margarida Rocha", "Cláudia Borges", "Sara Coelho", "Inês Magalhães"],
    sex: "female",
    age: [24, 32],
    height_cm: [164, 174],
    weight_kg: [58, 70],
    experience_level: "intermediate",
    primary_goal: "Voltar ao futsal competitivo 12 meses após reconstrução do LCA direito",
    secondary_goals: ["Igualar força do quadricípete dos dois lados (LSI ≥ 95%)", "Saltar com confiança"],
    training_days_per_week: 4,
    session_duration_minutes: 60,
    available_equipment: ["Barbell", "Dumbbells", "Cable machine", "Bench", "Bands", "Pull-up bar"],
    training_location: "Ginásio + clínica de fisio",
    injuries: "Reconstrução do LCA direito há 11 meses (enxerto de tendão patelar). Alta da fisio há 2 meses.",
    medical_conditions: "",
    preferences: "Quer voltar a competir. Ainda hesitante em saltos unilaterais à direita.",
    notes: "LSI atual: quadricípete 87%, hamstrings 92%. Ainda abaixo do critério de retorno (95%).",
    sleep: [7, 9],
    stress: [3, 5],
    hours_seated: [4, 6],
    daily_steps: [8000, 12000],
    hydration: [8, 11],
    form_quality: { squat: 0.7, hinge: 0.7, push: 0.8, pull: 0.8, carry: 0.8, lunge: 0.6 },
    capacity: {
      squat: { reps_to_failure: 28, one_rm_kg: 75 },
      hinge: { kb_swings_60s: 40, rdl_one_rm_kg: 70 },
      push: { strict_pushups: 18, shoulder_press_one_rm_kg: 22 },
      pull: { dead_hang_seconds: 30, pullups: 4 },
      carry: { load_kg: 22, distance_m: 30 },
      lunge: { walking_lunge_reps_per_side: 10, bulgarian_one_rm_kg: 18 },
    },
    parq: { q1: false, q2: false, q3: false, q4: false, q5: true, q6: false, q7: false },
    risk_factors: { bmi_category: "normal" },
    mobility: { shoulder: 5, hip: 4, ankle: 4, thoracic: 5, wrist: 5, knee: 3 },
    standing_posture_notes: "Atlética. Pequena hipotrofia visível do quadricípete direito.",
    known_imbalances: "Défice de força e potência do quadricípete direito (LSI 87%).",
    body_fat_pct: [18, 24],
    body_fat_method: "skinfold",
    smart_specific: "Atingir LSI ≥ 95% no single-leg press e single-leg hop",
    smart_measurable: "LSI ≥ 95% nos dois testes em 12 semanas",
    readiness_stage: "action",
    resting_hr: [54, 62],
    systolic: [110, 120],
    diastolic: [68, 76],
    years_training: [4, 7],
    medications: "",
    med_flags: [],
    expected_red_flags: ["unilateral_emphasis", "knee_friendly", "no_max_loading_unilateral_yet", "lsi_focused", "plyometric_progression"],
  },
  // ============== 8. Advanced powerlifter cutting ==============
  {
    archetype_label: "advanced_powerlifter_cut",
    name_pool: ["Diogo Sá", "Ricardo Pinto", "Tiago Meireles", "Nuno Vasques"],
    sex: "male",
    age: [26, 36],
    height_cm: [172, 184],
    weight_kg: [85, 102],
    experience_level: "advanced",
    primary_goal: "Cortar 4kg para baixar de categoria mantendo 95% do total de competição",
    secondary_goals: ["Manter SBD acima de 600kg total", "Melhorar técnica de bench (pause)"],
    training_days_per_week: 5,
    session_duration_minutes: 90,
    available_equipment: ["Barbell", "Dumbbells", "Cable machine", "Bench", "Pull-up bar"],
    training_location: "Ginásio de powerlifting",
    injuries: "Histórico de lombalgia em deadlift convencional. Migrou para sumo há 2 anos sem problemas.",
    medical_conditions: "",
    preferences: "Bloqueia conjugado. Não treina em hipertrofia pura — quer manter especificidade.",
    notes: "Atleta competitivo IPF. Próxima competição em 14 semanas.",
    sleep: [7, 9],
    stress: [4, 6],
    hours_seated: [4, 7],
    daily_steps: [6000, 10000],
    hydration: [10, 14],
    form_quality: { squat: 1.0, hinge: 1.0, push: 0.9, pull: 0.9, carry: 0.9, lunge: 0.7 },
    capacity: {
      squat: { reps_to_failure: 50, one_rm_kg: 220 },
      hinge: { kb_swings_60s: 55, rdl_one_rm_kg: 200 },
      push: { strict_pushups: 45, shoulder_press_one_rm_kg: 75 },
      pull: { dead_hang_seconds: 90, pullups: 18 },
      carry: { load_kg: 60, distance_m: 40 },
      lunge: { walking_lunge_reps_per_side: 20, bulgarian_one_rm_kg: 60 },
    },
    parq: { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false },
    risk_factors: { bmi_category: "overweight" },
    mobility: { shoulder: 4, hip: 4, ankle: 3, thoracic: 4, wrist: 5, knee: 4 },
    standing_posture_notes: "Hipertrofia clara. Postura competitiva.",
    known_imbalances: "Bench: ligeira deriva direita do bar path. Sem assimetria de força.",
    body_fat_pct: [14, 20],
    body_fat_method: "skinfold",
    smart_specific: "Atingir total de 605kg @ 93kg (S 220 / B 145 / D 240)",
    smart_measurable: "605kg total em competição IPF nas próximas 14 semanas",
    readiness_stage: "maintenance",
    resting_hr: [56, 64],
    systolic: [122, 132],
    diastolic: [76, 84],
    years_training: [8, 14],
    medications: "",
    med_flags: [],
    expected_red_flags: ["competition_specificity", "high_rpe_acceptable", "cutting_phase_volume", "sumo_deadlift_only", "peaking_block"],
  },
  // ============== 9. Hypermobile yoga teacher ==============
  {
    archetype_label: "hypermobile_yoga_teacher",
    name_pool: ["Inês Bento", "Marta Quintela", "Vânia Esteves", "Luísa Pais"],
    sex: "female",
    age: [28, 40],
    height_cm: [160, 172],
    weight_kg: [52, 64],
    experience_level: "beginner",
    primary_goal: "Construir estabilidade articular e força — reduzir lesões por hipermobilidade",
    secondary_goals: ["Aumentar massa muscular 3kg", "Reduzir dor lombar pós-classes"],
    training_days_per_week: 3,
    session_duration_minutes: 50,
    available_equipment: ["Dumbbells", "Kettlebells", "Cable machine", "Bench", "Bands"],
    training_location: "Estúdio próprio",
    injuries: "Subluxações recorrentes do ombro direito. Hipermobilidade generalizada (Beighton 7/9).",
    medical_conditions: "",
    preferences: "Resistência inicial a 'treinar pesado' por crença em ROM. Educar sobre amplitude controlada.",
    notes: "Excelente consciência corporal mas push em fim-de-amplitude — precisa de trabalho isométrico.",
    sleep: [7, 9],
    stress: [3, 5],
    hours_seated: [3, 5],
    daily_steps: [9000, 14000],
    hydration: [9, 12],
    form_quality: { squat: 0.7, hinge: 0.6, push: 0.5, pull: 0.5, carry: 0.7, lunge: 0.7 },
    capacity: {
      squat: { reps_to_failure: 22, one_rm_kg: null },
      hinge: { kb_swings_60s: 30, rdl_one_rm_kg: 35 },
      push: { strict_pushups: 8, shoulder_press_one_rm_kg: 10 },
      pull: { dead_hang_seconds: 25, pullups: 1 },
      carry: { load_kg: 14, distance_m: 25 },
    },
    parq: { q1: false, q2: false, q3: false, q4: false, q5: true, q6: false, q7: false },
    risk_factors: { bmi_category: "normal" },
    mobility: { shoulder: 5, hip: 5, ankle: 5, thoracic: 5, wrist: 5, knee: 5 },
    standing_posture_notes: "Hiperlordose lombar. Hiperextensão dos joelhos em pé.",
    known_imbalances: "Cintura escapular instável bilateralmente. Glúteos hipotónicos.",
    body_fat_pct: [18, 24],
    body_fat_method: "navy_tape",
    smart_specific: "Manter shoulder press 12kg × 8 sem dor no ombro direito",
    smart_measurable: "3×8 @ 12kg, 0 dor 24h após",
    readiness_stage: "preparation",
    resting_hr: [58, 68],
    systolic: [104, 114],
    diastolic: [64, 72],
    years_training: [0, 1.5],
    medications: "",
    med_flags: [],
    expected_red_flags: ["limit_end_range", "isometric_priority", "scapular_stability", "no_max_rom_under_load", "tempo_emphasis"],
  },
  // ============== 10. Shift worker — poor sleep ==============
  {
    archetype_label: "shift_worker_poor_sleep",
    name_pool: ["Tatiana Faria", "Rita Albuquerque", "Sofia Bastos", "Daniela Marques"],
    sex: "female",
    age: [30, 42],
    height_cm: [160, 172],
    weight_kg: [60, 76],
    experience_level: "intermediate",
    primary_goal: "Manter força e composição corporal apesar de turnos rotativos de enfermagem",
    secondary_goals: ["Gerir fadiga", "Não ganhar peso"],
    training_days_per_week: 3,
    session_duration_minutes: 45,
    available_equipment: ["Barbell", "Dumbbells", "Kettlebells", "Cable machine", "Bench"],
    training_location: "Ginásio do hospital",
    injuries: "Lombar pontual após turnos longos.",
    medical_conditions: "",
    preferences: "Horário imprevisível — precisa de plano com 'se hoje me sinto bem / se hoje estou destruída' opções.",
    notes: "Fadiga crónica. Recovery score real provavelmente sobrevalorizado por questionário.",
    sleep: [3, 6],
    stress: [6, 8],
    hours_seated: [4, 7],
    daily_steps: [8000, 14000],
    hydration: [5, 8],
    form_quality: { squat: 0.7, hinge: 0.7, push: 0.7, pull: 0.6, carry: 0.8, lunge: 0.6 },
    capacity: {
      squat: { reps_to_failure: 20, one_rm_kg: 60 },
      hinge: { kb_swings_60s: 35, rdl_one_rm_kg: 55 },
      push: { strict_pushups: 10, shoulder_press_one_rm_kg: 18 },
      pull: { dead_hang_seconds: 25, pullups: 1 },
      carry: { load_kg: 18, distance_m: 25 },
    },
    parq: { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false },
    risk_factors: { bmi_category: "normal", sedentary: false },
    mobility: { shoulder: 4, hip: 4, ankle: 4, thoracic: 3, wrist: 4, knee: 4 },
    standing_posture_notes: "Postura OK. Sinais visíveis de fadiga.",
    known_imbalances: "Sem assimetria estrutural notável.",
    body_fat_pct: [22, 30],
    body_fat_method: "bioimpedance",
    smart_specific: "Manter goblet squat 24kg × 8 e pull-up assistido em 12 semanas",
    smart_measurable: "3×8 @ 24kg + 5 pull-ups com banda verde",
    readiness_stage: "action",
    resting_hr: [66, 76],
    systolic: [112, 122],
    diastolic: [70, 78],
    years_training: [2, 5],
    medications: "",
    med_flags: [],
    expected_red_flags: ["fatigue_managed", "autoregulation_required", "moderate_volume", "rpe_cap_8"],
  },
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(range: [number, number]): number {
  const [lo, hi] = range;
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}
function randFloat(range: [number, number], decimals = 1): number {
  const [lo, hi] = range;
  return Number((lo + Math.random() * (hi - lo)).toFixed(decimals));
}

/** Build a form-criteria record where ~quality fraction of items are TRUE. */
function buildFormCriteria(pattern: PatternId, quality: number): Record<string, boolean> {
  const crits = FORM_CRITERIA[pattern];
  // Deterministic per-pattern: pick the first N as "passing" so it stays
  // recognisable in screenshots. Add jitter on the boundary item.
  const passCount = Math.round(crits.length * quality);
  const out: Record<string, boolean> = {};
  crits.forEach((c, i) => {
    out[c.key] = i < passCount;
  });
  return out;
}

/** Capacity record — copies persona overrides; missing keys → null. */
function buildCapacity(pattern: PatternId, override: Record<string, number | null> | undefined): Record<string, number | null> {
  const fields = CAPACITY_FIELDS[pattern];
  const out: Record<string, number | null> = {};
  for (const f of fields) {
    out[f.key] = override?.[f.key] ?? null;
  }
  return out;
}

function pickPersona(archetype?: string): Persona {
  if (archetype) {
    const found = PERSONAS.find((p) => p.archetype_label === archetype);
    if (found) return found;
  }
  return rand(PERSONAS);
}

export const createDemoClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { archetype?: string } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const persona = pickPersona(data?.archetype);
    const fullName = rand(persona.name_pool);
    const age = randInt(persona.age);
    const heightCm = randInt(persona.height_cm);
    const weightKg = randFloat(persona.weight_kg);
    const sleepQuality = randInt(persona.sleep);
    const stressLevel = randInt(persona.stress);

    // 1) Create the client row
    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .insert({
        trainer_id: userId,
        full_name: `${fullName} (demo)`,
        email: null,
        age,
        sex: persona.sex,
        height_cm: heightCm,
        weight_kg: weightKg,
        notes: persona.notes,
        intake_status: "reviewed",
      })
      .select("id")
      .single();
    if (clientErr || !client) throw new Error(clientErr?.message ?? "Failed to create demo client.");

    // 2) Build the assessment payload — coherent with the persona
    const today = new Date().toISOString().slice(0, 10);
    const ninetyDays = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);

    const systolic = randInt(persona.systolic);
    const diastolic = randInt(persona.diastolic);
    // Risk count rules mirror the client-side computeRisk() in clients_.$clientId.tsx.
    const rf = persona.risk_factors;
    let riskCount = 0;
    if (rf.family_cvd) riskCount++;
    if (rf.smoking === "current") riskCount++;
    if (rf.sedentary) riskCount++;
    if (rf.bmi_category === "obese" || rf.bmi_category === "overweight") riskCount++;
    if (rf.dyslipidemia) riskCount++;
    if (rf.prediabetes) riskCount++;
    if (rf.hypertension) riskCount++;
    const acsmRisk = riskCount >= 4 ? "high" : riskCount >= 2 ? "moderate" : "low";

    // Build all six pattern form-criteria + capacity records.
    const formCriteriaCols: Record<string, Record<string, boolean>> = {};
    const capacityCols: Record<string, Record<string, number | null>> = {};
    const screenNotAssessed: Record<string, boolean> = {};
    for (const p of PATTERN_IDS) {
      const q = persona.form_quality[p];
      if (q == null) {
        screenNotAssessed[p] = true;
        formCriteriaCols[`${p}_form_criteria`] = {};
        capacityCols[`${p}_capacity`] = {};
      } else {
        formCriteriaCols[`${p}_form_criteria`] = buildFormCriteria(p, q);
        capacityCols[`${p}_capacity`] = buildCapacity(p, persona.capacity[p]);
      }
    }

    const assessment = {
      trainer_id: userId,
      client_id: client.id,
      performed_on: today,
      // Goals
      primary_goal: persona.primary_goal,
      secondary_goals: persona.secondary_goals,
      experience_level: persona.experience_level,
      // Training context
      training_days_per_week: persona.training_days_per_week,
      session_duration_minutes: persona.session_duration_minutes,
      available_equipment: persona.available_equipment,
      training_location: persona.training_location,
      // Health
      injuries: persona.injuries,
      medical_conditions: persona.medical_conditions,
      medications: persona.medications,
      med_flags: persona.med_flags,
      preferences: persona.preferences,
      // Lifestyle
      sleep_quality: sleepQuality,
      stress_level: stressLevel,
      nutrition_habits: "Refeições caseiras, 3 principais + 1 snack. Pouca ingestão de vegetais aos fins-de-semana.",
      hydration_glasses_per_day: randInt(persona.hydration),
      mobility_limitations: persona.injuries ? "Ver campo de lesões." : "",
      energy_levels: sleepQuality >= 7 ? "Boa" : "Moderada",
      recovery_capacity: sleepQuality >= 7 && stressLevel <= 5 ? "Boa" : "Moderada",
      lifestyle: "Profissional ativo, deslocações motorizadas.",
      // Posture
      standing_posture_notes: persona.standing_posture_notes,
      known_imbalances: persona.known_imbalances,
      dominant_side: "Direita",
      // Movement screen v2 (form criteria + capacity per pattern)
      ...formCriteriaCols,
      ...capacityCols,
      screen_not_assessed: screenNotAssessed,
      // Anthropometry
      waist_cm: persona.sex === "female" ? randFloat([68, 82]) : randFloat([82, 96]),
      hip_cm: persona.sex === "female" ? randFloat([92, 104]) : randFloat([95, 105]),
      body_fat_pct: persona.body_fat_pct ? randFloat(persona.body_fat_pct) : null,
      body_fat_method: persona.body_fat_method ?? null,
      // Cardio / risk
      resting_heart_rate: randInt(persona.resting_hr),
      systolic_bp_mmhg: systolic,
      diastolic_bp_mmhg: diastolic,
      bp_measured_at: new Date().toISOString(),
      cardio_capacity: "Subiu 4 lances de escadas sem dispneia significativa.",
      acsm_risk_category: acsmRisk,
      parq_passed: !Object.values(persona.parq).some((v) => v === true),
      // Training history
      years_training: randFloat(persona.years_training),
      previous_program_style: persona.experience_level === "beginner"
        ? "Aulas de grupo / treino livre sem estrutura"
        : "5×5 / Push-Pull-Legs",
      max_lifts: persona.experience_level === "beginner"
        ? "Sem PRs registados"
        : `Agachamento ~${randInt([80, 120])}kg, Supino ~${randInt([60, 90])}kg, PM ~${randInt([100, 150])}kg`,
      current_capacity_vs_pb: persona.experience_level === "beginner" ? randInt([5, 7]) : randInt([6, 8]),
      // SMART goal
      smart_specific: persona.smart_specific,
      smart_measurable: persona.smart_measurable,
      smart_deadline: ninetyDays,
      readiness_stage: persona.readiness_stage,
      // Extended bag — drives Pre-Stage 0 + the AI judge rubric.
      extended: {
        parq: persona.parq,
        risk: persona.risk_factors,
        hours_seated: randInt(persona.hours_seated),
        daily_steps: randInt(persona.daily_steps),
        job_type: "Híbrido (escritório + casa)",
        meals_per_day: randInt([3, 5]),
        alcohol_units_week: persona.experience_level === "advanced" ? randInt([0, 4]) : randInt([0, 8]),
        processed_food_freq: rand(["raro", "semanal", "diário"]),
        water_l_per_day: randFloat([1.5, 3]),
        mob_shoulder: persona.mobility.shoulder,
        mob_hip: persona.mobility.hip,
        mob_ankle: persona.mobility.ankle,
        mob_thoracic: persona.mobility.thoracic,
        mob_wrist: persona.mobility.wrist,
        mob_knee: persona.mobility.knee,
        cardio_test: "untested",
        cardio_value: "",
        soreness: randInt([2, 5]),
        provenance: {},
        // Demo harness metadata. Read by judgeDemoRun to score the plan.
        demo_meta: {
          archetype: persona.archetype_label,
          expected_red_flags: persona.expected_red_flags,
          generated_at: new Date().toISOString(),
        },
      },
    };

    const { error: aErr } = await supabaseAdmin.from("assessments").insert(assessment);
    if (aErr) {
      // Roll back the client to avoid orphans
      await supabaseAdmin.from("clients").delete().eq("id", client.id);
      throw new Error(`Falha ao criar avaliação demo: ${aErr.message}`);
    }

    return {
      clientId: client.id as string,
      persona: persona.primary_goal,
      archetype: persona.archetype_label,
      expected_red_flags: persona.expected_red_flags,
    };
  });
