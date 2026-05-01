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

export function FORM_FIELD(pattern: PatternId): string {
  return `${pattern}_form_criteria`;
}
export function CAPACITY_FIELD(pattern: PatternId): string {
  return `${pattern}_capacity`;
}