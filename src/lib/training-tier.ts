// Training experience tiers — categorical "faixas" replacing the raw years number.
// Founder feedback May-2026: people can't honestly self-rate "intermediate" but
// they can answer "1–3 years". The tier is also surfaced subtly on the client
// card (small coloured dot) so the trainer reads experience at a glance.

export type TrainingTier = "none" | "seedling" | "base" | "intermediate" | "advanced" | "veteran";

export interface TierMeta {
  id: TrainingTier;
  /** i18n key suffix under assessment.tier.* */
  key: string;
  /** Inclusive lower bound in years; null for "no training". */
  min: number | null;
  /** Inclusive upper bound; null = open-ended. */
  max: number | null;
  /** Background+text class for chip. */
  chipClass: string;
  /** Solid dot class for compact surfaces. */
  dotClass: string;
  /** Ring colour for selected state. */
  ringClass: string;
}

export const TRAINING_TIERS: TierMeta[] = [
  {
    id: "none",
    key: "none",
    min: null,
    max: null,
    chipClass: "bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground/40",
    ringClass: "ring-muted-foreground/40",
  },
  {
    id: "seedling",
    key: "seedling",
    min: 0,
    max: 1,
    chipClass: "bg-slate-200/60 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200",
    dotClass: "bg-slate-300 dark:bg-slate-400",
    ringClass: "ring-slate-400",
  },
  {
    id: "base",
    key: "base",
    min: 1,
    max: 3,
    chipClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    dotClass: "bg-sky-500",
    ringClass: "ring-sky-500",
  },
  {
    id: "intermediate",
    key: "intermediate",
    min: 3,
    max: 6,
    chipClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    dotClass: "bg-violet-500",
    ringClass: "ring-violet-500",
  },
  {
    id: "advanced",
    key: "advanced",
    min: 6,
    max: 10,
    chipClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    dotClass: "bg-orange-500",
    ringClass: "ring-orange-500",
  },
  {
    id: "veteran",
    key: "veteran",
    min: 10,
    max: null,
    chipClass: "bg-red-500/15 text-red-700 dark:text-red-300",
    dotClass: "bg-red-500",
    ringClass: "ring-red-500",
  },
];

export function getTierFromYears(years: number | null | undefined): TierMeta {
  if (years == null || Number.isNaN(years)) return TRAINING_TIERS[0];
  if (years <= 0) return TRAINING_TIERS[1]; // seedling
  for (const tier of TRAINING_TIERS) {
    if (tier.min == null) continue;
    const upper = tier.max ?? Infinity;
    if (years >= tier.min && years < upper) return tier;
  }
  return TRAINING_TIERS[TRAINING_TIERS.length - 1];
}

/** Median years of a tier — used when the chip is selected and we need to
 * persist a single number into the existing years_training field. */
export function tierToYears(tier: TrainingTier): number | null {
  const meta = TRAINING_TIERS.find((t) => t.id === tier);
  if (!meta || meta.min == null) return null;
  if (meta.max == null) return meta.min + 2; // veteran → 12
  return Number(((meta.min + meta.max) / 2).toFixed(1));
}
