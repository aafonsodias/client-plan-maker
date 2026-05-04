/**
 * Single source of truth for the per-week meso "tag" shown both in the
 * weekly PDF cover (canvas) and the on-screen "This week" hero strip
 * (DOM). Keep these two surfaces in lockstep — the trainer should feel
 * the printed page and the app are one product.
 */
export type WeekTag = "base" | "+load" | "+reps" | "deload";

export function weekTagFor(weekNumber: number, totalWeeks: number): WeekTag {
  if (totalWeeks <= 1) return "base";
  if (weekNumber === totalWeeks) return "deload";
  if (weekNumber === 1) return "base";
  return weekNumber % 2 === 0 ? "+load" : "+reps";
}