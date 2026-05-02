import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Creates a fully-populated demo client + assessment so trainers can preview
 * the planning flow without manually keying 60+ fields. Three rotating personas,
 * each with internally-consistent anthropometry, lifestyle and movement scores.
 *
 * No AI: deterministic random with curated templates is cheaper, faster and
 * more reliable than an LLM for "Sleep: 7, Stress: 4". The plan generation
 * downstream still uses the real AI pipeline.
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
  // Movement screen 1-5
  squat: [number, number];
  hinge: [number, number];
  overhead: [number, number];
  balance: [number, number];
  // Goal
  smart_specific: string;
  smart_measurable: string;
  readiness_stage: "preparation" | "action" | "maintenance";
  // Risk
  resting_hr: [number, number];
  systolic: [number, number];
  diastolic: [number, number];
  years_training: [number, number];
};

const PERSONAS: Persona[] = [
  {
    name_pool: ["Sofia Martins", "Beatriz Almeida", "Inês Correia", "Mariana Lopes", "Catarina Ferreira"],
    sex: "female",
    age: [28, 38],
    height_cm: [162, 172],
    weight_kg: [58, 70],
    experience_level: "beginner",
    primary_goal: "Aumentar força funcional e melhorar postura",
    secondary_goals: ["Reduzir dor lombar pontual", "Construir hábito 3×/semana"],
    training_days_per_week: 3,
    session_duration_minutes: 50,
    available_equipment: ["barra", "halteres", "kettlebell", "elásticos"],
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
    squat: [3, 4],
    hinge: [3, 4],
    overhead: [3, 4],
    balance: [4, 5],
    smart_specific: "Realizar 5 hip thrusts a 60kg com técnica controlada",
    smart_measurable: "5 reps × 60kg @ RPE 8",
    readiness_stage: "action",
    resting_hr: [62, 72],
    systolic: [110, 122],
    diastolic: [70, 78],
    years_training: [0, 2],
  },
  {
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
    available_equipment: ["barra", "halteres", "rack", "kettlebell", "máquinas"],
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
    squat: [4, 5],
    hinge: [3, 4],
    overhead: [3, 4],
    balance: [3, 4],
    smart_specific: "Fazer 5 pull-ups estritas seguidas",
    smart_measurable: "5 reps com peso corporal sem kipping",
    readiness_stage: "action",
    resting_hr: [58, 68],
    systolic: [118, 128],
    diastolic: [74, 82],
    years_training: [3, 6],
  },
  {
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
    available_equipment: ["halteres", "elásticos", "kettlebell leve", "step"],
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
    squat: [2, 3],
    hinge: [2, 3],
    overhead: [3, 4],
    balance: [3, 4],
    smart_specific: "Fazer 8 goblet squats a 12kg com paragem na profundidade",
    smart_measurable: "3×8 @ 12kg, RPE 7",
    readiness_stage: "preparation",
    resting_hr: [68, 78],
    systolic: [125, 138],
    diastolic: [78, 86],
    years_training: [0, 1],
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

export const createDemoClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const persona = rand(PERSONAS);
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

    // ACSM risk: low if all green, moderate if BP borderline or sedentary
    const systolic = randInt(persona.systolic);
    const diastolic = randInt(persona.diastolic);
    const acsmRisk = systolic >= 130 || diastolic >= 80 ? "moderate" : "low";

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
      medications: "",
      med_flags: [],
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
      // Movement screen 1-5
      squat_depth_score: randInt(persona.squat),
      squat_depth_note: "Avaliado em air squat sem carga.",
      hip_hinge_score: randInt(persona.hinge),
      hip_hinge_note: "RDL com cabo da vassoura.",
      overhead_reach_score: randInt(persona.overhead),
      overhead_reach_note: "Wall slide.",
      single_leg_balance_score: randInt(persona.balance),
      single_leg_balance_note: "30s olhos abertos.",
      dominant_side: "Direita",
      // Anthropometry
      waist_cm: persona.sex === "female" ? randFloat([68, 82]) : randFloat([82, 96]),
      hip_cm: persona.sex === "female" ? randFloat([92, 104]) : randFloat([95, 105]),
      // Cardio / risk
      resting_heart_rate: randInt(persona.resting_hr),
      systolic_bp_mmhg: systolic,
      diastolic_bp_mmhg: diastolic,
      bp_measured_at: new Date().toISOString(),
      cardio_capacity: "Subiu 4 lances de escadas sem dispneia significativa.",
      acsm_risk_category: acsmRisk,
      parq_passed: true,
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
      // Extended bag — includes hours_seated, daily_steps, etc.
      extended: {
        hours_seated: randInt(persona.hours_seated),
        daily_steps: randInt(persona.daily_steps),
        job_type: "Híbrido (escritório + casa)",
        soreness: randInt([2, 5]),
      },
    };

    const { error: aErr } = await supabaseAdmin.from("assessments").insert(assessment);
    if (aErr) {
      // Roll back the client to avoid orphans
      await supabaseAdmin.from("clients").delete().eq("id", client.id);
      throw new Error(`Falha ao criar avaliação demo: ${aErr.message}`);
    }

    return { clientId: client.id as string, persona: persona.primary_goal };
  });
