import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateDayContent } from "@/server/phased/stage3-microcycle.functions";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Save, Pencil, X } from "lucide-react";
import { toast } from "sonner";

type DayRow = {
  id: string;
  day_number: number;
  status: "pending" | "done" | "error";
  day_label: string;
  focus: string;
  rationale: string;
  content: any;
};

type EditableExercise = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  rpe: string;
  cue: string;
};

function toEditable(ex: any): EditableExercise {
  return {
    name: ex?.name ?? "",
    sets: String(ex?.sets ?? ""),
    reps: String(ex?.reps ?? ""),
    rest: String(ex?.rest ?? ""),
    rpe: String(ex?.rpe ?? ""),
    cue: String(ex?.cue ?? ""),
  };
}

export function DayCardEditable({
  day,
  dayIndex,
  planId,
  isGate,
  onRegen,
  onApproveDay1,
}: {
  day?: DayRow;
  dayIndex?: number;
  planId: string;
  isGate?: boolean;
  onRegen: () => void;
  onApproveDay1?: () => void;
}) {
  const idx = day?.day_number ?? dayIndex ?? 0;
  const updateFn = useServerFn(updateDayContent);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState(day?.focus ?? "");
  const [rationale, setRationale] = useState(day?.rationale ?? "");
  const [exercises, setExercises] = useState<EditableExercise[]>(
    ((day?.content?.exercises ?? []) as any[]).map(toEditable),
  );

  useEffect(() => {
    if (!editing && day) {
      setFocus(day.focus ?? "");
      setRationale(day.rationale ?? "");
      setExercises(((day.content?.exercises ?? []) as any[]).map(toEditable));
    }
  }, [day, editing]);

  if (!day) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        Day {idx} — queued
      </div>
    );
  }

  if (day.status === "pending") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        Day {idx} — generating…
      </div>
    );
  }

  if (day.status === "error") {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Day {idx} failed
          </div>
          <button
            onClick={onRegen}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    const res = await updateFn({
      data: {
        planId,
        dayId: day!.id,
        focus,
        rationale,
        exercises,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Save failed");
      return;
    }
    toast.success(`Day ${idx} saved`);
    setEditing(false);
  }

  function updateEx(i: number, patch: Partial<EditableExercise>) {
    setExercises((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            {/* day_label often already begins with "Day N — …", so strip a leading
             * "Day N" / "Day N -" / "Day N —" to avoid "Day 1 · Day 1 — …". */}
            Day {idx}
            {(() => {
              const cleaned = (day.day_label ?? "")
                .replace(/^\s*Day\s*\d+\s*[-–—:·]?\s*/i, "")
                .trim();
              return cleaned ? <span className="text-muted-foreground"> · {cleaned}</span> : null;
            })()}
          </h2>
          {editing ? (
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
              placeholder="Focus"
            />
          ) : (
            <p className="text-xs text-muted-foreground">{day.focus}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={onRegen}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
              >
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          className="mb-3 w-full rounded border border-border bg-background px-2 py-1 text-xs"
          placeholder="Rationale"
        />
      ) : (
        day.rationale && (
          <p className="mb-3 rounded bg-muted/50 p-2 text-xs text-muted-foreground">{day.rationale}</p>
        )
      )}

      <ul className="space-y-1.5">
        {exercises.map((ex, i) => (
          <li key={i} className="rounded border border-border/60 px-3 py-2 text-sm">
            {editing ? (
              <div className="space-y-1.5">
                <input
                  value={ex.name}
                  onChange={(e) => updateEx(i, { name: e.target.value })}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm font-medium"
                  placeholder="Exercise name"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  <input
                    value={ex.sets}
                    onChange={(e) => updateEx(i, { sets: e.target.value })}
                    placeholder="Sets"
                    className="rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                  <input
                    value={ex.reps}
                    onChange={(e) => updateEx(i, { reps: e.target.value })}
                    placeholder="Reps"
                    className="rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                  <input
                    value={ex.rpe}
                    onChange={(e) => updateEx(i, { rpe: e.target.value })}
                    placeholder="RPE"
                    className="rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                  <input
                    value={ex.rest}
                    onChange={(e) => updateEx(i, { rest: e.target.value })}
                    placeholder="Rest"
                    className="rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                </div>
                <input
                  value={ex.cue}
                  onChange={(e) => updateEx(i, { cue: e.target.value })}
                  placeholder="Cue"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
              </div>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{ex.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {ex.sets}×{ex.reps} @ RPE {ex.rpe} · rest {ex.rest}
                  </span>
                </div>
                {ex.cue && <div className="mt-1 text-xs text-muted-foreground">{ex.cue}</div>}
              </>
            )}
          </li>
        ))}
      </ul>

      {isGate && onApproveDay1 && !editing && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-foreground">
            Day 1 looks good? Approve to unlock generating the rest of the week.
          </p>
          <button
            onClick={onApproveDay1}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <CheckCircle2 className="h-4 w-4" /> Approve Day 1
          </button>
        </div>
      )}
    </section>
  );
}
