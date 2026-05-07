/**
 * Session Taxonomy — R74 Slice 1.
 *
 * Stable vocabulary for complete training-session structure. Pure TypeScript;
 * no UI, no generation hookup. Exists so future structured prescription
 * (warm-up, mobility, activation, coordination/balance, strength,
 * conditioning, cooldown, breathing, education) has a shared key set without
 * forcing every session to include every block today.
 */

export const SESSION_TAXONOMY_VERSION = 1 as const;

export const SESSION_BLOCK_TYPES = [
  "general_warmup",
  "joint_mobility",
  "activation",
  "coordination_balance",
  "cognitive_dual_task",
  "skill_practice",
  "main_strength",
  "accessory_strength",
  "power_speed",
  "cardio_steady_state",
  "cardio_intervals",
  "conditioning_circuit",
  "traditional_game",
  "cooldown",
  "breathing",
  "static_mobility",
  "education_note",
] as const;
export type SessionBlockType = (typeof SESSION_BLOCK_TYPES)[number];

export const SESSION_BLOCK_LABELS_PT: Record<SessionBlockType, string> = {
  general_warmup: "Aquecimento geral",
  joint_mobility: "Mobilidade articular",
  activation: "Ativação",
  coordination_balance: "Coordenação e equilíbrio",
  cognitive_dual_task: "Dupla tarefa cognitiva",
  skill_practice: "Prática técnica",
  main_strength: "Força principal",
  accessory_strength: "Força acessória",
  power_speed: "Potência / velocidade",
  cardio_steady_state: "Cardio contínuo",
  cardio_intervals: "Intervalos",
  conditioning_circuit: "Circuito",
  traditional_game: "Jogo tradicional",
  cooldown: "Cooldown",
  breathing: "Respiração",
  static_mobility: "Mobilidade final",
  education_note: "Nota educativa",
};

export const SESSION_BLOCK_LABELS_EN: Record<SessionBlockType, string> = {
  general_warmup: "General warm-up",
  joint_mobility: "Joint mobility",
  activation: "Activation",
  coordination_balance: "Coordination and balance",
  cognitive_dual_task: "Cognitive dual task",
  skill_practice: "Skill practice",
  main_strength: "Main strength",
  accessory_strength: "Accessory strength",
  power_speed: "Power / speed",
  cardio_steady_state: "Steady-state cardio",
  cardio_intervals: "Intervals",
  conditioning_circuit: "Circuit",
  traditional_game: "Traditional game",
  cooldown: "Cooldown",
  breathing: "Breathing",
  static_mobility: "Final mobility",
  education_note: "Education note",
};