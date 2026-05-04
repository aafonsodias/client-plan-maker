import { useEffect, useRef, useState, type ReactNode } from "react";
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
  loadingSteps,
  loadingEta,
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
  /** Honest, rotating copy lines describing what the AI is doing right now. */
  loadingSteps?: string[];
  /** Auxiliary line under the rotating step (e.g. "~30s. Keep page open."). */
  loadingEta?: string;
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

  // Rotating copy for the generating panel + scroll-into-view when it kicks in.
  const [stepIdx, setStepIdx] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (status !== "generating") return;
    setStepIdx(0);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!loadingSteps || loadingSteps.length <= 1) return;
    const id = window.setInterval(() => {
      setStepIdx((i) => (i + 1) % loadingSteps.length);
    }, 1700);
    return () => window.clearInterval(id);
  }, [status, loadingSteps]);

  // Approved & collapsed: thin strip
  if (status === "approved" && !open) {
    // Approved = golden across the journey. Emerald is reserved for the
    // final shipped plan (Stage 5 / PDF), not for intermediate stages.
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-amber-500/5 px-4 py-3 text-left text-sm transition hover:from-amber-500/15 hover:to-amber-500/10"
      >
        <span className="flex items-center gap-2 font-semibold text-amber-500">
          <Check className="h-4 w-4" />
          {`Stage ${stageNumber} — ${title} approved`}
        </span>
        <ChevronRight className="h-4 w-4 text-amber-500/70" />
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
    const currentStep =
      loadingSteps && loadingSteps.length > 0
        ? loadingSteps[stepIdx % loadingSteps.length]
        : (progressLabel ?? `Generating ${title.toLowerCase()}…`);
    return (
      <div
        ref={cardRef}
        className="overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-500/[0.06] to-transparent shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_8px_32px_-12px_rgba(245,158,11,0.25)]"
      >
        <div className="h-1.5 w-full overflow-hidden bg-amber-500/10">
          <div className="h-full w-1/3 animate-[progress_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
        </div>
        <div className="px-5 py-5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-600/80 dark:text-amber-400/80">
            Stage {stageNumber} — {title} · a gerar
          </div>
          <div className="mt-2 flex items-start gap-2.5">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-500" />
            <div className="min-w-0">
              <div
                key={stepIdx}
                className="text-sm font-medium text-foreground"
                style={{ animation: "stagecard-fade 0.45s ease-out" }}
              >
                {currentStep}
              </div>
              {loadingEta && (
                <div className="mt-1 text-xs text-muted-foreground">{loadingEta}</div>
              )}
            </div>
          </div>
          {loadingSteps && loadingSteps.length > 1 && (
            <div className="mt-3 flex items-center gap-1.5">
              {loadingSteps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 w-6 rounded-full transition-colors ${
                    i <= stepIdx ? "bg-amber-500/80" : "bg-amber-500/15"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ready or approved+open
  const showHeaderApprove =
    onApprove && status !== "approved" && !hideHeaderApprove;
  return (
    <div ref={cardRef} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
        <div className="flex items-center gap-2">
          {open && onRegenerate && (
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
          {showHeaderApprove && (
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
      </div>
      {open && (
        <div className="p-4">
          {expandedBody ?? children}
        </div>
      )}
    </div>
  );
}