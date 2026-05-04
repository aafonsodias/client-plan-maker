import { ReactNode, useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapses 4 fully-approved phased StageCards into a single discreet strip
 * so the client page focal point is the plan / "this week" — not five
 * identical amber bars of approved history. Click to expand inline.
 */
export function PipelineStrip({
  blockNumber,
  approvedAt,
  children,
  defaultOpen = false,
}: {
  blockNumber?: number | null;
  approvedAt?: string | null;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const dateLabel = approvedAt
    ? new Date(approvedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })
    : null;
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-emerald-500/[0.07]"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <CheckCircle2 key={i} className="h-3.5 w-3.5 text-emerald-400" />
            ))}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Pipeline {blockNumber ? `· Bloco ${blockNumber}` : ""} completo
            </p>
            <p className="text-xs text-muted-foreground">
              Briefing · Plano-mestre · Semana-tipo · Progressão
              {dateLabel ? ` · ${dateLabel}` : ""}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-emerald-500/15 bg-background/40 p-3">
          {children}
        </div>
      )}
    </div>
  );
}