// AHA 2017 blood pressure categories. Used to drive risk stratification UI.

export type BpCategory =
  | "normal"
  | "elevated"
  | "stage1"
  | "stage2"
  | "crisis";

export function categorizeBp(
  sbp: number | null | undefined,
  dbp: number | null | undefined,
): BpCategory | null {
  if (sbp == null || dbp == null) return null;
  if (!Number.isFinite(sbp) || !Number.isFinite(dbp)) return null;
  if (sbp > 180 || dbp > 120) return "crisis";
  if (sbp >= 140 || dbp >= 90) return "stage2";
  if (sbp >= 130 || dbp >= 80) return "stage1";
  if (sbp >= 120 && dbp < 80) return "elevated";
  return "normal";
}

export const BP_CATEGORY_LABELS_PT: Record<BpCategory, string> = {
  normal: "Normal",
  elevated: "Elevada",
  stage1: "Hipertensão · Estágio 1",
  stage2: "Hipertensão · Estágio 2",
  crisis: "Crise hipertensiva",
};

export const BP_CATEGORY_TONE: Record<BpCategory, string> = {
  normal: "bg-accent/15 text-accent",
  elevated: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  stage1: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  stage2: "bg-destructive/15 text-destructive",
  crisis: "bg-destructive text-destructive-foreground animate-pulse",
};