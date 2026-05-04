import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Heart, Ruler, Timer, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordMeasurement } from "@/server/measurements.functions";

/**
 * Re-assessment metrics editor. Designed for the periodic cadence (every
 * 14d by default) — captures the small set of objective markers that
 * actually move under structured training, without re-doing the full
 * intake. Writes a single `client_measurements` row (cadence='periodic')
 * with everything inside the `values` jsonb. No schema change required.
 *
 * Field set (chosen for honesty + easy to repeat in any gym):
 *  - Cardio: VO₂max estimate (submax) + RHR
 *  - Strength holds: dead-hang / active-hang (s), plank (s)
 *  - Lower body capacity: box squats (reps @ bodyweight)
 *  - Resting BP (systolic/diastolic) — 5-min seated rest protocol copy
 *  - 6 circumferences (cm): waist, hip, chest, arm, thigh, calf
 */

type Values = Record<string, number | "">;

const FIELDS: Array<{
  key: string;
  label: string;
  unit: string;
  group: "cardio" | "strength" | "bp" | "girth";
  step?: string;
}> = [
  { key: "vo2max", label: "VO₂máx (submax)", unit: "ml/kg/min", group: "cardio", step: "0.1" },
  { key: "rhr", label: "FC repouso", unit: "bpm", group: "cardio" },
  { key: "dead_hang_s", label: "Suspensão passiva", unit: "s", group: "strength" },
  { key: "active_hang_s", label: "Suspensão activa", unit: "s", group: "strength" },
  { key: "plank_s", label: "Prancha", unit: "s", group: "strength" },
  { key: "box_squats_reps", label: "Box squats (peso corporal)", unit: "reps", group: "strength" },
  { key: "bp_systolic", label: "TA sistólica", unit: "mmHg", group: "bp" },
  { key: "bp_diastolic", label: "TA diastólica", unit: "mmHg", group: "bp" },
  { key: "waist_cm", label: "Cintura", unit: "cm", group: "girth", step: "0.1" },
  { key: "hip_cm", label: "Anca", unit: "cm", group: "girth", step: "0.1" },
  { key: "chest_cm", label: "Peito", unit: "cm", group: "girth", step: "0.1" },
  { key: "arm_cm", label: "Braço (relaxado)", unit: "cm", group: "girth", step: "0.1" },
  { key: "thigh_cm", label: "Coxa", unit: "cm", group: "girth", step: "0.1" },
  { key: "calf_cm", label: "Gémeo", unit: "cm", group: "girth", step: "0.1" },
];

const GROUPS: Array<{ id: "cardio" | "strength" | "bp" | "girth"; label: string; icon: any }> = [
  { id: "cardio", label: "Cardio", icon: Heart },
  { id: "strength", label: "Força · resistência", icon: Timer },
  { id: "bp", label: "Tensão arterial", icon: Activity },
  { id: "girth", label: "Circunferências", icon: Ruler },
];

export function ReassessmentSheet({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [values, setValues] = useState<Values>({});
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const cleaned = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== null && !Number.isNaN(v)),
      ) as Record<string, number>;
      if (Object.keys(cleaned).length === 0) {
        throw new Error("Nada para guardar — preenche pelo menos um campo.");
      }
      return recordMeasurement({
        data: {
          clientId,
          cadence: "periodic",
          values: cleaned,
          notes: notes.trim() || undefined,
        },
      });
    },
    onSuccess: (r: any) => {
      if (r?.ok === false) {
        toast.error(r.error ?? "Falha ao guardar");
        return;
      }
      toast.success("Reavaliação registada");
      setValues({});
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["measurements", clientId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao guardar"),
  });

  const setVal = (k: string, raw: string) => {
    if (raw === "") {
      setValues((v) => ({ ...v, [k]: "" }));
      return;
    }
    const n = Number(raw);
    setValues((v) => ({ ...v, [k]: Number.isFinite(n) ? n : "" }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Reavaliação periódica</SheetTitle>
          <SheetDescription>
            Marcadores objectivos para repetir a cada 14 dias. Preenche só o que mediste.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {GROUPS.map((g) => {
            const Icon = g.icon;
            const fields = FIELDS.filter((f) => f.group === g.id);
            return (
              <section key={g.id} className="rounded-xl border border-border bg-card/50 p-3">
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {g.label}
                  </h3>
                </div>
                {g.id === "bp" && (
                  <p className="mb-3 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-300">
                    Protocolo: 5 min sentado em repouso, costas apoiadas, pés no chão. Mede 2× e regista a média.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {fields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label htmlFor={f.key} className="text-[11px] text-muted-foreground">
                        {f.label}{" "}
                        <span className="opacity-60">· {f.unit}</span>
                      </Label>
                      <Input
                        id={f.key}
                        inputMode="decimal"
                        type="number"
                        step={f.step ?? "1"}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setVal(f.key, e.target.value)}
                        className="h-8 text-sm tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="space-y-1">
            <Label htmlFor="notes" className="text-[11px] text-muted-foreground">
              Notas (opcional)
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex: cliente queixou-se de gémeo direito"
              className="h-8 text-sm"
            />
          </div>

          <div className="sticky bottom-0 -mx-6 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={save.isPending}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={save.isPending}
              >
                {save.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Guardar reavaliação
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}