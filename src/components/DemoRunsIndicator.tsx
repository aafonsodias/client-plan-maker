import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Beaker, Loader2, Square, Check, X } from "lucide-react";
import { useDemoRuns, DEMO_RUN_STAGES } from "@/contexts/DemoRunsContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

/**
 * Floating indicator for in-flight demo runs. Mounted globally so it
 * follows the user across navigations. Click to expand per-run progress.
 */
export function DemoRunsIndicator() {
  const { runs, cancelRun, holdRuns } = useDemoRuns();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("common");

  // Hold completed runs visible while the popover is open so they don't
  // pop out from under the user's cursor mid-read.
  const setOpenAndHold = (next: boolean) => {
    holdRuns(next);
    setOpen(next);
  };

  if (runs.length === 0) return null;

  const active = runs.filter((r) => r.status !== "done" && r.status !== "failed" && !r.cancelled);
  const head = active[0] ?? runs[runs.length - 1];
  const stageLabel = DEMO_RUN_STAGES.find((s) => s.key === head.stage)?.label ?? head.stage;
  const isFailed = head.status === "failed";
  const isDone = head.status === "done" && head.stage === "done";

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Popover open={open} onOpenChange={setOpenAndHold}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs shadow-lg backdrop-blur transition-colors ${
              isFailed
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : isDone
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
            }`}
          >
            {isFailed ? (
              <X className="h-3.5 w-3.5" />
            ) : isDone ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            <span className="font-medium">{t("demo.jobs.title")}</span>
            <span className="text-muted-foreground/90">·</span>
            <span>{stageLabel}</span>
            {runs.length > 1 ? (
              <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px]">
                ×{runs.length}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-80 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-widest text-amber-500/90">
            <Beaker className="mr-1 inline h-3 w-3" /> {t("demo.jobs.title")}
          </p>
          <div className="space-y-3">
            {runs.map((r) => {
              const stageIdx = DEMO_RUN_STAGES.findIndex((s) => s.key === r.stage);
              return (
                <div key={r.runId} className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{r.durationWeeks} semanas</span>
                    {r.status !== "done" && r.status !== "failed" && !r.cancelled ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px] text-amber-300 hover:text-amber-200"
                        onClick={() => void cancelRun(r.runId)}
                      >
                        <Square className="mr-1 h-3 w-3" /> Parar
                      </Button>
                    ) : null}
                  </div>
                  <ol className="mt-2 space-y-1 text-[11px]">
                    {DEMO_RUN_STAGES.map((g, i) => {
                      const status =
                        r.status === "failed" && i === stageIdx
                          ? "failed"
                          : i < stageIdx
                          ? "done"
                          : i === stageIdx
                          ? r.status === "done"
                            ? "done"
                            : "running"
                          : "idle";
                      const tone =
                        status === "done"
                          ? "text-emerald-400"
                          : status === "failed"
                          ? "text-red-400"
                          : status === "running"
                          ? "text-amber-300"
                          : "text-muted-foreground/60";
                      const Icon =
                        status === "done"
                          ? Check
                          : status === "failed"
                          ? X
                          : status === "running"
                          ? Loader2
                          : null;
                      return (
                        <li key={g.key} className={`flex items-center gap-2 ${tone}`}>
                          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current/40">
                            {Icon ? (
                              <Icon className={`h-2.5 w-2.5 ${status === "running" ? "animate-spin" : ""}`} />
                            ) : null}
                          </span>
                          <span>{g.label}</span>
                        </li>
                      );
                    })}
                  </ol>
                  {r.error ? (
                    <p className="mt-2 text-[11px] text-red-400">{r.error}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}