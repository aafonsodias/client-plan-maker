import { useMemo, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Issue = {
  week?: number;
  day?: number;
  severity: "blocker" | "major" | "minor";
  path: string;
  message: string;
  suggested_fix?: string;
};

type ValidationMeta = {
  version?: number;
  total_cost_usd?: number;
  verdict_counts?: Record<string, number>;
  unresolved_issues?: Issue[];
  escalated_days?: number;
  finalized_at?: string;
};

/**
 * Compact, always-visible AI validation report for a generated plan.
 * Reads from workout_plans.generation_meta.validation. Trainer-only.
 */
export function ValidationReport({ generationMeta }: { generationMeta: any }) {
  const [open, setOpen] = useState(false);
  const v: ValidationMeta | null = useMemo(() => {
    if (!generationMeta || typeof generationMeta !== "object") return null;
    return (generationMeta as any).validation ?? null;
  }, [generationMeta]);

  if (!v) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-3.5 w-3.5" />
        Validação automática indisponível para este plano (gerado antes do auditor IA, ou ainda em geração). Carregue em "Re-gerar com feedback" para correr o auditor.
      </div>
    );
  }

  const counts = v.verdict_counts ?? {};
  const passes = counts["pass"] ?? 0;
  const needsRepair = counts["needs_repair"] ?? 0;
  const fails = counts["fail"] ?? 0;
  const skipped = counts["skipped"] ?? 0;
  const totalDays = passes + needsRepair + fails + skipped + (counts["unknown"] ?? 0);
  const issues = v.unresolved_issues ?? [];
  const blockers = issues.filter((i) => i.severity === "blocker").length;
  const majors = issues.filter((i) => i.severity === "major").length;

  // Top-line status.
  let Icon = ShieldCheck;
  let tone: "ok" | "warn" | "error" = "ok";
  let label = "AI-validated";
  if (blockers > 0) {
    Icon = ShieldX;
    tone = "error";
    label = "Needs human review";
  } else if (majors > 0 || needsRepair > 0 || skipped > 0) {
    Icon = ShieldAlert;
    tone = "warn";
    label = "Validated with notes";
  }

  const toneClass =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";

  return (
    <div className={`rounded-lg border ${toneClass}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight">{label}</div>
          <div className="text-xs opacity-80 truncate">
            {totalDays > 0 ? `${passes}/${totalDays} days clean` : "No telemetry yet"}
            {blockers > 0 && ` • ${blockers} blocker${blockers === 1 ? "" : "s"}`}
            {majors > 0 && ` • ${majors} major issue${majors === 1 ? "" : "s"}`}
            {v.escalated_days ? ` • ${v.escalated_days} escalation${v.escalated_days === 1 ? "" : "s"}` : ""}
            {typeof v.total_cost_usd === "number" && v.total_cost_usd > 0
              ? ` • $${v.total_cost_usd.toFixed(3)} AI cost`
              : ""}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {passes > 0 && <Badge variant="outline">{passes} pass</Badge>}
            {needsRepair > 0 && <Badge variant="outline">{needsRepair} repaired</Badge>}
            {fails > 0 && <Badge variant="outline">{fails} failed</Badge>}
            {skipped > 0 && <Badge variant="outline">{skipped} critic skipped</Badge>}
          </div>

          {issues.length === 0 ? (
            <div className="opacity-80">No unresolved issues. Critic gave the all-clear.</div>
          ) : (
            <div className="space-y-2">
              <div className="font-medium">Unresolved issues</div>
              <ul className="space-y-1.5">
                {issues.slice(0, 30).map((i, idx) => (
                  <li key={idx} className="rounded border border-border/50 bg-background/40 p-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge
                        variant="outline"
                        className={
                          i.severity === "blocker"
                            ? "border-red-500/40 text-red-700 dark:text-red-300"
                            : i.severity === "major"
                              ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                              : "border-border"
                        }
                      >
                        {i.severity}
                      </Badge>
                      <span className="font-mono text-[11px] opacity-70 truncate">
                        W{i.week}/D{i.day} · {i.path}
                      </span>
                    </div>
                    <div className="text-foreground/90">{i.message}</div>
                    {i.suggested_fix ? (
                      <div className="mt-1 opacity-80">
                        <span className="opacity-70">Fix:</span> {i.suggested_fix}
                      </div>
                    ) : null}
                  </li>
                ))}
                {issues.length > 30 && (
                  <li className="opacity-70">…and {issues.length - 30} more.</li>
                )}
              </ul>
            </div>
          )}

          {v.finalized_at && (
            <div className="opacity-60">
              Validated {new Date(v.finalized_at).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}