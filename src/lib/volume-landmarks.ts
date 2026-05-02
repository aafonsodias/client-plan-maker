/**
 * Volume landmarks (sets/week) per muscle group.
 *
 * Source: Israetel/Helms/Schoenfeld consensus for an *intermediate* trainee.
 * These are diagnostic guides, NOT prescriptions. v1 uses a single profile —
 * personalisation by experience_level / sex / age is a future iteration.
 *
 *  MEV — Minimum Effective Volume (below this, little to no adaptation)
 *  MAV — Maximum Adaptive Volume  (sweet spot for most trainees)
 *  MRV — Maximum Recoverable Volume (above this, recovery breaks down)
 */

export type MuscleGroup =
  | "chest"
  | "back"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "calves"
  | "core";

export type VolumeLandmark = { mev: number; mav: number; mrv: number };

export const VOLUME_LANDMARKS: Record<MuscleGroup, VolumeLandmark> = {
  chest:      { mev: 8,  mav: 14, mrv: 22 },
  back:       { mev: 10, mav: 16, mrv: 25 },
  quads:      { mev: 8,  mav: 14, mrv: 20 },
  hamstrings: { mev: 6,  mav: 12, mrv: 18 },
  glutes:     { mev: 6,  mav: 12, mrv: 18 },
  shoulders:  { mev: 8,  mav: 16, mrv: 26 },
  biceps:     { mev: 6,  mav: 12, mrv: 20 },
  triceps:    { mev: 6,  mav: 12, mrv: 20 },
  calves:     { mev: 6,  mav: 12, mrv: 18 },
  core:       { mev: 0,  mav: 8,  mrv: 16 },
};

export const MUSCLE_GROUP_LABELS_PT: Record<MuscleGroup, string> = {
  chest: "Peito",
  back: "Costas",
  quads: "Quadricípites",
  hamstrings: "Isquiotibiais",
  glutes: "Glúteos",
  shoulders: "Ombros",
  biceps: "Bicípites",
  triceps: "Tricípites",
  calves: "Gémeos",
  core: "Core",
};

/**
 * Aliases — the AI (or trainer) may write a muscle in many ways.
 * Lowercase, no accents. Map to the canonical MuscleGroup.
 */
export const MUSCLE_ALIASES: Record<string, MuscleGroup> = {
  // chest
  chest: "chest", pectoral: "chest", pectorals: "chest", pecs: "chest",
  peito: "chest", peitoral: "chest", peitorais: "chest",

  // back
  back: "back", lats: "back", latissimus: "back", "lat": "back",
  rhomboids: "back", rhomboid: "back", traps: "back", trapezius: "back",
  dorsal: "back", dorsais: "back", costas: "back", "upper back": "back",
  "mid back": "back", "lower back": "back", erectors: "back",
  "erector spinae": "back", lombar: "back", lombares: "back",

  // quads
  quads: "quads", quadriceps: "quads", quadricipite: "quads",
  quadricipites: "quads", quadricep: "quads",

  // hamstrings
  hamstrings: "hamstrings", hams: "hamstrings", hamstring: "hamstrings",
  isquiotibiais: "hamstrings", "isquio-tibiais": "hamstrings",
  posteriores: "hamstrings", femoral: "hamstrings",

  // glutes
  glutes: "glutes", glute: "glutes", gluteus: "glutes",
  gluteals: "glutes", gluteo: "glutes", gluteos: "glutes",
  "gluteo medio": "glutes", glúteos: "glutes",

  // shoulders / delts
  shoulders: "shoulders", shoulder: "shoulders", delts: "shoulders",
  deltoids: "shoulders", deltoid: "shoulders",
  "front delts": "shoulders", "side delts": "shoulders",
  "rear delts": "shoulders", ombros: "shoulders", ombro: "shoulders",
  deltoides: "shoulders",

  // biceps
  biceps: "biceps", bicep: "biceps", brachialis: "biceps",
  bicipite: "biceps", bicipites: "biceps",

  // triceps
  triceps: "triceps", tricep: "triceps", tricipite: "triceps",
  tricipites: "triceps",

  // calves
  calves: "calves", calf: "calves", gastrocnemius: "calves",
  soleus: "calves", gemeos: "calves", "gémeos": "calves",
  panturrilha: "calves",

  // core
  core: "core", abs: "core", abdominals: "core", abdominal: "core",
  obliques: "core", oblique: "core", abdominais: "core",
  abdomen: "core", "abdómen": "core", obliquos: "core",
  "obliquos externos": "core", transverse: "core",
};

/** Normalise a muscle string (case/accents/spaces) and resolve via alias table. */
export function normaliseMuscle(raw: string): MuscleGroup | null {
  if (!raw) return null;
  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .trim();
  if (key in MUSCLE_ALIASES) return MUSCLE_ALIASES[key];
  // try first word (e.g. "chest (upper)" → "chest")
  const first = key.split(/[\s,()/-]+/)[0];
  if (first in MUSCLE_ALIASES) return MUSCLE_ALIASES[first];
  return null;
}

export type VolumeStatus = "under" | "optimal" | "over" | "danger";

export function statusFor(sets: number, lm: VolumeLandmark): VolumeStatus {
  if (sets < lm.mev) return "under";
  if (sets <= lm.mav) return "optimal";
  if (sets <= lm.mrv) return "over";
  return "danger";
}

export const MUSCLE_GROUP_ORDER: MuscleGroup[] = [
  "chest", "shoulders", "triceps", "biceps", "back",
  "core", "glutes", "hamstrings", "quads", "calves",
];