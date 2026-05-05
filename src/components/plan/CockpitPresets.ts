import type { ProgrammingVariables } from "@/server/phased/schemas";

/**
 * R64 — Intensity Cockpit presets.
 * Each preset sets a coherent combination of the 5 cockpit knobs.
 * "custom" is implicit (any manual tweak switches to custom).
 */
export type CockpitPreset = NonNullable<ProgrammingVariables["cockpit_preset"]>;

export type CockpitKnobs = Pick<
  ProgrammingVariables,
  | "wave_model"
  | "rpe_ceiling"
  | "intensity_volume_tradeoff"
  | "deload_frequency"
  | "autoreg_strictness"
>;

export const COCKPIT_PRESETS: Record<Exclude<CockpitPreset, "custom">, CockpitKnobs> = {
  hypertrophy_classic: {
    wave_model: "undulating",
    rpe_ceiling: 9.0,
    intensity_volume_tradeoff: "moderate_int_high_vol",
    deload_frequency: "every_4_weeks",
    autoreg_strictness: "suggested",
  },
  strength_base: {
    wave_model: "linear",
    rpe_ceiling: 9.5,
    intensity_volume_tradeoff: "high_int_low_vol",
    deload_frequency: "every_4_weeks",
    autoreg_strictness: "strict",
  },
  moderate_recomp: {
    wave_model: "undulating",
    rpe_ceiling: 8.5,
    intensity_volume_tradeoff: "moderate_moderate",
    deload_frequency: "every_5_weeks",
    autoreg_strictness: "suggested",
  },
  high_volume: {
    wave_model: "block",
    rpe_ceiling: 8.5,
    intensity_volume_tradeoff: "low_int_very_high_vol",
    deload_frequency: "every_3_weeks",
    autoreg_strictness: "suggested",
  },
  conservative: {
    wave_model: "linear",
    rpe_ceiling: 8.0,
    intensity_volume_tradeoff: "moderate_moderate",
    deload_frequency: "every_3_weeks",
    autoreg_strictness: "strict",
  },
};

export const COCKPIT_PRESET_LABELS: Record<CockpitPreset, string> = {
  custom: "Personalizado",
  hypertrophy_classic: "Hipertrofia clássica",
  strength_base: "Força base",
  moderate_recomp: "Recomp moderado",
  high_volume: "Volume alto",
  conservative: "Conservador",
};

/** True if the current pv matches the preset (within tolerance). */
export function matchesPreset(pv: ProgrammingVariables, preset: Exclude<CockpitPreset, "custom">): boolean {
  const target = COCKPIT_PRESETS[preset];
  return (
    pv.wave_model === target.wave_model &&
    Math.abs(pv.rpe_ceiling - target.rpe_ceiling) < 0.01 &&
    pv.intensity_volume_tradeoff === target.intensity_volume_tradeoff &&
    pv.deload_frequency === target.deload_frequency &&
    pv.autoreg_strictness === target.autoreg_strictness
  );
}