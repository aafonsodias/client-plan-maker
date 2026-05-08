import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { HelpPopover } from "./HelpPopover";
import type { ReactNode } from "react";

/**
 * Numeric measurement input with a "Como medir?" popover (text + optional image).
 * Designed for body measurements where the user needs guidance on technique.
 */
export function MeasureField({
  label,
  unit,
  value,
  onChange,
  imageSrc,
  imageAlt,
  helpTitle = "Como medir?",
  helpBody,
  placeholder,
}: {
  label: string;
  unit?: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  imageSrc?: string;
  imageAlt?: string;
  helpTitle?: string;
  helpBody: ReactNode;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <Label className="text-xs">{label}</Label>
        <HelpPopover label={helpTitle} triggerLabel={helpTitle} imageSrc={imageSrc} imageAlt={imageAlt}>
          {helpBody}
        </HelpPopover>
      </div>
      <div className="relative">
        <Input
          className="h-8 pr-10 text-sm"
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}