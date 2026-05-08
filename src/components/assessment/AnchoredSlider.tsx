import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export type SliderAnchor = {
  /** value at or below which this anchor's label applies */
  upTo: number;
  /** short editorial label shown under the slider */
  label: string;
};

/**
 * Slider with editorial anchors. Instead of "7/10" the user sees "7 · Acordo cansado quase todos os dias".
 * Anchors must be sorted ascending by `upTo`. The last anchor is the catch-all.
 */
export function AnchoredSlider({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  anchors,
  trailing,
}: {
  label?: string;
  value: number | null | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  anchors: SliderAnchor[];
  /** Optional element rendered to the right of the label (e.g. HelpPopover). */
  trailing?: React.ReactNode;
}) {
  const v = typeof value === "number" ? value : Math.round((min + max) / 2);
  const anchor = anchors.find((a) => v <= a.upTo) ?? anchors[anchors.length - 1];
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      {label && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">{label}</Label>
            {trailing}
          </div>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {v}/{max}
          </span>
        </div>
      )}
      <Slider
        min={min}
        max={max}
        step={step}
        value={[v]}
        onValueChange={([next]) => onChange(next)}
      />
      <p className="mt-1.5 text-[11px] leading-snug text-foreground">
        <span className="font-medium">{anchor?.label}</span>
      </p>
    </div>
  );
}