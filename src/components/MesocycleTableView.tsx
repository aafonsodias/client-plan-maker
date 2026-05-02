import { useMemo } from "react";
import type { PlanData, Day, Exercise } from "@/lib/pdf";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Compact Mesocycle Table View — fits the entire mesocycle on a single
 * landscape page. One row per main-block exercise; week columns show
 * sets × reps · @RPE · rest, with deltas vs Week 1 highlighted.
 */
export function MesocycleTableView({ plan }: { plan: PlanData }) {
  const [compact, setCompact] = useState(true);

  if (!plan.weeks.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No weeks yet — switch to Edit to build the plan.
      </p>
    );
  }

  // Build a stable list of week numbers across the meso so columns line up.
  const weekNumbers = useMemo(
    () => plan.weeks.map((w) => w.week_number).sort((a, b) => a - b),
    [plan.weeks],
  );

  // For each day, collect rows from W1 and look up the matching exercise in
  // each week column. We keep the raw Exercise around so we can diff fields.
  type Cell = { ex: Exercise | null };
  const dayGroups = useMemo(() => {
    const w1 = plan.weeks[0];
    if (!w1) return [];
    return w1.days.map((day, dayIdx) => {
      const rows = day.exercises.map((ex, exIdx) => {
        const cells: Cell[] = weekNumbers.map((wn) => {
          const wk = plan.weeks.find((w) => w.week_number === wn);
          const matchingDay = wk?.days.find(
            (d) => d.day_label === day.day_label,
          ) ?? wk?.days[dayIdx];
          const matchingEx =
            matchingDay?.exercises.find((e) => e.name === ex.name) ??
            matchingDay?.exercises[exIdx];
          return { ex: matchingEx ?? null };
        });
        return { exercise: ex, cells };
      });
      return { day, rows };
    });
  }, [plan, weekNumbers]);

  // Deload heuristic: the last week of a 3+ week meso. Stage 5 typically dials
  // back volume there. Real progression_plan.deload field doesn't exist yet;
  // when it does we can read it here without changing the UI.
  const lastWeek = Math.max(...weekNumbers);
  const isDeloadWeek = (wn: number) => weekNumbers.length >= 3 && wn === lastWeek;

  // Mesocycle volume + intensity totals per week — surface the trend so the
  // trainer doesn't have to mentally diff every cell.
  const weekTotals = useMemo(() => {
    return weekNumbers.map((wn) => {
      const wk = plan.weeks.find((w) => w.week_number === wn);
      let totalReps = 0;
      let rpeSum = 0;
      let rpeCount = 0;
      for (const d of wk?.days ?? []) {
        for (const ex of d.exercises ?? []) {
          totalReps += approxReps(ex);
          const r = parseRpe(ex.rpe);
          if (r != null) {
            rpeSum += r;
            rpeCount++;
          }
        }
      }
      return {
        wn,
        reps: totalReps,
        rpe: rpeCount ? rpeSum / rpeCount : null,
      };
    });
  }, [plan, weekNumbers]);

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          {weekTotals.map((t) => (
            <span
              key={t.wn}
              className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2 py-1 ${isDeloadWeek(t.wn) ? "text-amber-300" : ""}`}
            >
              <span className="font-bold">W{t.wn}</span>
              <span>~{t.reps} reps</span>
              {t.rpe != null && <span>· RPE {t.rpe.toFixed(1)}</span>}
              {isDeloadWeek(t.wn) && <span>· deload</span>}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCompact((c) => !c)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {compact ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {compact ? "Detailed" : "Compact"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card print:border-0">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col style={{ width: "32%" }} />
            {weekNumbers.map((wn) => (
              <col key={wn} style={{ width: `${68 / weekNumbers.length}%` }} />
            ))}
          </colgroup>
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="bg-muted/50 px-3 py-2 text-left font-semibold">
                Exercise
              </th>
              {weekNumbers.map((wn) => (
                <th
                  key={wn}
                  className={`px-2 py-2 text-left font-semibold ${
                    isDeloadWeek(wn) ? "text-amber-300/80" : ""
                  }`}
                >
                  Week {wn}
                  {isDeloadWeek(wn) ? " · deload" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dayGroups.map(({ day, rows }, gi) => (
              <DayBlock
                key={`${day.day_label}-${gi}`}
                day={day}
                rows={rows}
                weekCount={weekNumbers.length}
                compact={compact}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-[10px] text-muted-foreground print:text-[8px]">
        Bold cells = changed vs Week 1. ▲ load up · ▼ load down. Switch to Detailed to print with
        exercise cues + log slots.
      </p>
    </div>
  );
}

function DayBlock({
  day,
  rows,
  weekCount,
  compact,
}: {
  day: Day;
  rows: { exercise: Exercise; cells: { ex: Exercise | null }[] }[];
  weekCount: number;
  compact: boolean;
}) {
  return (
    <>
      <tr className="border-t border-border bg-secondary/30">
        <td
          colSpan={weekCount + 1}
          className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground"
        >
          {day.day_label}
          {day.focus && (
            <span className="ml-2 normal-case text-muted-foreground">
              · {day.focus}
            </span>
          )}
        </td>
      </tr>
      {rows.map(({ exercise, cells }, i) => (
        <ExerciseRowPair
          key={`${exercise.name}-${i}`}
          exercise={exercise}
          cells={cells}
          compact={compact}
        />
      ))}
    </>
  );
}

function ExerciseRowPair({
  exercise,
  cells,
  compact,
}: {
  exercise: Exercise;
  cells: { ex: Exercise | null }[];
  compact: boolean;
}) {
  const baseline = cells[0]?.ex ?? exercise;
  return (
    <>
      <tr className="border-t border-border/40">
        <td className="bg-card px-3 py-1.5 align-top text-foreground break-words">
          <div className="font-medium">{exercise.name}</div>
          {!compact && (exercise as any).cue && (
            <div className="mt-0.5 line-clamp-2 text-[10px] italic text-muted-foreground">
              {String((exercise as any).cue)}
            </div>
          )}
        </td>
        {cells.map((c, i) => (
          <CellTd key={i} cell={c} baseline={baseline} isFirst={i === 0} />
        ))}
      </tr>
      {!compact && (
        <tr className="border-t border-dashed border-border/30 print:border-border/60">
          <td className="bg-card px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
            log
          </td>
          {cells.map((_, i) => (
            <td key={i} className="px-2 py-1 text-[10px] text-muted-foreground/40">
              ___ × ___ @ ___
            </td>
          ))}
        </tr>
      )}
    </>
  );
}

function CellTd({
  cell,
  baseline,
  isFirst,
}: {
  cell: { ex: Exercise | null };
  baseline: Exercise;
  isFirst: boolean;
}) {
  if (!cell.ex) {
    return (
      <td className="px-2 py-1.5 align-top text-muted-foreground/50">—</td>
    );
  }
  const sets = (cell.ex.sets ?? "").toString().trim();
  const reps = (cell.ex.reps ?? "").toString().trim();
  const rpe = (cell.ex.rpe ?? "").toString().trim();
  const rest = (cell.ex.rest ?? "").toString().trim();

  const setsChanged = !isFirst && sets !== (baseline.sets ?? "").toString().trim();
  const repsChanged = !isFirst && reps !== (baseline.reps ?? "").toString().trim();
  const rpeChanged = !isFirst && rpe !== (baseline.rpe ?? "").toString().trim();
  const restChanged = !isFirst && rest !== (baseline.rest ?? "").toString().trim();

  const repsTrend = trendArrow(approxReps(cell.ex), approxReps(baseline));
  const rpeTrend = trendArrow(parseRpe(cell.ex.rpe), parseRpe(baseline.rpe));

  const tone = (changed: boolean) =>
    changed
      ? "font-semibold text-foreground"
      : "text-muted-foreground";

  return (
    <td className="px-2 py-1.5 align-top">
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] leading-tight">
        {(sets || reps) && (
          <span className={tone(setsChanged || repsChanged)}>
            {sets && reps ? `${sets}×${reps}` : sets || reps}
            {!isFirst && repsTrend && (
              <span className="ml-0.5 text-amber-400/80">{repsTrend}</span>
            )}
          </span>
        )}
        {rpe && (
          <span className={tone(rpeChanged)}>
            @{rpe}
            {!isFirst && rpeTrend && (
              <span className="ml-0.5 text-amber-400/80">{rpeTrend}</span>
            )}
          </span>
        )}
        {rest && <span className={tone(restChanged)}>{rest}</span>}
      </div>
    </td>
  );
}

function approxReps(ex: Exercise): number {
  const sets = parseInt((ex.sets ?? "").toString(), 10) || 0;
  // reps may be "8-10" → take midpoint, "AMRAP" → 0
  const repsRaw = (ex.reps ?? "").toString();
  const m = repsRaw.match(/(\d+)\s*-\s*(\d+)/);
  const reps = m
    ? (parseInt(m[1], 10) + parseInt(m[2], 10)) / 2
    : parseInt(repsRaw, 10) || 0;
  return sets * reps;
}

function parseRpe(rpe?: string): number | null {
  if (!rpe) return null;
  const m = rpe.toString().match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function trendArrow(curr: number | null, base: number | null): string {
  if (curr == null || base == null || curr === base) return "";
  return curr > base ? "▲" : "▼";
}