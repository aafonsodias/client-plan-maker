import type { ExerciseBlock } from "@/lib/exercise-grouping";
import { blockLabel } from "@/lib/exercise-grouping";
import { ExerciseSetsCard, type LogEntryV2 } from "@/components/log/ExerciseSetsCard";
import { Repeat } from "lucide-react";

/**
 * Wraps a block of grouped exercises (single / superset / circuit / giant set)
 * with a header chip and a thin coloured rail on the left so the visual
 * grouping is unambiguous on a phone.
 */
export function BlockGroup({
  block,
  blockIndex,
  entries,
  baseEntryIndex,
  onChange,
  token,
  planId,
  onSetKeyDown,
}: {
  block: ExerciseBlock;
  blockIndex: number;
  /** Subset of LogEntryV2 entries belonging to THIS block, in order. */
  entries: LogEntryV2[];
  /** Offset of the first entry in the global entries[] array. */
  baseEntryIndex: number;
  onChange: (globalIndex: number, next: LogEntryV2) => void;
  token: string;
  planId: string;
  onSetKeyDown?: React.ComponentProps<typeof ExerciseSetsCard>["onSetKeyDown"];
}) {
  const label = blockLabel(block, blockIndex);
  const tone =
    block.kind === "circuit" || block.kind === "giant_set"
      ? "border-l-amber-500"
      : block.kind === "superset"
        ? "border-l-blue-500"
        : "border-l-emerald-500";

  const rounds =
    block.rounds ??
    (block.kind === "circuit" || block.kind === "superset"
      ? Number(String(block.exercises[0]?.sets ?? "").match(/\d+/)?.[0])
      : undefined);

  const showHeader = block.kind !== "single";

  return (
    <div className={`relative rounded-xl border-l-4 ${tone} bg-card/60 px-1 pb-2`}>
      {showHeader && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground">
            {label}
          </span>
          {rounds && Number.isFinite(rounds) ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <Repeat className="h-3 w-3" /> {rounds} rondas
            </span>
          ) : null}
        </div>
      )}
      <div className="space-y-2 px-1">
        {entries.map((entry, i) => (
          <ExerciseSetsCard
            key={`${entry.exercise_name}-${i}`}
            entry={entry}
            index={baseEntryIndex + i}
            onChange={onChange}
            token={token}
            planId={planId}
            onSetKeyDown={onSetKeyDown}
          />
        ))}
      </div>
    </div>
  );
}