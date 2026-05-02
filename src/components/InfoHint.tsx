import * as React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toneText, type Tone } from "@/lib/status-tone";

type InfoHintProps = {
  /** Body text shown inside the tooltip. */
  children: React.ReactNode;
  /** Optional accessible label; defaults to "More info". */
  label?: string;
  /** Visual tone for the icon. */
  tone?: Tone;
  /** Icon size in px. Default 12. */
  size?: number;
  className?: string;
  /** Tooltip side. */
  side?: "top" | "right" | "bottom" | "left";
};

/**
 * Tiny info icon that opens a tooltip on hover OR tap.
 * Mobile-friendly (touch toggles open via local state) and re-uses status-tone tokens.
 *
 * Usage:
 *   <InfoHint tone="warn">Sinais de alerta detectados no teu brief.</InfoHint>
 */
export function InfoHint({
  children,
  label = "More info",
  tone = "neutral",
  size = 12,
  className,
  side = "top",
}: InfoHintProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-full p-0.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring",
              toneText(tone),
              className,
            )}
          >
            <Info style={{ width: size, height: size }} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[260px] bg-popover text-popover-foreground border border-border">
          <div className="text-xs leading-snug">{children}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
