import { useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Discreet help trigger that opens a popover with rich content (text + optional image).
 * Replaces the previous Tooltip(?) pattern: works on touch, fits long copy, supports images.
 */
export function HelpPopover({
  label,
  triggerLabel,
  imageSrc,
  imageAlt,
  children,
}: {
  label?: string;
  triggerLabel?: string;
  imageSrc?: string;
  imageAlt?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          aria-label={label ?? triggerLabel ?? "Ajuda"}
        >
          <HelpCircle className="h-3 w-3" />
          {triggerLabel && <span>{triggerLabel}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="max-w-sm space-y-2 text-xs leading-relaxed"
      >
        {imageSrc && (
          <img
            src={imageSrc}
            alt={imageAlt ?? ""}
            loading="lazy"
            className="w-full rounded-md border border-border bg-background/40"
          />
        )}
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}