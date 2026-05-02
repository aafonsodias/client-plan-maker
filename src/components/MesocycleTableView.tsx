import { useMemo, useState } from "react";
import type { PlanData, Day, Exercise } from "@/lib/pdf";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Copy, ClipboardCopy, AlertTriangle, Pencil, Check, X, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { updateExerciseInWeek, deleteExerciseAcrossWeeks } from "@/server/phased/microcycle-edit.functions";
import { rpeTone, parseRpe as parseRpeShared } from "@/lib/rpe-tone";

/**
 * Compact Mesocycle Table View — fits the entire mesocycle on a single
 * landscape page. One row per main-block exercise; week columns show
 * sets × reps · @RPE · rest · ±load, with deltas vs Week 1 highlighted.
 *
 * New in this iteration:
 * - Always renders RPE column (dim @— when missing).
 * - Shows load chip from `notes` when applyDelta encoded a load change.
 * - Empty-deltas banner when every W2+ cell is identical to W1.
 * - Copy as TSV / Markdown buttons (clipboard).
 * - Click cell → inline edit (sets / reps / rpe / rest); persists via server fn.
 * - "(swapped)" tag when resolved exercise name diverges from baseline.
 * - AMRAP treated as 8 reps for volume estimate.
 */
export function MesocycleTableView({
  plan,
  planId,
  editable = true,
  onUpdated,
}: {
  plan: PlanData;
  planId?: string;
  editable?: boolean;
  onUpdated?: () => void;
}) {
  const [compact, setCompact] = useState(true);
  const updateFn = useServerFn(updateExerciseInWeek);
  const deleteFn = useServerFn(deleteExerciseAcrossWeeks);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  // Local optimistic patches: keyed by `${week}|${dayLabel}|${exIdx}` → patch
  const [patches, setPatches] = useState<Record<string, Partial<Exercise>>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);

  if (!plan.weeks.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No weeks yet — switch to Edit to build the plan.
      </p>
    );
  }

  const weekNumbers = useMemo(
    () => plan.weeks.map((w) => w.week_number).sort((a, b) => a - b),
    [plan.weeks],
  );

  type Cell = { ex: Exercise | null; weekNumber: number; dayLabel: string; exIdx: number };
  const dayGroups = useMemo(() => {
    const w1 = plan.weeks[0];
    if (!w1) return [];
    return w1.days.map((day, dayIdx) => {
      const rows = day.exercises.map((ex, exIdx) => {
        const cells: Cell[] = weekNumbers.map((wn) => {
          const wk = plan.weeks.find((w) => w.week_number === wn);
          const matchingDay =
            wk?.days.find((d) => d.day_label === day.day_label) ?? wk?.days[dayIdx];
          const matchingEx =
            matchingDay?.exercises.find((e) => e.name === ex.name) ??
            matchingDay?.exercises[exIdx];
          // Apply optimistic patch
          const key = `${wn}|${matchingDay?.day_label ?? day.day_label}|${exIdx}`;
          const patched = matchingEx && patches[key]
            ? ({ ...matchingEx, ...patches[key] } as Exercise)
            : (matchingEx ?? null);
          return {
            ex: patched,
            weekNumber: wn,
            dayLabel: matchingDay?.day_label ?? day.day_label,
            exIdx,
          };
        });
        return { exercise: ex, cells };
      });
      return { day, rows };
    });
  }, [plan, weekNumbers, patches]);

  const lastWeek = Math.max(...weekNumbers);
  const isDeloadWeek = (wn: number) => weekNumbers.length >= 3 && wn === lastWeek;

  // Detect "no deltas applied" — every W2+ cell deep-equals W1 on sets/reps/rpe/rest/notes/tempo.
  const noDeltas = useMemo(() => {
    if (weekNumbers.length < 2) return false;
    for (const { rows } of dayGroups) {
      for (const { cells } of rows) {
        const base = cells[0]?.ex;
        if (!base) continue;
        for (let i = 1; i < cells.length; i++) {
          const c = cells[i]?.ex;
          if (!c) continue;
          if (
            (c.sets ?? "") !== (base.sets ?? "") ||
            (c.reps ?? "") !== (base.reps ?? "") ||
            (c.rpe ?? "") !== (base.rpe ?? "") ||
            (c.rest ?? "") !== (base.rest ?? "") ||
            (c.notes ?? "") !== (base.notes ?? "") ||
            (c.tempo ?? "") !== (base.tempo ?? "")
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }, [dayGroups, weekNumbers]);

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
      return { wn, reps: totalReps, rpe: rpeCount ? rpeSum / rpeCount : null };
    });
  }, [plan, weekNumbers]);

  // ── Clipboard exporters ────────────────────────────────────────────────
  const buildMatrix = (): string[][] => {
    const rows: string[][] = [];
    rows.push(["Day", "Exercise", ...weekNumbers.map((w) => `W${w}`)]);
    for (const { day, rows: exRows } of dayGroups) {
      for (const { exercise, cells } of exRows) {
        rows.push([
          day.day_label,
          exercise.name,
          ...cells.map((c) => formatCellPlain(c.ex)),
        ]);
      }
    }
    return rows;
  };

  const copyTSV = async () => {
    const txt = buildMatrix().map((r) => r.join("\t")).join("\n");
    await navigator.clipboard.writeText(txt);
    toast.success("Copied as TSV — paste into Sheets/Excel");
  };

  const copyMarkdown = async () => {
    const m = buildMatrix();
    const head = `| ${m[0].join(" | ")} |`;
    const sep = `| ${m[0].map(() => "---").join(" | ")} |`;
    const body = m.slice(1).map((r) => `| ${r.join(" | ")} |`).join("\n");
    await navigator.clipboard.writeText([head, sep, body].join("\n"));
    toast.success("Copied as Markdown");
  };

  // ── Inline edit ────────────────────────────────────────────────────────
  const saveEdit = async (key: string, weekNumber: number, dayLabel: string, exIdx: number, patch: Partial<Exercise>) => {
    setPatches((p) => ({ ...p, [key]: { ...(p[key] ?? {}), ...patch } }));
    setEditingKey(null);
    if (!planId) return;
    const res = await updateFn({
      data: { planId, weekNumber, dayLabel, exerciseIndex: exIdx, patch },
    });
    if (!res.ok) {
      toast.error(res.error || "Save failed");
      // Roll back
      setPatches((p) => {
        const { [key]: _drop, ...rest } = p;
        return rest;
      });
    } else {
      onUpdated?.();
    }
  };

  const removeExercise = async (dayLabel: string, exerciseName: string) => {
    if (!planId) return;
    if (!confirm(`Apagar "${exerciseName}" de todas as semanas (${dayLabel})?`)) return;
    setDeletingName(`${dayLabel}|${exerciseName}`);
    const res = await deleteFn({ data: { planId, dayLabel, exerciseName } });
    setDeletingName(null);
    if (!res.ok) {
      toast.error(res.error || "Falhou ao apagar");
      return;
    }
    toast.success(`Removido de ${(res as any).touched ?? 0} semana(s)`);
    onUpdated?.();
  };

  return (
    <div className="space-y-4 print:space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          {weekTotals.map((t) => (
            <span
              key={t.wn}
              className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2 py-1 ${
                isDeloadWeek(t.wn) ? "text-amber-300" : ""
              }`}
            >
              <span className="font-bold">W{t.wn}</span>
              <span>~{t.reps} reps</span>
              {t.rpe != null && <span>· RPE {t.rpe.toFixed(1)}</span>}
              {isDeloadWeek(t.wn) && <span>· deload</span>}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyTSV}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            title="Copy as TSV (Sheets/Excel)"
          >
            <Copy className="h-3 w-3" /> TSV
          </button>
          <button
            type="button"
            onClick={copyMarkdown}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            title="Copy as Markdown table"
          >
            <ClipboardCopy className="h-3 w-3" /> MD
          </button>
          <button
            type="button"
            onClick={() => setCompact((c) => !c)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            {compact ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {compact ? "Detailed" : "Compact"}
          </button>
        </div>
      </div>

      {/* Empty-deltas banner */}
      {noDeltas && planId && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">No progression was applied to this plan.</p>
            <p className="mt-0.5 text-muted-foreground">
              Weeks 2–{lastWeek} are identical to Week 1 — the progression deltas were never generated, were empty, or only changed dimensions we don't display. Re-run progressions to add load / rep / RPE waves.
            </p>
          </div>
          <Link
            to="/plans/$planId/progressions"
            params={{ planId }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-200 hover:bg-amber-500/20"
          >
            Re-run progressions
          </Link>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card print:border-0">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col style={{ width: "30%" }} />
            {weekNumbers.map((wn) => (
              <col key={wn} style={{ width: `${70 / weekNumbers.length}%` }} />
            ))}
          </colgroup>
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="bg-muted/50 px-3 py-2 text-left font-semibold align-top">Exercise</th>
              {weekNumbers.map((wn) => {
                const t = weekTotals.find((x) => x.wn === wn);
                return (
                  <th
                    key={wn}
                    className={`px-2 py-2 text-left font-semibold align-top ${
                      isDeloadWeek(wn) ? "text-amber-300/80" : ""
                    }`}
                  >
                    <div>Week {wn}{isDeloadWeek(wn) ? " · deload" : ""}</div>
                    {t?.rpe != null && (
                      <div className="mt-0.5 text-[9px] font-normal normal-case tracking-normal text-muted-foreground/70">
                        RPE alvo {t.rpe.toFixed(1)}
                      </div>
                    )}
                  </th>
                );
              })}
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
                editable={editable && !!planId}
                editingKey={editingKey}
                setEditingKey={setEditingKey}
                patches={patches}
                onSaveEdit={saveEdit}
                onRemoveExercise={removeExercise}
                deletingName={deletingName}
                isFirstGroup={gi === 0}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-[10px] text-muted-foreground print:text-[8px]">
        Bold cells = changed vs Week 1. ▲ load up · ▼ load down. {editable && planId ? "Click a cell to edit." : "Switch to Detailed to print with cues + log slots."}
      </p>
    </div>
  );
}

function DayBlock({
  day,
  rows,
  weekCount,
  compact,
  editable,
  editingKey,
  setEditingKey,
  patches,
  onSaveEdit,
  onRemoveExercise,
  deletingName,
  isFirstGroup,
}: {
  day: Day;
  rows: { exercise: Exercise; cells: { ex: Exercise | null; weekNumber: number; dayLabel: string; exIdx: number }[] }[];
  weekCount: number;
  compact: boolean;
  editable: boolean;
  editingKey: string | null;
  setEditingKey: (k: string | null) => void;
  patches: Record<string, Partial<Exercise>>;
  onSaveEdit: (key: string, weekNumber: number, dayLabel: string, exIdx: number, patch: Partial<Exercise>) => void;
  onRemoveExercise: (dayLabel: string, exerciseName: string) => void;
  deletingName: string | null;
  isFirstGroup: boolean;
}) {
  return (
    <>
      {!isFirstGroup && (
        <tr aria-hidden="true">
          <td colSpan={weekCount + 1} className="h-3 bg-background p-0" />
        </tr>
      )}
      <tr className="bg-muted/25">
        <td
          colSpan={weekCount + 1}
          className="rounded-t border-t-2 border-accent/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-foreground"
        >
          {day.day_label}
          {day.focus && (
            <span className="ml-2 normal-case text-muted-foreground">· {day.focus}</span>
          )}
        </td>
      </tr>
      {rows.map(({ exercise, cells }, i) => (
        <ExerciseRowPair
          key={`${exercise.name}-${i}`}
          exercise={exercise}
          cells={cells}
          compact={compact}
          editable={editable}
          editingKey={editingKey}
          setEditingKey={setEditingKey}
          patches={patches}
          onSaveEdit={onSaveEdit}
          onRemove={() => onRemoveExercise(day.day_label, exercise.name)}
          isDeleting={deletingName === `${day.day_label}|${exercise.name}`}
        />
      ))}
    </>
  );
}

function ExerciseRowPair({
  exercise,
  cells,
  compact,
  editable,
  editingKey,
  setEditingKey,
  patches,
  onSaveEdit,
  onRemove,
  isDeleting,
}: {
  exercise: Exercise;
  cells: { ex: Exercise | null; weekNumber: number; dayLabel: string; exIdx: number }[];
  compact: boolean;
  editable: boolean;
  editingKey: string | null;
  setEditingKey: (k: string | null) => void;
  patches: Record<string, Partial<Exercise>>;
  onSaveEdit: (key: string, weekNumber: number, dayLabel: string, exIdx: number, patch: Partial<Exercise>) => void;
  onRemove: () => void;
  isDeleting: boolean;
}) {
  const baseline = cells[0]?.ex ?? exercise;
  const supersetId = (exercise as any).superset_id as string | undefined;
  return (
    <>
      <tr className="border-t border-border/40">
        <td className="bg-card px-3 py-1.5 align-top text-foreground break-words">
          <div className="group/name flex items-center gap-1.5">
            <span className="font-medium">{exercise.name}</span>
            {supersetId && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-widest text-accent"
                title={`Superset ${supersetId}`}
              >
                <Link2 className="h-2.5 w-2.5" /> SS
              </span>
            )}
            {editable && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                disabled={isDeleting}
                title="Apagar este exercício de todas as semanas"
                className="ml-auto opacity-0 transition group-hover/name:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          {!compact && (exercise as any).cue && (
            <div className="mt-0.5 line-clamp-2 text-[10px] italic text-muted-foreground">
              {String((exercise as any).cue)}
            </div>
          )}
        </td>
        {cells.map((c, i) => {
          const key = `${c.weekNumber}|${c.dayLabel}|${c.exIdx}`;
          const dirty = !!patches[key];
          return (
            <CellTd
              key={i}
              cell={c}
              baseline={baseline}
              isFirst={i === 0}
              editable={editable}
              isEditing={editingKey === key}
              dirty={dirty}
              onStartEdit={() => setEditingKey(key)}
              onCancel={() => setEditingKey(null)}
              onSave={(patch) => onSaveEdit(key, c.weekNumber, c.dayLabel, c.exIdx, patch)}
            />
          );
        })}
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
  editable,
  isEditing,
  dirty,
  onStartEdit,
  onCancel,
  onSave,
}: {
  cell: { ex: Exercise | null };
  baseline: Exercise;
  isFirst: boolean;
  editable: boolean;
  isEditing: boolean;
  dirty: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Exercise>) => void;
}) {
  if (!cell.ex) {
    return <td className="px-2 py-1.5 align-top text-muted-foreground/50">—</td>;
  }

  if (isEditing) {
    return (
      <CellEditor
        ex={cell.ex}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  const sets = (cell.ex.sets ?? "").toString().trim();
  const reps = (cell.ex.reps ?? "").toString().trim();
  const rpe = (cell.ex.rpe ?? "").toString().trim();
  const rest = (cell.ex.rest ?? "").toString().trim();
  const loadChip = extractLoadChip((cell.ex as any).notes);
  const swapped = !isFirst && cell.ex.name && baseline.name && cell.ex.name !== baseline.name;

  const setsChanged = !isFirst && sets !== (baseline.sets ?? "").toString().trim();
  const repsChanged = !isFirst && reps !== (baseline.reps ?? "").toString().trim();
  const rpeChanged = !isFirst && rpe !== (baseline.rpe ?? "").toString().trim();
  const restChanged = !isFirst && rest !== (baseline.rest ?? "").toString().trim();

  const repsTrend = trendArrow(approxReps(cell.ex), approxReps(baseline));
  const rpeTrend = trendArrow(parseRpe(cell.ex.rpe), parseRpe(baseline.rpe));

  const tone = (changed: boolean) =>
    changed ? "font-semibold text-foreground" : "text-muted-foreground";

  return (
    <td
      className={`group/cell relative px-2 py-1.5 align-top ${
        editable ? "cursor-pointer hover:bg-secondary/40" : ""
      }`}
      onClick={editable ? onStartEdit : undefined}
      title={editable ? "Click to edit" : undefined}
    >
      {dirty && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400" title="Unsaved (or recently saved)" />
      )}
      {editable && (
        <Pencil className="absolute right-1 bottom-1 h-2.5 w-2.5 text-muted-foreground/0 transition group-hover/cell:text-muted-foreground/60" />
      )}
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] leading-tight">
        {(sets || reps) ? (
          <span className={tone(setsChanged || repsChanged)}>
            {sets && reps ? `${sets}×${reps}` : sets || reps}
            {!isFirst && repsTrend && (
              <span className="ml-0.5 text-amber-400/80">{repsTrend}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
        <span className={rpe ? tone(rpeChanged) : "text-muted-foreground/40"}>
          @{rpe || "—"}
          {rpe && !isFirst && rpeTrend && (
            <span className="ml-0.5 text-amber-400/80">{rpeTrend}</span>
          )}
        </span>
        {rest && <span className={tone(restChanged)}>{rest}</span>}
        {loadChip && (
          <span className="rounded bg-emerald-500/10 px-1 py-px text-[10px] font-medium text-emerald-300">
            {loadChip}
          </span>
        )}
      </div>
      {swapped && (
        <div className="mt-0.5 text-[9px] uppercase tracking-widest text-amber-300/80">
          (swapped → {cell.ex.name})
        </div>
      )}
    </td>
  );
}

function CellEditor({
  ex,
  onCancel,
  onSave,
}: {
  ex: Exercise;
  onCancel: () => void;
  onSave: (patch: Partial<Exercise>) => void;
}) {
  const [sets, setSets] = useState(ex.sets ?? "");
  const [reps, setReps] = useState(ex.reps ?? "");
  const [rpe, setRpe] = useState(ex.rpe ?? "");
  const [rest, setRest] = useState(ex.rest ?? "");

  const commit = () => onSave({ sets, reps, rpe, rest });
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") onCancel();
  };

  const inputCls =
    "w-full rounded border border-border bg-background px-1 py-0.5 text-[11px] focus:border-accent focus:outline-none";

  return (
    <td className="px-1.5 py-1 align-top">
      <div className="grid grid-cols-2 gap-1" onKeyDown={onKey}>
        <input className={inputCls} value={sets} onChange={(e) => setSets(e.target.value)} placeholder="sets" autoFocus />
        <input className={inputCls} value={reps} onChange={(e) => setReps(e.target.value)} placeholder="reps" />
        <input className={inputCls} value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="rpe" />
        <input className={inputCls} value={rest} onChange={(e) => setRest(e.target.value)} placeholder="rest" />
      </div>
      <div className="mt-1 flex items-center justify-end gap-1">
        <button onClick={onCancel} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Cancel">
          <X className="h-3 w-3" />
        </button>
        <button onClick={commit} className="rounded bg-emerald-500/20 p-0.5 text-emerald-300 hover:bg-emerald-500/30" aria-label="Save">
          <Check className="h-3 w-3" />
        </button>
      </div>
    </td>
  );
}

function approxReps(ex: Exercise): number {
  const sets = parseInt((ex.sets ?? "").toString(), 10) || 0;
  const repsRaw = (ex.reps ?? "").toString();
  if (/amrap/i.test(repsRaw)) return sets * 8; // estimate AMRAP as 8 reps
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

/** When applyDelta encodes a load delta in `notes` we surface it as a chip
 *  e.g. "(+2.5kg)" or "+2.5kg" appended at end. */
function extractLoadChip(notes?: string): string | null {
  if (!notes) return null;
  const m = notes.toString().match(/([+-]?\d+(?:\.\d+)?)(kg|lb)\)?\s*$/i);
  return m ? `${m[1]}${m[2].toLowerCase()}` : null;
}

function formatCellPlain(ex: Exercise | null): string {
  if (!ex) return "—";
  const sets = (ex.sets ?? "").toString().trim();
  const reps = (ex.reps ?? "").toString().trim();
  const rpe = (ex.rpe ?? "").toString().trim();
  const rest = (ex.rest ?? "").toString().trim();
  const load = extractLoadChip((ex as any).notes);
  const parts: string[] = [];
  if (sets || reps) parts.push(sets && reps ? `${sets}×${reps}` : sets || reps);
  if (rpe) parts.push(`@${rpe}`);
  if (rest) parts.push(rest);
  if (load) parts.push(load);
  return parts.join(" ");
}