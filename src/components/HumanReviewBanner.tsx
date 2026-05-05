import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Round 63 — "Needs human review" deserves its own surface.
 *
 * Renders an amber banner ABOVE the plan header when the AI auditor flagged
 * blockers or unresolved majors. Reads from workout_plans.generation_meta.validation.
 * Discreet (single line on mobile), never red — these are notes for the trainer,
 * not a system error.
 */
export function HumanReviewBanner({ generationMeta }: { generationMeta: any }) {
  const v = useMemo(() => {
    if (!generationMeta || typeof generationMeta !== "object") return null;
    return (generationMeta as any).validation ?? null;
  }, [generationMeta]);

  if (!v) return null;
  const counts = (v.verdict_counts ?? {}) as Record<string, number>;
  const issues = (v.unresolved_issues ?? []) as Array<{
    week?: number;
    day?: number;
    severity: "blocker" | "major" | "minor";
    message: string;
  }>;
  const blockers = issues.filter((i) => i.severity === "blocker").length;
  const majors = issues.filter((i) => i.severity === "major").length;
  const needsRepair = counts["needs_repair"] ?? 0;
  if (blockers === 0 && majors === 0 && needsRepair === 0) return null;

  const dayList = Array.from(
    new Set(
      issues
        .filter((i) => i.severity !== "minor")
        .map((i) => (i.week && i.day ? `S${i.week}·D${i.day}` : null))
        .filter(Boolean) as string[],
    ),
  ).slice(0, 6);

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 px-3 py-2 sm:px-4 sm:py-3 flex items-start gap-3"
    >
      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 text-sm leading-snug">
        <div className="font-medium">Precisa de revisão humana</div>
        <div className="text-xs opacity-90">
          {blockers > 0 && `${blockers} bloqueador${blockers === 1 ? "" : "es"}`}
          {blockers > 0 && (majors > 0 || needsRepair > 0) ? " · " : ""}
          {majors > 0 && `${majors} ponto${majors === 1 ? "" : "s"} importante${majors === 1 ? "" : "s"}`}
          {majors > 0 && needsRepair > 0 ? " · " : ""}
          {needsRepair > 0 && `${needsRepair} dia${needsRepair === 1 ? "" : "s"} reparado${needsRepair === 1 ? "" : "s"}`}
          {dayList.length > 0 && (
            <span className="ml-1 opacity-75">({dayList.join(", ")})</span>
          )}
        </div>
      </div>
    </div>
  );
}