import { useMemo, useState } from "react";
import type { PlanData, Day, Exercise } from "@/lib/pdf";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Copy, ClipboardCopy, AlertTriangle, Pencil, Check, X, Trash2, Link2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { updateExerciseInWeek, deleteExerciseAcrossWeeks } from "@/server/phased/microcycle-edit.functions";
import { rpeTone, parseRpe as parseRpeShared } from "@/lib/rpe-tone";
import { AddExerciseDialog } from "@/components/AddExerciseDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  wave,
}: {
  plan: PlanData;
  planId?: string;
  editable?: boolean;
  onUpdated?: () => void;
  /**
   * Optional canonical wave plan from generation_meta.wave_periodization.weeks.
   * When present, the per-week header shows the *intended* tag + RPE range
   * (Bompa wave) instead of the empirical median, which barely shifts with
   * +0.5 RPE bumps and reads as flat to the trainer.
   */
  wave?: Array<{
    week: number;
    rpe_low?: number | null;
    rpe_high?: number | null;
    tag?: "base" | "+volume" | "+intensity" | "deload" | string | null;
  }> | null;
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
      const rpeValues: number[] = [];
      for (const d of wk?.days ?? []) {
        for (const ex of d.exercises ?? []) {
          totalReps += approxReps(ex);
          // Honest read: skip optional/accessory chrome that drags the average
          // down. We want what the trainer SEES the client doing in the main
          // block, not the warmup/cooldown.
          if ((ex as any)?.optional === true) continue;
          const r = parseRpe(ex.rpe);
          if (r != null) rpeValues.push(r);
        }
      }
      let rpeMedian: number | null = null;
      let rpeMin: number | null = null;
      let rpeMax: number | null = null;
      if (rpeValues.length) {
        const sorted = [...rpeValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        rpeMedian =
          sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        rpeMin = sorted[0];
        rpeMax = sorted[sorted.length - 1];
      }
      return { wn, reps: totalReps, rpe: rpeMedian, rpeMin, rpeMax };
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
        {/* Week summary chips removed — week columns already show RPE and the
            redundant pills added noise. Volume totals will return as
            "planned vs logged" comparisons in the Results panel. */}
        <div />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              aria-label="More table actions"
            >
              <MoreHorizontal className="h-3 w-3" /> More
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => void copyTSV()}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Copy as TSV
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void copyMarkdown()}>
              <ClipboardCopy className="mr-2 h-3.5 w-3.5" /> Copy as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setCompact((c) => !c)}>
              {compact ? <Eye className="mr-2 h-3.5 w-3.5" /> : <EyeOff className="mr-2 h-3.5 w-3.5" />}
              {compact ? "Detailed view" : "Compact view"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                const w = wave?.find((x) => x.week === wn);
                const tag = w?.tag ?? null;
                const rpeRange =
                  w && w.rpe_low != null && w.rpe_high != null
                    ? `RPE ${formatRpe(w.rpe_low)}–${formatRpe(w.rpe_high)}`
                    : null;
                const tagLabel =
                  tag === "+volume"
                    ? "+volume"
                    : tag === "+intensity"
                    ? "+intensidade"
                    : tag === "deload"
                    ? "deload"
                    : tag === "base"
                    ? "base"
                    : null;
                return (
                  <th
                    key={wn}
                    className={`px-2 py-2 text-left font-semibold align-top ${
                      tag === "deload" || isDeloadWeek(wn) ? "text-amber-300/80" : ""
                    }`}
                  >
                    <div>
                      Week {wn}
                      {tagLabel ? ` · ${tagLabel}` : isDeloadWeek(wn) ? " · deload" : ""}
                    </div>
                    {rpeRange ? (
                      <div className="mt-0.5 text-[9px] font-normal normal-case tracking-normal text-muted-foreground/70">
                        {rpeRange}
                        {t?.rpe != null && (
                          <span className="opacity-70"> · obs. {formatRpe(t.rpe)}</span>
                        )}
                      </div>
                    ) : t?.rpe != null ? (
                      <div className="mt-0.5 text-[9px] font-normal normal-case tracking-normal text-muted-foreground/70">
                        {t.rpeMin != null && t.rpeMax != null && t.rpeMin !== t.rpeMax
                          ? `RPE ${formatRpe(t.rpeMin)}–${formatRpe(t.rpeMax)} · med ${formatRpe(t.rpe)}`
                          : `RPE ${formatRpe(t.rpe)}`}
                      </div>
                    ) : null}
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
                planId={planId}
                editingKey={editingKey}
                setEditingKey={setEditingKey}
                patches={patches}
                onSaveEdit={saveEdit}
                onRemoveExercise={removeExercise}
                onAdded={() => onUpdated?.()}
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
  planId,
  editingKey,
  setEditingKey,
  patches,
  onSaveEdit,
  onRemoveExercise,
  onAdded,
  deletingName,
  isFirstGroup,
}: {
  day: Day;
  rows: { exercise: Exercise; cells: { ex: Exercise | null; weekNumber: number; dayLabel: string; exIdx: number }[] }[];
  weekCount: number;
  compact: boolean;
  editable: boolean;
  planId?: string;
  editingKey: string | null;
  setEditingKey: (k: string | null) => void;
  patches: Record<string, Partial<Exercise>>;
  onSaveEdit: (key: string, weekNumber: number, dayLabel: string, exIdx: number, patch: Partial<Exercise>) => void;
  onRemoveExercise: (dayLabel: string, exerciseName: string) => void;
  onAdded: () => void;
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
      {editable && planId && (
        <tr>
          <td colSpan={weekCount + 1} className="bg-card px-3 py-1.5">
            <AddExerciseDialog
              planId={planId}
              dayLabel={day.day_label}
              existingNames={rows.map((r) => r.exercise.name)}
              onAdded={onAdded}
            />
          </td>
        </tr>
      )}
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
        {rpe ? (
          (() => {
            const tn = rpeTone(parseRpeShared(rpe));
            return (
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold leading-none ${tn.pill} ${rpeChanged ? "ring-2" : ""}`}
                title={`RPE ${rpe} · ${tn.label}`}
              >
                {rpe}
                {!isFirst && rpeTrend && (
                  <span className="ml-0.5 opacity-70">{rpeTrend}</span>
                )}
              </span>
            );
          })()
        ) : (
          <span className="text-muted-foreground/40">@—</span>
        )}
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
  const labelCls = "text-[8px] font-bold uppercase tracking-widest text-muted-foreground";

  return (
    <td className="px-1.5 py-1 align-top">
      <div className="grid grid-cols-2 gap-x-1 gap-y-1.5" onKeyDown={onKey}>
        <label className="flex flex-col gap-0.5"><span className={labelCls}>Sets</span>
          <input className={inputCls} value={sets} onChange={(e) => setSets(e.target.value)} autoFocus />
        </label>
        <label className="flex flex-col gap-0.5"><span className={labelCls}>Reps</span>
          <input className={inputCls} value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
        <label className="flex flex-col gap-0.5"><span className={labelCls}>RPE</span>
          <input className={inputCls} value={rpe} onChange={(e) => setRpe(e.target.value)} />
        </label>
        <label className="flex flex-col gap-0.5"><span className={labelCls}>Rest</span>
          <input className={inputCls} value={rest} onChange={(e) => setRest(e.target.value)} />
        </label>
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

/** Strip trailing .0 so "RPE 7.0" reads "RPE 7" but "RPE 7.5" stays whole. */
function formatRpe(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
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