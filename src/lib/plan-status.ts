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
        "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
    };
  }

  if (phasedComplete) {
    return {
      key: "ready",
      label: t ? t("plan_status.ready", "Ready") : "Ready",
      className: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
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