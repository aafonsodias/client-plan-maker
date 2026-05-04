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
  expanded,
  onToggleExpanded,
  expandedBody,
  hideHeaderApprove = false,
  progressLabel,
  tone = "stage",
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
  /** Controlled expansion for inline editor body (overrides internal state when provided). */
  expanded?: boolean;
  onToggleExpanded?: (next: boolean) => void;
  /** Rendered inside the same card when expanded (replaces the helper text). */
  expandedBody?: ReactNode;
  /** Hide the header-level approve button (use a CTA at the bottom of expandedBody instead). */
  hideHeaderApprove?: boolean;
  /** When set with busy=true, shows an inline progress strip instead of the white spinner box. */
  progressLabel?: string;
  /** Visual identity of the approved-collapsed strip. "brief" stays amber (the
   *  source of truth that AI stages descend from); "stage" goes emerald to
   *  signal "AI-generated, human-approved" — matches the post-assessment chip. */
  tone?: "brief" | "stage";
}) {
  const [openInternal, setOpenInternal] = useState(!defaultCollapsed && status !== "approved");
  const open = expanded ?? openInternal;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => {
    const next = typeof v === "function" ? (v as (o: boolean) => boolean)(open) : v;
    if (onToggleExpanded) onToggleExpanded(next);
    else setOpenInternal(next);
  };

  // Approved & collapsed: thin strip
  if (status === "approved" && !open) {
    const isBrief = tone === "brief";
    const stripClass = isBrief
      ? "border-accent/40 bg-accent/5 hover:bg-accent/10"
      : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10";
    const labelClass = isBrief ? "" : "text-emerald-500";
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${stripClass}`}
      >
        <span className={`flex items-center gap-2 font-semibold ${labelClass}`}>
          {isBrief ? (
            <Check className="h-4 w-4 text-accent" />
          ) : (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          )}
          {isBrief
            ? `Stage ${stageNumber} — ${title} approved`
            : `${title.toLowerCase()} · approved`}
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
      <div className="overflow-hidden rounded-xl border border-amber-500/40 bg-card shadow-sm">
        <div className="h-0.5 w-full overflow-hidden bg-amber-500/10">
          <div className="h-full w-1/3 animate-[progress_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
        </div>
        <div className="flex items-center gap-3 px-4 py-5 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
          <span className="font-medium">
            Stage {stageNumber} — {progressLabel ?? `Generating ${title.toLowerCase()}…`}
          </span>
        </div>
      </div>
    );
  }

  // ready or approved+open
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {busy && (
        <div className="h-0.5 w-full overflow-hidden bg-amber-500/10">
          <div className="h-full w-1/3 animate-[progress_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
        </div>
      )}
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
            {onApprove && status !== "approved" && !hideHeaderApprove && (
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
      {open && (
        <div className="p-4">
          {expandedBody ?? children}
        </div>
      )}
    </div>
  );
}