import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addExerciseAcrossWeeks } from "@/server/phased/microcycle-edit.functions";

/**
 * Per-day "+" button that opens a tiny dialog and inserts a new exercise
 * across every week of the plan via addExerciseAcrossWeeks. Position
 * defaults to "no fim" (append) but the trainer can choose to insert
 * after any existing exercise.
 */
export function AddExerciseDialog({
  planId,
  dayLabel,
  existingNames,
  onAdded,
}: {
  planId: string;
  dayLabel: string;
  existingNames: string[];
  onAdded: () => void;
}) {
  const addFn = useServerFn(addExerciseAcrossWeeks);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [rpe, setRpe] = useState("7");
  const [rest, setRest] = useState("90s");
  const [notes, setNotes] = useState("");
  const [insertAfter, setInsertAfter] = useState<string>("end");

  function reset() {
    setName("");
    setSets("3");
    setReps("10");
    setRpe("7");
    setRest("90s");
    setNotes("");
    setInsertAfter("end");
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("Indica o nome do exercício.");
      return;
    }
    setBusy(true);
    const insertAfterIndex = insertAfter === "end" ? -1 : Number(insertAfter);
    const res = await addFn({
      data: {
        planId,
        dayLabel,
        exercise: {
          name: name.trim(),
          sets: sets.trim() || "3",
          reps: reps.trim() || "10",
          rpe: rpe.trim() || "7",
          rest: rest.trim() || "90s",
          notes: notes.trim() || undefined,
          insertAfterIndex,
        },
      },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Falhou a adicionar o exercício.");
      return;
    }
    toast.success(`Adicionado a ${res.touched} semana${res.touched === 1 ? "" : "s"}.`);
    reset();
    setOpen(false);
    onAdded();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 bg-transparent px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-accent/60 hover:bg-accent/5 hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Adicionar exercício
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo exercício · {dayLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label htmlFor="ex-name" className="text-xs">
              Nome
            </Label>
            <Input
              id="ex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Face pull"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label htmlFor="ex-sets" className="text-xs">
                Séries
              </Label>
              <Input id="ex-sets" value={sets} onChange={(e) => setSets(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ex-reps" className="text-xs">
                Reps
              </Label>
              <Input id="ex-reps" value={reps} onChange={(e) => setReps(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ex-rpe" className="text-xs">
                RPE
              </Label>
              <Input id="ex-rpe" value={rpe} onChange={(e) => setRpe(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ex-rest" className="text-xs">
                Descanso
              </Label>
              <Input id="ex-rest" value={rest} onChange={(e) => setRest(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Inserir</Label>
            <Select value={insertAfter} onValueChange={setInsertAfter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="end">No fim do dia</SelectItem>
                {existingNames.map((n, i) => (
                  <SelectItem key={`${n}-${i}`} value={String(i)}>
                    Depois de: {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ex-notes" className="text-xs">
              Notas (opcional)
            </Label>
            <Input
              id="ex-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex. controlar fase excêntrica"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            O exercício é inserido com os mesmos valores em todas as semanas. Podes ajustar
            por semana clicando em cada célula.
          </p>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Adicionar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}