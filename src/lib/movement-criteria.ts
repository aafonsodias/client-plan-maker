// Form-criterion checklist + capacity input schema for the redesigned
// Movement Screen. The 1–5 sliders (squat_depth_score, etc.) are deprecated.

export type PatternId = "squat" | "hinge" | "push" | "pull" | "carry" | "lunge";

export const PATTERN_IDS: PatternId[] = [
  "squat",
  "hinge",
  "push",
  "pull",
  "carry",
  "lunge",
];

export const PATTERN_LABELS_PT: Record<PatternId, string> = {
  squat: "Agachamento",
  hinge: "Hip hinge",
  push: "Empurrar (overhead)",
  pull: "Puxar",
  carry: "Carregar",
  lunge: "Lunge",
};

export type FormCriterion = {
  key: string;
  label_pt: string;
  tooltip_pt: string;
};

export const FORM_CRITERIA: Record<PatternId, FormCriterion[]> = {
  squat: [
    {
      key: "heels_down",
      label_pt: "Calcanhares no chão durante todo o movimento",
      tooltip_pt:
        "Sem elevação dos calcanhares. Indica mobilidade de tornozelo suficiente para o padrão.",
    },
    {
      key: "knees_track",
      label_pt: "Joelhos alinhados com os pés (sem valgus dinâmico)",
      tooltip_pt:
        "Joelhos não colapsam para dentro na descida. Sinal de estabilidade da anca.",
    },
    {
      key: "torso_vertical",
      label_pt: "Tronco vertical, sem flexão lombar excessiva",
      tooltip_pt:
        "Mantém pilar estável; permite carregar coluna em segurança.",
    },
    {
      key: "depth_parallel",
      label_pt: "Profundidade: prega da anca igual ou abaixo do joelho",
      tooltip_pt:
        "Standard ACSM/USAW para 'full squat'. Acima paralelo = parcial.",
    },
    {
      key: "no_butt_wink",
      label_pt: "Sem butt wink na fase final",
      tooltip_pt:
        "Sem retroversão pélvica no fundo do agachamento. Protege coluna lombar.",
    },
  ],
  hinge: [
    {
      key: "hip_initiated",
      label_pt: "Movimento iniciado pela anca, não pelo joelho",
      tooltip_pt: "Hinge é dominante de anca; squat é dominante de joelho.",
    },
    {
      key: "neutral_spine",
      label_pt: "Coluna neutra (sem rounding lombar)",
      tooltip_pt: "Sem flexão lombar sob carga — protege discos.",
    },
    {
      key: "hamstring_tension",
      label_pt: "Tensão visível nos isquiotibiais",
      tooltip_pt:
        "Indica que está a usar a cadeia posterior, não a coluna.",
    },
    {
      key: "controlled_descent",
      label_pt: "Descida controlada (3+ segundos)",
      tooltip_pt: "Excêntrica lenta = controlo motor real.",
    },
    {
      key: "glute_lockout",
      label_pt: "Bloqueio de glúteos no topo",
      tooltip_pt:
        "Extensão completa de anca sem hiperextensão lombar compensatória.",
    },
  ],
  push: [
    {
      key: "elbow_lockout",
      label_pt: "Bloqueio completo dos cotovelos no topo",
      tooltip_pt:
        "Amplitude completa overhead. Limitação aqui = restrição de ombro/torácica.",
    },
    {
      key: "no_rib_flare",
      label_pt: "Sem flare das costelas (caixa torácica neutra)",
      tooltip_pt:
        "Costelas alinhadas com a anca; sem hiperextensão lombar para 'alcançar' o overhead.",
    },
    {
      key: "neutral_neck",
      label_pt: "Pescoço neutro, sem extensão cervical",
      tooltip_pt:
        "Olhar em frente, queixo neutro. Compensação cervical = restrição torácica.",
    },
    {
      key: "scap_upward_rotation",
      label_pt: "Rotação superior da escápula visível",
      tooltip_pt:
        "Trapézio superior + serrátil a trabalhar — pré-requisito para overhead seguro.",
    },
    {
      key: "no_lateral_lean",
      label_pt: "Sem inclinação lateral compensatória",
      tooltip_pt: "Push simétrico; assimetria = restrição unilateral.",
    },
  ],
  pull: [
    {
      key: "full_rom",
      label_pt: "Amplitude completa (peito à barra ou linha horizontal)",
      tooltip_pt:
        "Pull-up: peito à barra. Row: cotovelo paralelo ao tronco no topo.",
    },
    {
      key: "scap_retraction",
      label_pt: "Retração escapular visível no topo",
      tooltip_pt:
        "Romboides + trap médio engajados. Sem 'puxar com os bíceps'.",
    },
    {
      key: "no_kipping",
      label_pt: "Sem kipping ou impulso",
      tooltip_pt:
        "Reps estritas. Kipping mascara défice de força no movimento.",
    },
    {
      key: "neutral_neck_pull",
      label_pt: "Pescoço neutro, sem extensão",
      tooltip_pt: "Sem 'esticar o queixo' para chegar à barra.",
    },
    {
      key: "controlled_eccentric",
      label_pt: "Excêntrica controlada (2+ segundos)",
      tooltip_pt: "Descida lenta indica controlo real, não inércia.",
    },
  ],
  carry: [
    {
      key: "rib_stack",
      label_pt: "Costelas alinhadas com a anca (rib stack)",
      tooltip_pt:
        "Sem flare costal. Pilar central engajado contra a carga.",
    },
    {
      key: "neutral_spine_carry",
      label_pt: "Coluna neutra durante toda a marcha",
      tooltip_pt: "Sem inclinação lateral nem rotação compensatória.",
    },
    {
      key: "stable_gait",
      label_pt: "Marcha estável e simétrica",
      tooltip_pt: "Cadência uniforme; passos do mesmo comprimento.",
    },
    {
      key: "grip_stability",
      label_pt: "Estabilidade de preensão (sem deslizar)",
      tooltip_pt:
        "Grip aguenta a carga sem reposicionar — limitador frequente.",
    },
    {
      key: "no_hip_drop",
      label_pt: "Sem queda contralateral da anca",
      tooltip_pt:
        "Trendelenburg negativo. Glúteo médio do lado de apoio ativo.",
    },
  ],
  lunge: [
    {
      key: "torso_vertical_lunge",
      label_pt: "Tronco vertical durante todo o movimento",
      tooltip_pt:
        "Sem inclinar tronco para a frente; carga distribuída pela perna da frente.",
    },
    {
      key: "front_knee_tracking",
      label_pt: "Joelho da frente alinhado com o pé",
      tooltip_pt:
        "Sem valgus do joelho da frente. Sinal de controlo de anca unilateral.",
    },
    {
      key: "controlled_descent_lunge",
      label_pt: "Descida controlada",
      tooltip_pt: "Sem 'cair' no fundo do lunge.",
    },
    {
      key: "single_leg_hip_stability",
      label_pt: "Estabilidade de anca em apoio unipodal",
      tooltip_pt:
        "Sem desvio lateral da anca de apoio — glúteo médio funcional.",
    },
    {
      key: "left_right_symmetry",
      label_pt: "Simetria entre lado esquerdo e direito",
      tooltip_pt:
        "Diferença de qualidade entre lados >20% = assimetria a corrigir.",
    },
  ],
};

export type CapacityFieldDef = {
  key: string;
  label_pt: string;
  unit?: string;
  type: "number";
};

export const CAPACITY_FIELDS: Record<PatternId, CapacityFieldDef[]> = {
  squat: [
    { key: "reps_to_failure", label_pt: "Reps até falha (peso corporal)", type: "number" },
    { key: "one_rm_kg", label_pt: "1RM (kg)", type: "number" },
  ],
  hinge: [
    { key: "kb_swings_60s", label_pt: "KB swings em 60s", type: "number" },
    { key: "rdl_one_rm_kg", label_pt: "RDL 1RM (kg)", type: "number" },
  ],
  push: [
    { key: "strict_pushups", label_pt: "Flexões estritas até falha", type: "number" },
    { key: "shoulder_press_one_rm_kg", label_pt: "Shoulder press 1RM (kg)", type: "number" },
  ],
  pull: [
    { key: "dead_hang_seconds", label_pt: "Dead hang (segundos)", type: "number" },
    { key: "pullups", label_pt: "Pull-ups (reps)", type: "number" },
  ],
  carry: [
    { key: "load_kg", label_pt: "Carga (kg)", type: "number" },
    { key: "distance_m", label_pt: "Distância (m)", type: "number" },
  ],
  lunge: [
    {
      key: "walking_lunge_reps_per_side",
      label_pt: "Walking lunge reps por lado",
      type: "number",
    },
    {
      key: "bulgarian_one_rm_kg",
      label_pt: "Bulgarian split squat 1RM (kg)",
      type: "number",
    },
  ],
};

export function formScore(criteria: Record<string, unknown> | null | undefined): number {
  if (!criteria) return 0;
  return Object.values(criteria).filter(Boolean).length;
}

/**
 * Derive a 1–5 competency score from form-criteria booleans + capacity values.
 *
 * Form: 0–5 criteria pass → maps to 1–5 (we add 1 floor so a totally failed
 * pattern still shows on the radar at level 1 instead of looking unassessed).
 * Capacity: light bonus when at least one capacity field is filled and above
 * a per-pattern "novice" floor; never lifts the score above 5.
 */
const NOVICE_FLOORS: Record<PatternId, Record<string, number>> = {
  squat: { reps_to_failure: 12, one_rm_kg: 60 },
  hinge: { kb_swings_60s: 25, rdl_one_rm_kg: 40 },
  push: { strict_pushups: 10, shoulder_press_one_rm_kg: 20 },
  pull: { dead_hang_seconds: 20, pullups: 1 },
  carry: { load_kg: 16, distance_m: 20 },
  lunge: { walking_lunge_reps_per_side: 8, bulgarian_one_rm_kg: 16 },
};

export function derivePatternScore(
  pattern: PatternId,
  formCriteria: Record<string, unknown> | null | undefined,
  capacity: Record<string, number | null> | null | undefined,
): number | null {
  const criteria = FORM_CRITERIA[pattern];
  const totalCrits = criteria.length;
  const pass = formScore(formCriteria);
  // No data at all on either axis → un-assessed.
  const hasAnyCriteria = formCriteria && Object.keys(formCriteria).length > 0;
  const hasAnyCapacity = capacity && Object.values(capacity).some((v) => v != null);
  if (!hasAnyCriteria && !hasAnyCapacity) return null;
  // Map pass count (0..N) to 1..5 score.
  const formPart = totalCrits > 0 ? Math.round(1 + (pass / totalCrits) * 4) : 3;
  // Capacity nudge: +1 if any capacity field meets/exceeds the novice floor.
  let capBoost = 0;
  if (hasAnyCapacity) {
    const floors = NOVICE_FLOORS[pattern];
    for (const [k, v] of Object.entries(capacity ?? {})) {
      if (v == null) continue;
      const floor = floors[k];
      if (floor != null && (v as number) >= floor) {
        capBoost = 1;
        break;
      }
    }
  }
  return Math.max(1, Math.min(5, formPart + (formPart < 5 ? capBoost : 0)));
}

/**
 * Build a one-sentence Portuguese summary per pattern from raw assessment
 * data. Used as a deterministic fallback when Pre-Stage 0 hasn't run and the
 * Stage 1 brief would otherwise emit "<UNKNOWN>" placeholders.
 */
export function buildPatternSentence(
  pattern: PatternId,
  formCriteria: Record<string, unknown> | null | undefined,
  capacity: Record<string, number | null> | null | undefined,
  notAssessed?: boolean,
): string {
  if (notAssessed) return `${PATTERN_LABELS_PT[pattern]} não avaliado.`;
  const score = derivePatternScore(pattern, formCriteria, capacity);
  if (score == null) return `${PATTERN_LABELS_PT[pattern]} sem dados registados.`;
  const totalCrits = FORM_CRITERIA[pattern].length;
  const pass = formScore(formCriteria);
  const capBits: string[] = [];
  if (capacity) {
    for (const def of CAPACITY_FIELDS[pattern]) {
      const v = capacity[def.key];
      if (v != null) capBits.push(`${def.label_pt}: ${v}`);
    }
  }
  const verdict =
    score >= 4
      ? "padrão sólido — pode carregar"
      : score === 3
        ? "padrão funcional com pontos a refinar"
        : score === 2
          ? "padrão a regredir antes de carregar"
          : "padrão a reconstruir desde zero";
  const capStr = capBits.length ? ` · ${capBits.join(" · ")}` : "";
  return `${PATTERN_LABELS_PT[pattern]}: ${pass}/${totalCrits} critérios — ${verdict}${capStr}.`;
}

export function FORM_FIELD(pattern: PatternId): string {
  return `${pattern}_form_criteria`;
}
export function CAPACITY_FIELD(pattern: PatternId): string {
  return `${pattern}_capacity`;
}