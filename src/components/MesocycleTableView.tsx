import { useMemo } from "react";
import type { PlanData, Day, Exercise } from "@/lib/pdf";

/**
 * Compact Mesocycle Table View — fits the entire mesocycle on a single
 * landscape page. One row per main-block exercise; week columns show only
 * the variables that change (sets × reps · RPE · rest). A muted "log:" sub
 * row gives blank cells for hand-written tracking when the trainer prints.
 */
export function MesocycleTableView({ plan }: { plan: PlanData }) {
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

  // For each "day label" (e.g. "Day 1 — Upper"), collect the exercise rows
  // from week 1 (or first available) and look up the matching exercise in
  // each week column for delta values.
  const dayGroups = useMemo(() => {
    const w1 = plan.weeks[0];
    if (!w1) return [];
    return w1.days.map((day, dayIdx) => {
      const rows = day.exercises.map((ex, exIdx) => {
        const cells = weekNumbers.map((wn) => {
          const wk = plan.weeks.find((w) => w.week_number === wn);
          const matchingDay = wk?.days.find(
            (d) => d.day_label === day.day_label,
          ) ?? wk?.days[dayIdx];
          const matchingEx =
            matchingDay?.exercises.find((e) => e.name === ex.name) ??
            matchingDay?.exercises[exIdx];
          return matchingEx ? formatCell(matchingEx) : "—";
        });
        return { exercise: ex, cells };
      });
      return { day, rows };
    });
  }, [plan, weekNumbers]);

  const isDeloadWeek = (wn: number) => wn === Math.max(...weekNumbers);

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-border bg-card print:border-0">
        <table className="w-full min-w-[720px] table-auto text-xs">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-semibold">
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
                  {isDeloadWeek(wn) && weekNumbers.length >= 4 ? " · deload" : ""}
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
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-[10px] text-muted-foreground print:text-[8px]">
        Empty cells under each exercise are write-in slots — print this view to
        hand-track sets, reps and weights, then transcribe back into the app.
      </p>
    </div>
  );
}

function DayBlock({
  day,
  rows,
  weekCount,
}: {
  day: Day;
  rows: { exercise: Exercise; cells: string[] }[];
  weekCount: number;
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
        />
      ))}
    </>
  );
}

function ExerciseRowPair({
  exercise,
  cells,
}: {
  exercise: Exercise;
  cells: string[];
}) {
  return (
    <>
      <tr className="border-t border-border/40">
        <td className="sticky left-0 z-10 bg-card px-3 py-1.5 align-top text-foreground">
          <div className="font-medium">{exercise.name}</div>
          {(exercise as any).cue && (
            <div className="mt-0.5 text-[10px] italic text-muted-foreground">
              {String((exercise as any).cue).slice(0, 110)}
            </div>
          )}
        </td>
        {cells.map((c, i) => (
          <td key={i} className="px-2 py-1.5 align-top text-muted-foreground">
            {c}
          </td>
        ))}
      </tr>
      <tr className="border-t border-dashed border-border/30 print:border-border/60">
        <td className="sticky left-0 z-10 bg-card px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
          log
        </td>
        {cells.map((_, i) => (
          <td key={i} className="px-2 py-1 text-[10px] text-muted-foreground/40">
            ___ × ___ @ ___
          </td>
        ))}
      </tr>
    </>
  );
}

function formatCell(ex: Exercise): string {
  const sets = (ex.sets ?? "").toString().trim();
  const reps = (ex.reps ?? "").toString().trim();
  const rpe = (ex.rpe ?? "").toString().trim();
  const rest = (ex.rest ?? "").toString().trim();
  const sr = sets && reps ? `${sets}×${reps}` : sets || reps;
  const parts = [sr, rpe ? `@${rpe}` : "", rest ? rest : ""].filter(Boolean);
  return parts.join(" · ") || "—";
}