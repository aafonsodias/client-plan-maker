/**
 * Single source of truth for RPE color ramp.
 * Keeps the same scale across the mesocycle table, the daily logbook,
 * and the results charts so the eye learns the gradient quickly.
 *
 * Scale: easy → emerald, moderate → lime, hard → amber, very hard → orange,
 * maximal → red. Mirrors the project's status palette
 * (success/warn/danger from src/lib/status-tone.ts).
 */

export function parseRpe(input: unknown): number | null {
  if (input == null) return null;
  const m = String(input).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export type RpeTone = {
  /** background + text classes for a small pill */
  pill: string;
  /** hex for chart fills (Recharts dots / bars) */
  hex: string;
  /** semantic label, useful for aria/title */
  label: string;
};

/** Pure helpers — safe in client + server bundles. */
export function rpeTone(rpe: number | null | undefined): RpeTone {
  if (rpe == null || !Number.isFinite(rpe)) {
    return {
      pill: "bg-muted/30 text-muted-foreground/70 ring-1 ring-inset ring-border/50",
      hex: "#64748b",
      label: "—",
    };
  }
  if (rpe <= 5) {
    return {
      pill: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
      hex: "#10b981",
      label: "easy",
    };
  }
  if (rpe <= 6.5) {
    return {
      pill: "bg-lime-500/15 text-lime-300 ring-1 ring-inset ring-lime-500/30",
      hex: "#84cc16",
      label: "moderate",
    };
  }
  if (rpe <= 7.5) {
    return {
      pill: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
      hex: "#f59e0b",
      label: "hard",
    };
  }
  if (rpe <= 8.5) {
    return {
      pill: "bg-orange-500/20 text-orange-300 ring-1 ring-inset ring-orange-500/40",
      hex: "#f97316",
      label: "very hard",
    };
  }
  if (rpe <= 9.5) {
    return {
      pill: "bg-red-500/20 text-red-300 ring-1 ring-inset ring-red-500/40",
      hex: "#ef4444",
      label: "near max",
    };
  }
  return {
    pill: "bg-red-600/30 text-red-200 ring-1 ring-inset ring-red-600/60 font-semibold",
    hex: "#dc2626",
    label: "max",
  };
}

/** Convenience: format an RPE value to a fixed 1-decimal label. */
export function formatRpe(rpe: number | null | undefined): string {
  if (rpe == null || !Number.isFinite(rpe)) return "—";
  return rpe.toFixed(1);
}