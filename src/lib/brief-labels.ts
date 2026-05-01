// Display-only labels for canonical Brief / ProgrammingVariables enum values.
// The DB stores the canonical key (e.g. `fat_loss`); only the visible
// `<option>` text uses the map.

export const PRIMARY_GOAL_LABELS_PT: Record<string, string> = {
  hypertrophy: "Hipertrofia",
  strength: "Força",
  conditioning: "Condição física",
  mixed: "Misto",
  fat_loss: "Perda de gordura",
  general: "Geral",
};

export const TRAINING_AGE_LABELS_PT: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermédio",
  advanced: "Avançado",
};

export const TRAINING_SPLIT_LABELS_PT: Record<string, string> = {
  full_body: "Corpo inteiro",
  upper_lower: "Superior / Inferior",
  ppl: "Empurrar / Puxar / Pernas",
  pplc: "Empurrar / Puxar / Pernas / Core",
  ppl_x2: "PPL (×2/sem)",
  body_part_split: "Por grupo muscular",
  custom: "Personalizado",
};

export const DELOAD_FREQUENCY_LABELS_PT: Record<string, string> = {
  every_3_weeks: "A cada 3 semanas",
  every_4_weeks: "A cada 4 semanas",
  every_5_weeks: "A cada 5 semanas",
  every_6_weeks: "A cada 6 semanas",
  no_deload: "Sem deload",
};

export const DELOAD_STYLE_LABELS_PT: Record<string, string> = {
  volume_reduction: "Redução de volume (-30%)",
  intensity_reduction: "Redução de intensidade (-15% carga)",
  full_rest_week: "Semana de descanso total",
  mixed: "Misto (-15% carga e -30% volume)",
};

export const EXERCISE_BIAS_LABELS_PT: Record<string, string> = {
  compound_first: "Compostos primeiro",
  balanced: "Equilibrado",
  isolation_friendly: "Favorável a isolamento",
  bodyweight_friendly: "Favorável a peso corporal",
  equipment_flexible: "Flexível a equipamento",
};

export const INT_VOL_LABELS_PT: Record<string, string> = {
  high_int_low_vol: "Alta intensidade / baixo volume",
  moderate_moderate: "Moderado / moderado",
  moderate_int_high_vol: "Intensidade moderada / volume alto",
  low_int_very_high_vol: "Baixa intensidade / volume muito alto",
};

export const FLAG_STRATEGY_LABELS_PT: Record<string, string> = {
  AVOID: "Evitar",
  MODIFY: "Modificar",
  MONITOR: "Monitorizar",
  ACCOMMODATE: "Acomodar",
};