/**
 * Helpers to format the `generation_meta.rotation_audit` payload that
 * `stage3-microcycle.functions.ts` writes after generating Block N+1.
 * Pure & client-safe.
 */
export type RotationAudit = {
  firstPct?: number;
  finalPct?: number;
  accessoryCount?: number;
  retried?: boolean;
  daysRegenerated?: number[];
};

export type RotationView = {
  firstPct: number | null;
  finalPct: number | null;
  accessoryCount: number;
  retried: boolean;
  daysRegenerated: number[];
  tone: "good" | "warn" | "bad" | "unknown";
  toneClass: string;
};

export function summarizeRotation(audit: unknown): RotationView | null {
  if (!audit || typeof audit !== "object") return null;
  const a = audit as RotationAudit;
  const finalPct = typeof a.finalPct === "number" ? a.finalPct : null;
  const firstPct = typeof a.firstPct === "number" ? a.firstPct : null;
  if (finalPct == null) return null;
  const tone: RotationView["tone"] =
    finalPct >= 60 ? "good" : finalPct >= 40 ? "warn" : "bad";
  const toneClass =
    tone === "good"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-red-500/40 bg-red-500/10 text-red-200";
  return {
    firstPct,
    finalPct,
    accessoryCount: a.accessoryCount ?? 0,
    retried: !!a.retried,
    daysRegenerated: Array.isArray(a.daysRegenerated) ? a.daysRegenerated : [],
    tone,
    toneClass,
  };
}