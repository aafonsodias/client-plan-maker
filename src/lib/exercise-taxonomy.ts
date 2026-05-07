/**
 * Exercise Taxonomy — R74 Slice 1.
 *
 * Pure TypeScript foundation. No I/O, no React, no DB, no side effects.
 * Provides stable string-literal vocabulary + 30 seeded canonical exercises +
 * canonicalization helpers so internal joins (volume, capacity-gain, rotation,
 * logbook continuity) can stop relying on raw lowercased free-text names.
 *
 * IMPORTANT: this file does NOT change visible exercise names anywhere.
 * It only provides identity keys for matching.
 */

import type { MuscleGroup } from "./volume-landmarks";

export const EXERCISE_TAXONOMY_VERSION = 1 as const;

// ─────────────────────────────────────────────────────────────────────────────
// Enums (string-literal unions backed by `as const` arrays)
// ─────────────────────────────────────────────────────────────────────────────

export const UMBRELLA_CATEGORIES = [
  "strength",
  "mobility",
  "cardio_conditioning",
  "balance_coordination",
  "power_speed",
  "motor_control",
  "preparation_recovery",
  "play_games",
] as const;
export type UmbrellaCategory = (typeof UMBRELLA_CATEGORIES)[number];

export const MOVEMENT_PATTERNS = [
  "squat",
  "hinge",
  "lunge_split_stance",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "carry",
  "core_anti_extension",
  "core_anti_rotation",
  "core_lateral_stability",
  "hip_extension",
  "hip_abduction",
  "hip_external_rotation",
  "knee_flexion",
  "calf_ankle",
  "thoracic_mobility",
  "hip_mobility",
  "shoulder_scapular_control",
  "aerobic_steady_state",
  "aerobic_intervals",
  "agility",
  "balance",
  "coordination",
  "game_play",
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const EQUIPMENT_KEYS = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "kettlebell",
  "cable",
  "machine",
  "band",
  "trx",
  "bench",
  "box_step",
  "treadmill",
  "elliptical",
  "rowing_machine",
  "bike",
  "medicine_ball",
  "battle_rope",
  "agility_ladder",
  "sliders",
  "mat",
  "partner",
  "none",
  "other",
] as const;
export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];

export const LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "rehab_sensitive",
  "performance",
] as const;
export type Level = (typeof LEVELS)[number];

export const CAUTION_FLAGS = [
  "low_back_sensitive",
  "knee_sensitive",
  "shoulder_sensitive",
  "wrist_sensitive",
  "neck_sensitive",
  "balance_risk",
  "high_impact",
  "axial_loading",
  "overhead_loading",
  "deep_knee_flexion",
  "hip_flexion_sensitive",
  "grip_limited",
  "cardiovascular_caution",
  "pregnancy_caution",
  "older_adult_caution",
  "requires_coach_supervision",
] as const;
export type CautionFlag = (typeof CAUTION_FLAGS)[number];

export const MEDIA_QUALITY_STATUSES = [
  "no_media",
  "founder_demo",
  "reference_demo",
  "verified_demo",
  "needs_reshoot",
  "angle_limited",
  "illustrative_only",
  "stickfigure_overlay",
  "ai_assisted_visual",
] as const;
export type MediaQualityStatus = (typeof MEDIA_QUALITY_STATUSES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Canonical exercise seed (first 30)
// ─────────────────────────────────────────────────────────────────────────────

export type ExerciseTaxonomyEntry = {
  key: ExerciseKey;
  name_pt: string;
  name_en: string;
  aliases_pt: readonly string[];
  aliases_en: readonly string[];
  umbrella: UmbrellaCategory;
  movement_pattern: MovementPattern;
  equipment: readonly EquipmentKey[];
  level: Level;
  primary_muscles: readonly MuscleGroup[];
  secondary_muscles: readonly MuscleGroup[];
  caution_flags: readonly CautionFlag[];
  media_quality_default: MediaQualityStatus;
};

export const EXERCISE_KEYS = [
  "bodyweight_squat",
  "goblet_squat",
  "box_squat",
  "hip_hinge_drill",
  "dumbbell_romanian_deadlift",
  "glute_bridge",
  "hip_thrust",
  "reverse_lunge",
  "split_squat",
  "step_up",
  "incline_push_up",
  "push_up",
  "dumbbell_bench_press",
  "dumbbell_shoulder_press",
  "band_row",
  "cable_row",
  "one_arm_dumbbell_row",
  "lat_pulldown",
  "band_face_pull",
  "dead_bug",
  "plank",
  "side_plank",
  "pallof_press",
  "bird_dog",
  "calf_raise",
  "band_lateral_walk",
  "clamshell",
  "hamstring_slider_curl",
  "wall_sit",
  "farmer_carry",
] as const;
export type ExerciseKey = (typeof EXERCISE_KEYS)[number];

export const EXERCISES: Readonly<Record<ExerciseKey, ExerciseTaxonomyEntry>> = {
  bodyweight_squat: {
    key: "bodyweight_squat",
    name_pt: "Agachamento livre",
    name_en: "Bodyweight Squat",
    aliases_pt: ["agachamento", "agachamento livre", "agachamento corporal"],
    aliases_en: ["bw squat", "air squat", "bodyweight squat"],
    umbrella: "strength",
    movement_pattern: "squat",
    equipment: ["bodyweight"],
    level: "beginner",
    primary_muscles: ["quads", "glutes"],
    secondary_muscles: ["hamstrings", "core"],
    caution_flags: ["knee_sensitive"],
    media_quality_default: "no_media",
  },
  goblet_squat: {
    key: "goblet_squat",
    name_pt: "Agachamento goblet",
    name_en: "Goblet Squat",
    aliases_pt: ["agachamento goblet", "goblet"],
    aliases_en: ["goblet squat", "db goblet squat", "kb goblet squat"],
    umbrella: "strength",
    movement_pattern: "squat",
    equipment: ["dumbbell", "kettlebell"],
    level: "beginner",
    primary_muscles: ["quads", "glutes"],
    secondary_muscles: ["core", "back"],
    caution_flags: ["knee_sensitive"],
    media_quality_default: "no_media",
  },
  box_squat: {
    key: "box_squat",
    name_pt: "Agachamento na caixa",
    name_en: "Box Squat",
    aliases_pt: ["agachamento caixa", "agachamento na caixa", "box squat"],
    aliases_en: ["box squat"],
    umbrella: "strength",
    movement_pattern: "squat",
    equipment: ["box_step", "barbell", "bodyweight"],
    level: "beginner",
    primary_muscles: ["quads", "glutes"],
    secondary_muscles: ["hamstrings", "core"],
    caution_flags: ["knee_sensitive", "low_back_sensitive"],
    media_quality_default: "no_media",
  },
  hip_hinge_drill: {
    key: "hip_hinge_drill",
    name_pt: "Drill de dobradiça do quadril",
    name_en: "Hip Hinge Drill",
    aliases_pt: ["dobradica do quadril", "hinge"],
    aliases_en: ["hip hinge", "hinge drill", "dowel hinge"],
    umbrella: "motor_control",
    movement_pattern: "hinge",
    equipment: ["bodyweight"],
    level: "beginner",
    primary_muscles: ["glutes", "hamstrings"],
    secondary_muscles: ["back", "core"],
    caution_flags: ["low_back_sensitive"],
    media_quality_default: "no_media",
  },
  dumbbell_romanian_deadlift: {
    key: "dumbbell_romanian_deadlift",
    name_pt: "Peso morto romeno com halteres",
    name_en: "Dumbbell Romanian Deadlift",
    aliases_pt: [
      "rdl com halteres",
      "peso morto romeno halteres",
      "stiff com halteres",
    ],
    aliases_en: ["db rdl", "dumbbell rdl", "dumbbell romanian deadlift"],
    umbrella: "strength",
    movement_pattern: "hinge",
    equipment: ["dumbbell"],
    level: "intermediate",
    primary_muscles: ["hamstrings", "glutes"],
    secondary_muscles: ["back", "core"],
    caution_flags: ["low_back_sensitive"],
    media_quality_default: "no_media",
  },
  glute_bridge: {
    key: "glute_bridge",
    name_pt: "Ponte de glúteos",
    name_en: "Glute Bridge",
    aliases_pt: ["ponte gluteos", "ponte de gluteos", "ponte"],
    aliases_en: ["glute bridge", "bridge"],
    umbrella: "strength",
    movement_pattern: "hip_extension",
    equipment: ["bodyweight", "mat"],
    level: "beginner",
    primary_muscles: ["glutes"],
    secondary_muscles: ["hamstrings", "core"],
    caution_flags: [],
    media_quality_default: "no_media",
  },
  hip_thrust: {
    key: "hip_thrust",
    name_pt: "Hip thrust",
    name_en: "Hip Thrust",
    aliases_pt: ["elevacao pelvica", "elevação pélvica", "hip thrust"],
    aliases_en: ["hip thrust", "barbell hip thrust", "db hip thrust"],
    umbrella: "strength",
    movement_pattern: "hip_extension",
    equipment: ["barbell", "dumbbell", "bench"],
    level: "intermediate",
    primary_muscles: ["glutes"],
    secondary_muscles: ["hamstrings", "core"],
    caution_flags: ["low_back_sensitive"],
    media_quality_default: "no_media",
  },
  reverse_lunge: {
    key: "reverse_lunge",
    name_pt: "Afundo invertido",
    name_en: "Reverse Lunge",
    aliases_pt: ["afundo reverso", "afundo invertido", "reverse lunge"],
    aliases_en: ["reverse lunge", "rear lunge"],
    umbrella: "strength",
    movement_pattern: "lunge_split_stance",
    equipment: ["bodyweight", "dumbbell"],
    level: "beginner",
    primary_muscles: ["quads", "glutes"],
    secondary_muscles: ["hamstrings", "core"],
    caution_flags: ["knee_sensitive", "balance_risk"],
    media_quality_default: "no_media",
  },
  split_squat: {
    key: "split_squat",
    name_pt: "Agachamento búlgaro",
    name_en: "Split Squat",
    aliases_pt: [
      "split squat",
      "agachamento bulgaro",
      "agachamento búlgaro",
      "bulgarian split squat",
    ],
    aliases_en: ["split squat", "bulgarian split squat", "rear-foot elevated split squat"],
    umbrella: "strength",
    movement_pattern: "lunge_split_stance",
    equipment: ["bodyweight", "dumbbell", "bench"],
    level: "intermediate",
    primary_muscles: ["quads", "glutes"],
    secondary_muscles: ["hamstrings", "core"],
    caution_flags: ["knee_sensitive", "balance_risk"],
    media_quality_default: "no_media",
  },
  step_up: {
    key: "step_up",
    name_pt: "Subida ao banco",
    name_en: "Step Up",
    aliases_pt: ["subida ao banco", "step up", "subida banco"],
    aliases_en: ["step up", "box step up"],
    umbrella: "strength",
    movement_pattern: "lunge_split_stance",
    equipment: ["box_step", "bench", "dumbbell"],
    level: "beginner",
    primary_muscles: ["quads", "glutes"],
    secondary_muscles: ["hamstrings", "core"],
    caution_flags: ["knee_sensitive", "balance_risk"],
    media_quality_default: "no_media",
  },
  incline_push_up: {
    key: "incline_push_up",
    name_pt: "Flexão inclinada",
    name_en: "Incline Push-Up",
    aliases_pt: ["flexao inclinada", "flexão inclinada", "push up inclinado"],
    aliases_en: ["incline push up", "incline pushup"],
    umbrella: "strength",
    movement_pattern: "horizontal_push",
    equipment: ["bodyweight", "bench"],
    level: "beginner",
    primary_muscles: ["chest"],
    secondary_muscles: ["triceps", "shoulders", "core"],
    caution_flags: ["wrist_sensitive", "shoulder_sensitive"],
    media_quality_default: "no_media",
  },
  push_up: {
    key: "push_up",
    name_pt: "Flexão",
    name_en: "Push-Up",
    aliases_pt: ["flexao", "flexão", "flexão de braços", "push up"],
    aliases_en: ["push up", "pushup", "press up"],
    umbrella: "strength",
    movement_pattern: "horizontal_push",
    equipment: ["bodyweight"],
    level: "intermediate",
    primary_muscles: ["chest"],
    secondary_muscles: ["triceps", "shoulders", "core"],
    caution_flags: ["wrist_sensitive", "shoulder_sensitive"],
    media_quality_default: "no_media",
  },
  dumbbell_bench_press: {
    key: "dumbbell_bench_press",
    name_pt: "Supino com halteres",
    name_en: "Dumbbell Bench Press",
    aliases_pt: ["supino halteres", "supino com halteres", "db bench"],
    aliases_en: ["db bench press", "dumbbell bench", "dumbbell bench press"],
    umbrella: "strength",
    movement_pattern: "horizontal_push",
    equipment: ["dumbbell", "bench"],
    level: "intermediate",
    primary_muscles: ["chest"],
    secondary_muscles: ["triceps", "shoulders"],
    caution_flags: ["shoulder_sensitive"],
    media_quality_default: "no_media",
  },
  dumbbell_shoulder_press: {
    key: "dumbbell_shoulder_press",
    name_pt: "Press de ombros com halteres",
    name_en: "Dumbbell Shoulder Press",
    aliases_pt: [
      "press ombros halteres",
      "press de ombros com halteres",
      "desenvolvimento halteres",
    ],
    aliases_en: ["db shoulder press", "dumbbell overhead press", "dumbbell shoulder press"],
    umbrella: "strength",
    movement_pattern: "vertical_push",
    equipment: ["dumbbell", "bench"],
    level: "intermediate",
    primary_muscles: ["shoulders"],
    secondary_muscles: ["triceps", "core"],
    caution_flags: ["shoulder_sensitive", "overhead_loading"],
    media_quality_default: "no_media",
  },
  band_row: {
    key: "band_row",
    name_pt: "Remada com banda",
    name_en: "Band Row",
    aliases_pt: ["remada banda", "remada com elastico", "remada com elástico"],
    aliases_en: ["band row", "resistance band row"],
    umbrella: "strength",
    movement_pattern: "horizontal_pull",
    equipment: ["band"],
    level: "beginner",
    primary_muscles: ["back"],
    secondary_muscles: ["biceps", "shoulders"],
    caution_flags: [],
    media_quality_default: "no_media",
  },
  cable_row: {
    key: "cable_row",
    name_pt: "Remada na polia",
    name_en: "Cable Row",
    aliases_pt: ["remada polia", "remada na polia", "remada baixa"],
    aliases_en: ["cable row", "seated cable row", "low row"],
    umbrella: "strength",
    movement_pattern: "horizontal_pull",
    equipment: ["cable", "machine"],
    level: "intermediate",
    primary_muscles: ["back"],
    secondary_muscles: ["biceps", "shoulders"],
    caution_flags: ["low_back_sensitive"],
    media_quality_default: "no_media",
  },
  one_arm_dumbbell_row: {
    key: "one_arm_dumbbell_row",
    name_pt: "Remada unilateral com halter",
    name_en: "One-Arm Dumbbell Row",
    aliases_pt: [
      "remada unilateral",
      "remada unilateral halter",
      "remada serrote",
    ],
    aliases_en: ["one arm db row", "single arm dumbbell row", "one arm dumbbell row"],
    umbrella: "strength",
    movement_pattern: "horizontal_pull",
    equipment: ["dumbbell", "bench"],
    level: "intermediate",
    primary_muscles: ["back"],
    secondary_muscles: ["biceps", "core"],
    caution_flags: ["low_back_sensitive"],
    media_quality_default: "no_media",
  },
  lat_pulldown: {
    key: "lat_pulldown",
    name_pt: "Puxada na polia alta",
    name_en: "Lat Pulldown",
    aliases_pt: ["puxada alta", "puxada polia alta", "lat pulldown"],
    aliases_en: ["lat pulldown", "pulldown"],
    umbrella: "strength",
    movement_pattern: "vertical_pull",
    equipment: ["cable", "machine"],
    level: "beginner",
    primary_muscles: ["back"],
    secondary_muscles: ["biceps", "shoulders"],
    caution_flags: ["shoulder_sensitive"],
    media_quality_default: "no_media",
  },
  band_face_pull: {
    key: "band_face_pull",
    name_pt: "Face pull com banda",
    name_en: "Band Face Pull",
    aliases_pt: ["face pull banda", "face pull com elastico", "face pull"],
    aliases_en: ["band face pull", "face pull"],
    umbrella: "strength",
    movement_pattern: "shoulder_scapular_control",
    equipment: ["band", "cable"],
    level: "beginner",
    primary_muscles: ["shoulders", "back"],
    secondary_muscles: [],
    caution_flags: ["shoulder_sensitive"],
    media_quality_default: "no_media",
  },
  dead_bug: {
    key: "dead_bug",
    name_pt: "Dead bug",
    name_en: "Dead Bug",
    aliases_pt: ["dead bug", "besouro morto"],
    aliases_en: ["dead bug", "deadbug"],
    umbrella: "motor_control",
    movement_pattern: "core_anti_extension",
    equipment: ["bodyweight", "mat"],
    level: "beginner",
    primary_muscles: ["core"],
    secondary_muscles: [],
    caution_flags: [],
    media_quality_default: "no_media",
  },
  plank: {
    key: "plank",
    name_pt: "Prancha",
    name_en: "Plank",
    aliases_pt: ["prancha", "prancha frontal", "prancha isometrica"],
    aliases_en: ["plank", "front plank", "forearm plank"],
    umbrella: "strength",
    movement_pattern: "core_anti_extension",
    equipment: ["bodyweight", "mat"],
    level: "beginner",
    primary_muscles: ["core"],
    secondary_muscles: ["shoulders", "glutes"],
    caution_flags: ["low_back_sensitive", "shoulder_sensitive"],
    media_quality_default: "no_media",
  },
  side_plank: {
    key: "side_plank",
    name_pt: "Prancha lateral",
    name_en: "Side Plank",
    aliases_pt: ["prancha lateral", "side plank"],
    aliases_en: ["side plank"],
    umbrella: "strength",
    movement_pattern: "core_lateral_stability",
    equipment: ["bodyweight", "mat"],
    level: "intermediate",
    primary_muscles: ["core"],
    secondary_muscles: ["shoulders", "glutes"],
    caution_flags: ["shoulder_sensitive"],
    media_quality_default: "no_media",
  },
  pallof_press: {
    key: "pallof_press",
    name_pt: "Pallof press",
    name_en: "Pallof Press",
    aliases_pt: ["pallof", "pallof press", "press pallof"],
    aliases_en: ["pallof press", "anti rotation press"],
    umbrella: "strength",
    movement_pattern: "core_anti_rotation",
    equipment: ["cable", "band"],
    level: "beginner",
    primary_muscles: ["core"],
    secondary_muscles: ["shoulders"],
    caution_flags: [],
    media_quality_default: "no_media",
  },
  bird_dog: {
    key: "bird_dog",
    name_pt: "Bird dog",
    name_en: "Bird Dog",
    aliases_pt: ["bird dog", "cao apontador"],
    aliases_en: ["bird dog", "birddog"],
    umbrella: "motor_control",
    movement_pattern: "core_anti_extension",
    equipment: ["bodyweight", "mat"],
    level: "beginner",
    primary_muscles: ["core", "back"],
    secondary_muscles: ["glutes", "shoulders"],
    caution_flags: [],
    media_quality_default: "no_media",
  },
  calf_raise: {
    key: "calf_raise",
    name_pt: "Elevação de gémeos",
    name_en: "Calf Raise",
    aliases_pt: [
      "elevacao gemeos",
      "elevação de gémeos",
      "elevacao panturrilha",
      "panturrilha em pe",
    ],
    aliases_en: ["calf raise", "standing calf raise", "heel raise"],
    umbrella: "strength",
    movement_pattern: "calf_ankle",
    equipment: ["bodyweight", "dumbbell", "machine"],
    level: "beginner",
    primary_muscles: ["calves"],
    secondary_muscles: [],
    caution_flags: [],
    media_quality_default: "no_media",
  },
  band_lateral_walk: {
    key: "band_lateral_walk",
    name_pt: "Caminhada lateral com banda",
    name_en: "Band Lateral Walk",
    aliases_pt: [
      "caminhada lateral banda",
      "caminhada lateral com elastico",
      "monster walk",
    ],
    aliases_en: ["band lateral walk", "lateral band walk", "monster walk"],
    umbrella: "strength",
    movement_pattern: "hip_abduction",
    equipment: ["band"],
    level: "beginner",
    primary_muscles: ["glutes"],
    secondary_muscles: [],
    caution_flags: [],
    media_quality_default: "no_media",
  },
  clamshell: {
    key: "clamshell",
    name_pt: "Clamshell",
    name_en: "Clamshell",
    aliases_pt: ["clamshell", "concha", "abducao deitado"],
    aliases_en: ["clamshell", "clam"],
    umbrella: "strength",
    movement_pattern: "hip_external_rotation",
    equipment: ["bodyweight", "band", "mat"],
    level: "beginner",
    primary_muscles: ["glutes"],
    secondary_muscles: [],
    caution_flags: [],
    media_quality_default: "no_media",
  },
  hamstring_slider_curl: {
    key: "hamstring_slider_curl",
    name_pt: "Curl de isquiotibiais com sliders",
    name_en: "Hamstring Slider Curl",
    aliases_pt: [
      "slider hamstring",
      "curl isquiotibiais sliders",
      "curl posterior sliders",
    ],
    aliases_en: ["slider hamstring curl", "sliding leg curl", "hamstring slider curl"],
    umbrella: "strength",
    movement_pattern: "knee_flexion",
    equipment: ["sliders", "mat"],
    level: "intermediate",
    primary_muscles: ["hamstrings"],
    secondary_muscles: ["glutes", "core"],
    caution_flags: [],
    media_quality_default: "no_media",
  },
  wall_sit: {
    key: "wall_sit",
    name_pt: "Cadeira na parede",
    name_en: "Wall Sit",
    aliases_pt: ["cadeira na parede", "wall sit", "agachamento isometrico parede"],
    aliases_en: ["wall sit", "wall squat hold"],
    umbrella: "strength",
    movement_pattern: "squat",
    equipment: ["bodyweight"],
    level: "beginner",
    primary_muscles: ["quads"],
    secondary_muscles: ["glutes", "core"],
    caution_flags: ["knee_sensitive"],
    media_quality_default: "no_media",
  },
  farmer_carry: {
    key: "farmer_carry",
    name_pt: "Farmer carry",
    name_en: "Farmer Carry",
    aliases_pt: ["farmer carry", "transporte farmer", "caminhada do fazendeiro"],
    aliases_en: ["farmer carry", "farmer walk", "farmers walk"],
    umbrella: "strength",
    movement_pattern: "carry",
    equipment: ["dumbbell", "kettlebell"],
    level: "beginner",
    primary_muscles: ["core", "back"],
    secondary_muscles: ["shoulders", "glutes"],
    caution_flags: ["grip_limited", "low_back_sensitive"],
    media_quality_default: "no_media",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Canonicalization helpers (pure)
// ─────────────────────────────────────────────────────────────────────────────

/** Lowercase, strip diacritics, normalise punctuation/separators, collapse whitespace. */
export function normalizeExerciseName(input: string): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Build alias index lazily (one-time, deterministic).
let _aliasIndex: Map<string, ExerciseKey> | null = null;
function aliasIndex(): Map<string, ExerciseKey> {
  if (_aliasIndex) return _aliasIndex;
  const m = new Map<string, ExerciseKey>();
  for (const key of EXERCISE_KEYS) {
    const e = EXERCISES[key];
    const candidates = [
      key,
      e.name_pt,
      e.name_en,
      ...e.aliases_pt,
      ...e.aliases_en,
    ];
    for (const c of candidates) {
      const n = normalizeExerciseName(c);
      if (n && !m.has(n)) m.set(n, key);
    }
  }
  _aliasIndex = m;
  return m;
}

export function exerciseKeyFromName(input: string): ExerciseKey | null {
  const n = normalizeExerciseName(input);
  if (!n) return null;
  return aliasIndex().get(n) ?? null;
}

/**
 * Stable identity key for any exercise name. Returns the canonical
 * `ExerciseKey` when known, or `unknown:<normalized>` so downstream
 * grouping/joins never silently merge or drop unknown exercises.
 */
export function exerciseIdentityKey(input: string): string {
  const k = exerciseKeyFromName(input);
  if (k) return k;
  const n = normalizeExerciseName(input);
  return `unknown:${n}`;
}

export function getExerciseTaxonomyEntry(
  input: ExerciseKey | string,
): ExerciseTaxonomyEntry | null {
  if (input in EXERCISES) return EXERCISES[input as ExerciseKey];
  const k = exerciseKeyFromName(input);
  return k ? EXERCISES[k] : null;
}

export function isKnownExercise(input: string): boolean {
  return exerciseKeyFromName(input) !== null;
}

export function getExerciseAliases(
  key: ExerciseKey,
): { pt: readonly string[]; en: readonly string[] } {
  const e = EXERCISES[key];
  return { pt: e.aliases_pt, en: e.aliases_en };
}

export function getExercisePattern(input: string): MovementPattern | null {
  return getExerciseTaxonomyEntry(input)?.movement_pattern ?? null;
}

export function getExerciseCautionFlags(input: string): readonly CautionFlag[] {
  return getExerciseTaxonomyEntry(input)?.caution_flags ?? [];
}

/** Returns the subset of names that don't resolve to a known canonical key. */
export function collectUnknownExerciseNames(
  exerciseNames: readonly string[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of exerciseNames) {
    if (!n) continue;
    if (isKnownExercise(n)) continue;
    const k = normalizeExerciseName(n);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}