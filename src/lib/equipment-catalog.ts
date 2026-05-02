/**
 * Canonical equipment catalogue used by intake, the assessment editor and the
 * demo seeder. The DB stores the EN label (back-compat with old rows). This
 * file is the single source of truth — never hard-code ad-hoc lists elsewhere.
 *
 * `aliases` contains common synonyms (EN + PT) so the search input matches
 * trainer-side typos and Brazilian Portuguese variants.
 */

export type EquipmentCategory =
  | "free_weights"
  | "machines"
  | "racks_benches"
  | "bodyweight_accessory"
  | "conditioning"
  | "mobility"
  | "misc";

export type EquipmentItem = {
  id: string;
  /** EN label — also the value persisted to assessments.available_equipment. */
  en: string;
  /** PT-PT label. */
  pt: string;
  category: EquipmentCategory;
  aliases?: string[];
};

export const EQUIPMENT_CATALOG: EquipmentItem[] = [
  // Free weights
  { id: "barbell",        en: "Barbell",          pt: "Barra olímpica",       category: "free_weights",       aliases: ["olympic bar", "barra"] },
  { id: "ez_bar",         en: "EZ bar",           pt: "Barra EZ",             category: "free_weights",       aliases: ["curl bar"] },
  { id: "dumbbells",      en: "Dumbbells",        pt: "Halteres",             category: "free_weights",       aliases: ["db", "halter"] },
  { id: "kettlebells",    en: "Kettlebells",      pt: "Kettlebells",          category: "free_weights",       aliases: ["kb"] },
  { id: "weight_plates",  en: "Weight plates",    pt: "Discos",               category: "free_weights",       aliases: ["discs", "discos olímpicos"] },
  { id: "hex_bar",        en: "Hex bar",          pt: "Barra hexagonal",      category: "free_weights",       aliases: ["trap bar"] },
  { id: "safety_bar",     en: "Safety squat bar", pt: "Safety bar",           category: "free_weights" },

  // Machines
  { id: "cable_machine",  en: "Cable machine",    pt: "Máquina de cabos",     category: "machines",           aliases: ["polia", "cable"] },
  { id: "smith_machine",  en: "Smith machine",    pt: "Multipower",           category: "machines",           aliases: ["smith"] },
  { id: "leg_press",      en: "Leg press",        pt: "Prensa de pernas",     category: "machines" },
  { id: "hack_squat",     en: "Hack squat",       pt: "Hack squat",           category: "machines" },
  { id: "leg_curl",       en: "Leg curl",         pt: "Mesa flexora",         category: "machines" },
  { id: "leg_extension",  en: "Leg extension",    pt: "Extensora",            category: "machines" },
  { id: "lat_pulldown",   en: "Lat pulldown",     pt: "Puxada alta",          category: "machines",           aliases: ["pulldown"] },
  { id: "seated_row",     en: "Seated row",       pt: "Remada sentada",       category: "machines" },
  { id: "chest_press",    en: "Chest press",      pt: "Supino máquina",       category: "machines" },
  { id: "pec_deck",       en: "Pec deck",         pt: "Voador",               category: "machines",           aliases: ["butterfly", "crucifixo"] },
  { id: "calf_raise",     en: "Calf raise machine", pt: "Máquina de gémeos",  category: "machines" },

  // Racks & benches
  { id: "squat_rack",     en: "Squat rack",       pt: "Rack de agachamento",  category: "racks_benches" },
  { id: "power_rack",     en: "Power rack",       pt: "Power rack",           category: "racks_benches" },
  { id: "bench",          en: "Bench",            pt: "Banco",                category: "racks_benches",      aliases: ["banco plano"] },
  { id: "incline_bench",  en: "Incline bench",    pt: "Banco inclinado",      category: "racks_benches" },
  { id: "decline_bench",  en: "Decline bench",    pt: "Banco declinado",      category: "racks_benches" },
  { id: "ghd",            en: "GHD",              pt: "GHD",                  category: "racks_benches",      aliases: ["glute ham"] },

  // Bodyweight & accessory
  { id: "pull_up_bar",    en: "Pull-up bar",      pt: "Barra de tração",      category: "bodyweight_accessory", aliases: ["chin-up bar"] },
  { id: "dip_station",    en: "Dip station",      pt: "Paralelas",            category: "bodyweight_accessory" },
  { id: "rings",          en: "Gymnastics rings", pt: "Argolas",              category: "bodyweight_accessory" },
  { id: "trx",            en: "TRX",              pt: "TRX",                  category: "bodyweight_accessory", aliases: ["suspension trainer"] },
  { id: "ab_wheel",       en: "Ab wheel",         pt: "Roda abdominal",       category: "bodyweight_accessory" },
  { id: "parallettes",    en: "Parallettes",      pt: "Parallettes",          category: "bodyweight_accessory" },

  // Conditioning
  { id: "rower",          en: "Rower",            pt: "Remo ergómetro",       category: "conditioning",       aliases: ["concept2", "remo"] },
  { id: "ski_erg",        en: "Ski erg",          pt: "Ski erg",              category: "conditioning" },
  { id: "assault_bike",   en: "Assault bike",     pt: "Assault bike",         category: "conditioning",       aliases: ["air bike", "echo bike"] },
  { id: "treadmill",      en: "Treadmill",        pt: "Passadeira",           category: "conditioning" },
  { id: "stationary_bike",en: "Stationary bike",  pt: "Bicicleta estática",   category: "conditioning",       aliases: ["spin bike"] },
  { id: "jump_rope",      en: "Jump rope",        pt: "Corda de saltar",      category: "conditioning" },
  { id: "sled",           en: "Sled",             pt: "Trenó",                category: "conditioning" },

  // Mobility / accessory loading
  { id: "bands",          en: "Bands",            pt: "Bandas elásticas",     category: "mobility",           aliases: ["resistance bands", "elásticos"] },
  { id: "foam_roller",    en: "Foam roller",      pt: "Rolo de espuma",       category: "mobility" },
  { id: "lacrosse_ball",  en: "Lacrosse ball",    pt: "Bola de lacrosse",     category: "mobility" },
  { id: "med_ball",       en: "Medicine ball",    pt: "Medicine ball",        category: "mobility" },
  { id: "slam_ball",      en: "Slam ball",        pt: "Slam ball",            category: "mobility" },

  // Misc
  { id: "bodyweight",     en: "Bodyweight only",  pt: "Apenas peso corporal", category: "misc",               aliases: ["bw"] },
];

export const CATEGORY_LABEL_PT: Record<EquipmentCategory, string> = {
  free_weights: "Pesos livres",
  machines: "Máquinas",
  racks_benches: "Racks e bancos",
  bodyweight_accessory: "Peso corporal e acessórios",
  conditioning: "Cardio / condicionamento",
  mobility: "Mobilidade",
  misc: "Outros",
};

export const CATEGORY_LABEL_EN: Record<EquipmentCategory, string> = {
  free_weights: "Free weights",
  machines: "Machines",
  racks_benches: "Racks & benches",
  bodyweight_accessory: "Bodyweight & accessory",
  conditioning: "Conditioning",
  mobility: "Mobility",
  misc: "Other",
};

const BY_CANONICAL: Map<string, EquipmentItem> = new Map(
  EQUIPMENT_CATALOG.map((i) => [i.en, i]),
);
const BY_ID: Map<string, EquipmentItem> = new Map(
  EQUIPMENT_CATALOG.map((i) => [i.id, i]),
);

/** Look up by EN canonical (the value stored in DB) or by stable id. */
export function findEquipment(value: string): EquipmentItem | undefined {
  return BY_CANONICAL.get(value) ?? BY_ID.get(value);
}

/** Display the right locale label, falling back to the raw value if unknown. */
export function equipmentLabel(value: string, locale: "pt" | "en" = "pt"): string {
  const item = findEquipment(value);
  if (!item) return value;
  return locale === "pt" ? item.pt : item.en;
}

/** Case-insensitive haystack search across en, pt and aliases. */
export function searchEquipment(query: string): EquipmentItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return EQUIPMENT_CATALOG;
  return EQUIPMENT_CATALOG.filter((i) => {
    const hay = [i.en, i.pt, ...(i.aliases ?? [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
}