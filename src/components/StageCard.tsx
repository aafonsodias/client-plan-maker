import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Loader2, Check, RefreshCw, ArrowRight } from "lucide-react";

export type StageCardStatus = "placeholder" | "generating" | "ready" | "approved";

export default function StageCard({
  stageNumber,
  title,
  status,
  children,
  onApprove,
  onRegenerate,
  busy = false,
  defaultCollapsed = false,
  approveLabel = "Approve",
}: {
  stageNumber: number;
  title: string;
  status: StageCardStatus;
  children?: ReactNode;
  onApprove?: () => void | Promise<void>;
  onRegenerate?: () => void | Promise<void>;
  busy?: boolean;
  defaultCollapsed?: boolean;
  approveLabel?: string;
}) {
  const [open, setOpen] = useState(!defaultCollapsed && status !== "approved");

  // Approved & collapsed: thin strip
  if (status === "approved" && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-left text-sm transition hover:bg-accent/10"
      >
        <span className="flex items-center gap-2 font-semibold">
          <Check className="h-4 w-4 text-accent" />
          Stage {stageNumber} — {title} approved
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  if (status === "placeholder") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
        <div className="font-semibold uppercase tracking-wide text-xs text-muted-foreground/70">
          Stage {stageNumber} — {title}
        </div>
        <div className="mt-1 text-xs">Will appear here once the previous stage is approved.</div>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-5 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="font-medium">Stage {stageNumber} — Generating {title.toLowerCase()}…</span>
      </div>
    );
  }

  // ready or approved+open
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">
            Stage {stageNumber} — {title}
          </span>
          {status === "approved" && <Check className="h-4 w-4 text-accent" />}
        </button>
        {open && (
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                type="button"
                onClick={() => void onRegenerate()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Regenerate
              </button>
            )}
            {onApprove && status !== "approved" && (
              <button
                type="button"
                onClick={() => void onApprove()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                {approveLabel}
              </button>
            )}
          </div>
        )}
      </div>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}