import { weekTagFor, type WeekTag } from "@/lib/macro-index";
import { cn } from "@/lib/utils";

/**
 * On-screen mirror of the macro-index strip drawn on the weekly PDF cover.
 * Renders one chip per week with its tag (base / +load / +reps / deload),
 * highlights the currently-selected week. Mirroring the PDF means the
 * trainer's paper clipboard and on-screen view share one visual language.
 */
export function MacroIndexStrip({
  totalWeeks,
  selectedWeek,
  onSelect,
}: {
  totalWeeks: number;
  selectedWeek: number;
  onSelect?: (wn: number) => void;
}) {
  const weeks = Array.from({ length: Math.max(1, totalWeeks) }, (_, i) => i + 1);
  return (
    <div
      role="tablist"
      aria-label="Semanas do bloco"
      className="flex w-full items-stretch gap-1 overflow-x-auto pb-1"
    >
      {weeks.map((wn) => {
        const tag = weekTagFor(wn, totalWeeks);
        const active = wn === selectedWeek;
        return (
          <button
            key={wn}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect?.(wn)}
            className={cn(
              "group flex min-w-[58px] flex-1 flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-[10px] font-medium uppercase tracking-wider transition",
              active
                ? "border-amber-400/60 bg-amber-500/10 text-amber-200 shadow-[inset_0_0_12px_rgba(245,158,11,0.18)]"
                : "border-border bg-card/40 text-muted-foreground hover:border-amber-400/30 hover:text-foreground",
            )}
          >
            <span className="font-mono text-[11px] tabular-nums opacity-90">W{wn}</span>
            <span className={cn("text-[9px]", tagToneClass(tag, active))}>{tag}</span>
          </button>
        );
      })}
    </div>
  );
}

function tagToneClass(tag: WeekTag, active: boolean): string {
  if (active) return "opacity-90";
  switch (tag) {
    case "deload":
      return "text-blue-400/80";
    case "+load":
      return "text-amber-400/80";
    case "+reps":
      return "text-emerald-400/80";
    default:
      return "text-muted-foreground/80";
  }
}