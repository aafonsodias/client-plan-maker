import type { TFunction } from "i18next";

export type PlanStatusInfo = {
  /** Stable key: "draft" | "ready" | "finalized" | string for phased stages */
  key: string;
  /** Pre-localised label for direct rendering */
  label: string;
  /** Tailwind classes for chip background/text */
  className: string;
};

type PlanLike = {
  status?: string | null;
  generation_state?: { stage?: string } | null;
  generation_status?: string | null;
};

/**
 * Returns a unified status descriptor for any plan (legacy + phased).
 * Phased plans whose `generation_state.stage` is one of brief/blueprint/microcycle/progressions
 * are rendered as a stage chip. `complete` is rendered as READY (or FINALIZED if user finalised).
 */
export function planStatusInfo(p: PlanLike, t?: TFunction): PlanStatusInfo {
  const stage = (p.generation_state as any)?.stage as string | undefined;
  const phasedStages = ["brief", "blueprint", "microcycle", "progressions"];

  // Mid-phased generation
  if (stage && phasedStages.includes(stage)) {
    return {
      key: stage,
      label: t ? t(`plan_status.stage_${stage}`, stageFallback(stage)) : stageFallback(stage),
      className:
        "bg-secondary text-muted-foreground border border-border",
    };
  }

  const phasedComplete = stage === "complete" || p.generation_status === "complete";
  const status = (p.status ?? "draft").toLowerCase();

  if (status === "finalized") {
    return {
      key: "finalized",
      label: t ? t("plan_status.finalized", "Finalised") : "Finalised",
      className:
        "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
    };
  }

  if (phasedComplete) {
    return {
      key: "ready",
      label: t ? t("plan_status.ready", "Ready") : "Ready",
      className: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
    };
  }

  return {
    key: "draft",
    label: t ? t("plan_status.draft", "Draft") : "Draft",
    className: "bg-secondary text-muted-foreground border border-border",
  };
}

function stageFallback(stage: string): string {
  switch (stage) {
    case "brief":
      return "Brief";
    case "blueprint":
      return "Blueprint";
    case "microcycle":
      return "Microcycle";
    case "progressions":
      return "Progressions";
    default:
      return stage;
  }
}

/**
 * Returns true when the trainer has logged at least
 * `duration_weeks × sessions_per_week` sessions for the plan — i.e. every
 * prescribed slot has a record. Used to surface the "Bloco concluído na
 * totalidade" CTA so the next block becomes the obvious next move.
 */
export function isPlanFullyLogged(
  plan: { duration_weeks?: number | null; brief?: any | null } | null | undefined,
  sessionsCount: number,
): boolean {
  if (!plan) return false;
  const weeks = plan.duration_weeks ?? 0;
  const perWeek =
    (plan as any)?.brief?.sessions_per_week?.recommended ??
    (plan as any)?.brief?.sessions_per_week ??
    0;
  const target = Number(weeks) * Number(perWeek);
  if (!Number.isFinite(target) || target <= 0) return false;
  return sessionsCount >= target;
}

/**
 * Client-safe leak detector. Mirror of the server-side helper in
 * `phased/summary.server.ts` — duplicated intentionally so the route file
 * (client bundle) can decide whether to surface the "Re-gerar resumo"
 * button without importing a *.server.ts module.
 */
const SUMMARY_LEAK_MARKERS = [
  "sem análises por secção",
  "notes_for_next_stage",
  "stage hint",
  "internal note",
  "tbd",
  "lorem ipsum",
];

export function summaryLooksLeaked(summary: string | null | undefined): boolean {
  const s = (summary ?? "").toString().trim().toLowerCase();
  if (!s) return true;
  return SUMMARY_LEAK_MARKERS.some((m) => s.includes(m));
}