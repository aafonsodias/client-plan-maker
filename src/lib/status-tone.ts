/**
 * Single source of truth for semantic status colours.
 *
 * Tone semantics (project-wide rule — do not deviate):
 *   success → emerald   (ready, done, submitted, passed)
 *   neutral → muted     (draft, in-progress, informational)
 *   warn    → amber     (needs attention, expiring, validation issues)
 *   danger  → red       (errors, destructive)
 *
 * Use these helpers instead of writing `bg-amber-500/10` etc. in components.
 */
export type Tone = "success" | "neutral" | "warn" | "danger";

const CHIP: Record<Tone, string> = {
  success:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  neutral: "bg-secondary text-muted-foreground border border-border",
  warn:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  danger:
    "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
};

const DOT: Record<Tone, string> = {
  success: "bg-emerald-500",
  neutral: "bg-muted-foreground/50",
  warn: "bg-amber-500",
  danger: "bg-red-500",
};

const TEXT: Record<Tone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

export const toneChip = (tone: Tone) => CHIP[tone];
export const toneDot = (tone: Tone) => DOT[tone];
export const toneText = (tone: Tone) => TEXT[tone];