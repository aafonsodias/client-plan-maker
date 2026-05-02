import { useMemo, useState } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AutoTextarea } from "@/components/AutoTextarea";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { saveTrainerSession } from "@/server/sessions.functions";
import type { PlanData, Day } from "@/lib/pdf";

/**
 * "Importar registo" — manual mirror of the printed Folha de registo.
 * Trainer picks a week + day, then for each prescribed exercise types in what
 * actually happened in the gym (sets×reps @ load, plus optional notes).
 * Persists as a `workout_sessions` row via `saveTrainerSession`.
 */
export function ImportLogDialog({
  planId,
  plan,
  onSaved,
}: {
  planId: string;
  plan: PlanData;
  onSaved?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [weekNum, setWeekNum] = useState<number>(plan.weeks[0]?.week_number ?? 1);
  const [dayLabel, setDayLabel] = useState<string>(plan.weeks[0]?.days?.[0]?.day_label ?? "");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Record<string, { reps: string; weight: string; notes: string }>>({});
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveTrainerSession);

  const week = useMemo(
    () => plan.weeks.find((w) => w.week_number === weekNum),
    [plan, weekNum],
  );
  const day: Day | undefined = useMemo(
    () => week?.days?.find((d) => d.day_label === dayLabel),
    [week, dayLabel],
  );

  const setEx = (name: string, patch: Partial<{ reps: string; weight: string; notes: string }>) => {
    setRows((prev) => {
      const cur = prev[name] ?? { reps: "", weight: "", notes: "" };
      return { ...prev, [name]: { ...cur, ...patch } };
    });
  };

  const submit = async () => {
    if (!day) return;
    setSaving(true);
    try {
      const entries = (day.exercises ?? []).map((ex) => {
        const cur = rows[ex.name] ?? { reps: "", weight: "", notes: "" };
        return {
          exercise_name: ex.name,
          planned: {
            sets: ex.sets ?? "",
            reps: ex.reps ?? "",
            rest: ex.rest ?? "",
            notes: ex.notes ?? "",
          },
          actual: {
            sets: ex.sets ?? "",
            reps: cur.reps,
            weight: cur.weight,
            notes: cur.notes,
          },
        };
      });
      await save({
        data: {
          plan_id: planId,
          week_number: weekNum,
          day_label: dayLabel,
          session_date: date,
          session_notes: notes,
          entries,
        },
      });
      toast.success("Registo importado");
      setOpen(false);
      setRows({});
      setNotes("");
      await onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível importar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8" title="Importar valores escritos na folha de registo">
          <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" /> Importar registo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar valores da folha de registo</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Semana</span>
            <select
              value={weekNum}
              onChange={(e) => {
                const n = Number(e.target.value);
                setWeekNum(n);
                const w = plan.weeks.find((x) => x.week_number === n);
                setDayLabel(w?.days?.[0]?.day_label ?? "");
              }}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            >
              {plan.weeks.map((w) => (
                <option key={w.week_number} value={w.week_number}>
                  Semana {w.week_number}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Sessão</span>
            <select
              value={dayLabel}
              onChange={(e) => setDayLabel(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            >
              {(week?.days ?? []).map((d) => (
                <option key={d.day_label} value={d.day_label}>
                  {d.day_label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Data</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">Exercício</th>
                <th className="px-2 py-1.5 text-left">Prescrito</th>
                <th className="px-2 py-1.5 text-left">Reps reais</th>
                <th className="px-2 py-1.5 text-left">Carga</th>
                <th className="px-2 py-1.5 text-left">Notas</th>
              </tr>
            </thead>
            <tbody>
              {(day?.exercises ?? []).map((ex) => {
                const cur = rows[ex.name] ?? { reps: "", weight: "", notes: "" };
                return (
                  <tr key={ex.name} className="border-t border-border">
                    <td className="px-2 py-1.5 font-medium">{ex.name}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {ex.sets}×{ex.reps} @ RPE {ex.rpe}
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-7 text-xs"
                        value={cur.reps}
                        onChange={(e) => setEx(ex.name, { reps: e.target.value })}
                        placeholder="ex. 8,8,7"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-7 text-xs"
                        value={cur.weight}
                        onChange={(e) => setEx(ex.name, { weight: e.target.value })}
                        placeholder="ex. 40kg"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-7 text-xs"
                        value={cur.notes}
                        onChange={(e) => setEx(ex.name, { notes: e.target.value })}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                );
              })}
              {(day?.exercises ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    Sem exercícios prescritos para esta sessão.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">Notas da sessão</span>
          <AutoTextarea
            minRows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sentiu fadiga, técnica, tempo total…"
          />
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !day}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Guardar registo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}