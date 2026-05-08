export type ChipOption<T extends string | number> = {
  value: T;
  label: string;
  /** Optional sub-label shown smaller under the main label. */
  sub?: string;
};

/**
 * Selectable chip group. Replaces ad-hoc <button> grids used across the assessment.
 * Use `cols` to switch between pill-row (default) and grid layouts.
 */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  cols = 0,
  size = "md",
}: {
  options: ChipOption<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  /** 0 = inline pills, >0 = grid with that many columns on >=sm. */
  cols?: 0 | 2 | 3 | 4 | 5;
  size?: "sm" | "md";
}) {
  const containerCls =
    cols === 0
      ? "flex flex-wrap gap-1.5"
      : `grid grid-cols-2 gap-1.5 sm:grid-cols-${cols}`;
  const sizeCls = size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]";
  return (
    <div className={containerCls}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              `flex flex-col items-start gap-0.5 rounded-md border text-left font-medium transition-colors ${sizeCls} ` +
              (selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-background/30 text-muted-foreground hover:border-primary/40 hover:text-foreground")
            }
          >
            <span className="leading-tight">{o.label}</span>
            {o.sub && <span className="text-[10px] font-normal opacity-70">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}