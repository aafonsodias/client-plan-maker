/**
 * Round 63 — Mission ladder to drive an assessment from its current score
 * up to 100/100. Each missing field maps to a `Mission` with an impact score
 * (priority) and a one-line instruction. `distributeAcrossDays` spreads them
 * round-robin over the trainee's training days so the PDF can print
 * "Day 3 mission: take a frontal photo" and the next visit moves the score.
 *
 * Source heuristics:
 *  - Anthropometrics (height/weight/waist/hip/body-fat): high impact (programming)
 *  - Cardio submax + RHR + BP: high impact (ACSM Ch. 4)
 *  - SMART deadline + readiness stage: medium impact (Ch. 12 behaviour change)
 *  - Movement screen scores (squat/hinge/overhead/SL balance): medium impact
 *  - Sleep / hydration / stress lifestyle: low impact but easy win
 *  - Photos: low impact, easy win
 *
 * Total impact roughly equals 100 across all missions of an empty profile.
 */

export type Mission = {
  id: string;
  impact: number; // points credited when completed
  category: "anthro" | "cardio" | "screen" | "smart" | "lifestyle" | "photo";
  copy: string;
};

type AssessmentLike = Record<string, any> | null | undefined;

function missing(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (typeof v === "number" && Number.isNaN(v)) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === "object" && Object.keys(v).length === 0) return true;
  return false;
}

export function computeAssessmentMissions(a: AssessmentLike, client?: AssessmentLike): Mission[] {
  const out: Mission[] = [];
  // Anthro
  if (missing(client?.weight_kg)) out.push({ id: "weight", impact: 5, category: "anthro", copy: "Pesa-te em jejum, regista no app." });
  if (missing(client?.height_cm)) out.push({ id: "height", impact: 4, category: "anthro", copy: "Mede a tua altura (sem sapatos)." });
  if (missing(a?.waist_cm)) out.push({ id: "waist", impact: 4, category: "anthro", copy: "Mede o perímetro da cintura (umbigo)." });
  if (missing(a?.hip_cm)) out.push({ id: "hip", impact: 3, category: "anthro", copy: "Mede o perímetro da anca (parte mais larga)." });
  if (missing(a?.body_fat_pct)) out.push({ id: "bf", impact: 3, category: "anthro", copy: "Estima %MG (DEXA, balança bioimpedância ou pregas)." });

  // Cardio + sinais
  if (missing(a?.resting_heart_rate)) out.push({ id: "rhr", impact: 5, category: "cardio", copy: "Mede a frequência cardíaca em repouso ao acordar (5 min deitado)." });
  if (missing(a?.systolic_bp_mmhg) || missing(a?.diastolic_bp_mmhg)) out.push({ id: "bp", impact: 8, category: "cardio", copy: "Mede tensão arterial (farmácia ou aparelho doméstico)." });
  if (missing(a?.submax_test) || (a?.submax_test && missing(a.submax_test?.vo2_estimated))) {
    out.push({ id: "submax", impact: 12, category: "cardio", copy: "Faz o teste submáximo (Rockport 1.6 km caminhada rápida) — anota tempo + FC final." });
  }

  // SMART + readiness
  if (missing(a?.smart_specific)) out.push({ id: "smart_specific", impact: 4, category: "smart", copy: "Define o objetivo SMART em 1 frase específica." });
  if (missing(a?.smart_measurable)) out.push({ id: "smart_measurable", impact: 4, category: "smart", copy: "Define como vais medir o sucesso (kg, km, %, fotos)." });
  if (missing(a?.smart_deadline)) out.push({ id: "smart_deadline", impact: 4, category: "smart", copy: "Escolhe uma data-objetivo realista (3, 6 ou 12 meses)." });
  if (missing(a?.readiness_stage)) out.push({ id: "readiness", impact: 3, category: "smart", copy: "Marca em que fase de prontidão estás (a pensar / a planear / a fazer)." });

  // Movement screen
  if (missing(a?.squat_depth_score)) out.push({ id: "squat", impact: 5, category: "screen", copy: "Avaliação de agachamento — pede ao teu PT na próxima sessão." });
  if (missing(a?.hip_hinge_score)) out.push({ id: "hinge", impact: 5, category: "screen", copy: "Avaliação de hip-hinge (RDL com pau) — na próxima sessão." });
  if (missing(a?.overhead_reach_score)) out.push({ id: "overhead", impact: 4, category: "screen", copy: "Avaliação de mobilidade overhead — na próxima sessão." });
  if (missing(a?.single_leg_balance_score)) out.push({ id: "sl_balance", impact: 4, category: "screen", copy: "Teste de equilíbrio unilateral (30s por perna)." });

  // Lifestyle
  if (missing(a?.sleep_quality)) out.push({ id: "sleep", impact: 3, category: "lifestyle", copy: "Avalia a qualidade do sono (1-10) durante 1 semana." });
  if (missing(a?.stress_level)) out.push({ id: "stress", impact: 3, category: "lifestyle", copy: "Avalia o stress diário (1-10) durante 1 semana." });
  if (missing(a?.hydration_glasses_per_day)) out.push({ id: "hydration", impact: 2, category: "lifestyle", copy: "Conta os copos de água/dia durante 3 dias." });
  if (missing(a?.nutrition_habits)) out.push({ id: "nutrition", impact: 3, category: "lifestyle", copy: "Descreve um dia alimentar típico (pequeno-almoço → jantar)." });

  // Photos
  if (missing(client?.photo_url)) out.push({ id: "photos", impact: 5, category: "photo", copy: "Tira 3 fotos de pé (frente, lado, costas) com top neutro." });

  // Sort by impact desc — biggest wins first.
  out.sort((a, b) => b.impact - a.impact);
  return out;
}

export function distributeMissionsAcrossDays(
  missions: Mission[],
  trainingDaysPerWeek: number,
): Array<{ dayIndex: number; mission: Mission }> {
  const days = Math.max(1, Math.min(7, trainingDaysPerWeek || 3));
  return missions.map((m, i) => ({ dayIndex: (i % days) + 1, mission: m }));
}

/** Total points still on the table (sum of impacts of all open missions). */
export function missionsRemainingScore(missions: Mission[]): number {
  return missions.reduce((acc, m) => acc + m.impact, 0);
}