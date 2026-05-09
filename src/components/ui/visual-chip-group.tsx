import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface VisualChipOption<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

const COLS_CLS: Record<2 | 3 | 4 | 5, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-5",
};

const SIZE_CLS = {
  sm: { box: "p-2 gap-1", icon: "h-8 w-8", label: "text-[10px]" },
  md: { box: "p-2.5 gap-1.5", icon: "h-10 w-10", label: "text-[11px]" },
} as const;

/**
 * VisualChipGroup — selectable chip buttons that pair an inline SVG icon with
 * a label. Use when the option is intrinsically visual (sex, training location,
 * smoking status, etc). All icons should use `currentColor` for theme support.
 */
export function VisualChipGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  size = "md",
}: {
  options: VisualChipOption<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4 | 5;
  size?: "sm" | "md";
}) {
  const s = SIZE_CLS[size];
  return (
    <div className={cn("grid gap-2", COLS_CLS[columns])}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={cn(
              "flex flex-col items-center justify-center rounded-md border transition-colors text-center",
              s.box,
              selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-background/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <span className={cn("flex items-center justify-center", s.icon)}>
              {opt.icon}
            </span>
            <span className={cn("font-medium leading-tight", s.label)}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}