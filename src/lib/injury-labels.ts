/**
 * Round F1 — curated catalog of common injury/pain labels.
 * `affects_zones` is empty → label is generic and shown for every body zone.
 * `name_key` and `note_key` resolve via i18n (`injuries.lbl.*`, `injuries.note.*`).
 */
export interface InjuryLabel {
  id: string;
  name_key: string;
  affects_zones: string[];
  note_key: string;
}

export const INJURY_LABELS: InjuryLabel[] = [
  // Shoulder
  { id: "rotator_cuff",         name_key: "injuries.lbl.rotator_cuff",         affects_zones: ["shoulder_left","shoulder_right","shoulder_back_left","shoulder_back_right"], note_key: "injuries.note.rotator_cuff" },
  { id: "shoulder_impingement", name_key: "injuries.lbl.shoulder_impingement", affects_zones: ["shoulder_left","shoulder_right","shoulder_back_left","shoulder_back_right"], note_key: "injuries.note.shoulder_impingement" },
  { id: "frozen_shoulder",      name_key: "injuries.lbl.frozen_shoulder",      affects_zones: ["shoulder_left","shoulder_right","shoulder_back_left","shoulder_back_right"], note_key: "injuries.note.frozen_shoulder" },
  // Elbow / forearm
  { id: "tennis_elbow",         name_key: "injuries.lbl.tennis_elbow",         affects_zones: ["forearm_left","forearm_right"], note_key: "injuries.note.tennis_elbow" },
  { id: "golfer_elbow",         name_key: "injuries.lbl.golfer_elbow",         affects_zones: ["forearm_left","forearm_right"], note_key: "injuries.note.golfer_elbow" },
  // Wrist / hand
  { id: "carpal_tunnel",        name_key: "injuries.lbl.carpal_tunnel",        affects_zones: ["hand_left","hand_right"], note_key: "injuries.note.carpal_tunnel" },
  // Lower back / spine
  { id: "lumbar_disc",          name_key: "injuries.lbl.lumbar_disc",          affects_zones: ["lumbar"], note_key: "injuries.note.lumbar_disc" },
  { id: "sciatica",             name_key: "injuries.lbl.sciatica",             affects_zones: ["lumbar","glute_left","glute_right","hamstring_left","hamstring_right"], note_key: "injuries.note.sciatica" },
  { id: "scoliosis",            name_key: "injuries.lbl.scoliosis",            affects_zones: ["upper_back","lumbar"], note_key: "injuries.note.scoliosis" },
  // Hip
  { id: "hip_impingement",      name_key: "injuries.lbl.hip_impingement",      affects_zones: ["hip_left","hip_right"], note_key: "injuries.note.hip_impingement" },
  { id: "hip_bursitis",         name_key: "injuries.lbl.hip_bursitis",         affects_zones: ["hip_left","hip_right"], note_key: "injuries.note.hip_bursitis" },
  // Knee
  { id: "patellar_tendinopathy",name_key: "injuries.lbl.patellar_tendinopathy",affects_zones: ["knee_left","knee_right"], note_key: "injuries.note.patellar_tendinopathy" },
  { id: "meniscus_tear",        name_key: "injuries.lbl.meniscus_tear",        affects_zones: ["knee_left","knee_right"], note_key: "injuries.note.meniscus_tear" },
  { id: "acl_tear",             name_key: "injuries.lbl.acl_tear",             affects_zones: ["knee_left","knee_right"], note_key: "injuries.note.acl_tear" },
  { id: "it_band",              name_key: "injuries.lbl.it_band",              affects_zones: ["knee_left","knee_right","thigh_front_left","thigh_front_right"], note_key: "injuries.note.it_band" },
  // Ankle / foot
  { id: "ankle_sprain",         name_key: "injuries.lbl.ankle_sprain",         affects_zones: ["foot_left","foot_right","foot_back_left","foot_back_right"], note_key: "injuries.note.ankle_sprain" },
  { id: "achilles_tendinopathy",name_key: "injuries.lbl.achilles_tendinopathy",affects_zones: ["achilles_left","achilles_right"], note_key: "injuries.note.achilles_tendinopathy" },
  { id: "plantar_fasciitis",    name_key: "injuries.lbl.plantar_fasciitis",    affects_zones: ["foot_left","foot_right","foot_back_left","foot_back_right"], note_key: "injuries.note.plantar_fasciitis" },
  // Generic — always shown
  { id: "muscle_strain",        name_key: "injuries.lbl.muscle_strain",        affects_zones: [], note_key: "injuries.note.muscle_strain" },
  { id: "tendinopathy_generic", name_key: "injuries.lbl.tendinopathy_generic", affects_zones: [], note_key: "injuries.note.tendinopathy_generic" },
  { id: "unknown",              name_key: "injuries.lbl.unknown",              affects_zones: [], note_key: "injuries.note.unknown" },
];

export function suggestLabelsForZone(zoneId: string): InjuryLabel[] {
  return INJURY_LABELS.filter((lbl) => lbl.affects_zones.length === 0 || lbl.affects_zones.includes(zoneId));
}

export function findLabel(id: string | null | undefined): InjuryLabel | undefined {
  if (!id) return undefined;
  return INJURY_LABELS.find((l) => l.id === id);
}