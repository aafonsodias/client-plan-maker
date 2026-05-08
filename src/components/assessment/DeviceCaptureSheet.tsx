import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { addCapacitySnapshot } from "@/server/capacity.functions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import type { DeviceSpec } from "@/lib/devices";
import { JAMAR } from "@/lib/devices";

/**
 * Generic device-capture surface. Renders a Sheet with one input per
 * `DeviceSpec.fields` entry; each filled-in field becomes a separate
 * `client_capacity_snapshots` row on submit.
 *
 * Special-cases the Jamar dynamometer so that the 3 attempts per hand
 * collapse into a single best-per-hand snapshot (with the raw attempts
 * recorded in `notes` for auditability).
 */
export function DeviceCaptureSheet({
  clientId,
  device,
  open,
  onOpenChange,
  onSaved,
}: {
  clientId: string;
  device: DeviceSpec;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const submit = useServerFn(addCapacitySnapshot);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [model, setModel] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);

  const isJamar = device.id === JAMAR.id;

  const basicFields = useMemo(() => device.fields.filter((f) => !f.advanced), [device]);
  const advancedFields = useMemo(() => device.fields.filter((f) => f.advanced), [device]);

  const setField = (k: string, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  // Jamar derived values (best per hand + asymmetry).
  const jamarSummary = useMemo(() => {
    if (!isJamar) return null;
    const num = (k: string) => {
      const n = Number((values[k] ?? "").replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const right = [num("right_t1"), num("right_t2"), num("right_t3")].filter((n): n is number => n != null);
    const left = [num("left_t1"), num("left_t2"), num("left_t3")].filter((n): n is number => n != null);
    const bestR = right.length ? Math.max(...right) : null;
    const bestL = left.length ? Math.max(...left) : null;
    let asym: number | null = null;
    if (bestR != null && bestL != null) {
      const max = Math.max(bestR, bestL);
      const min = Math.min(bestR, bestL);
      if (max > 0) asym = Math.round(((max - min) / max) * 100);
    }
    return { bestR, bestL, asym };
  }, [values, isJamar]);

  function reset() {
    setValues({});
    setNotes("");
    setModel("");
    setShowAdvanced(false);
  }

  async function onSubmit() {
    setBusy(true);
    try {
      const measuredAt = new Date().toISOString();
      const trail = `${device.label}${model ? ` (${model})` : ""}${notes ? ` — ${notes}` : ""}`;
      const writes: Promise<unknown>[] = [];

      if (isJamar && jamarSummary) {
        // One snapshot per hand, value = best of 3.
        if (jamarSummary.bestR != null) {
          writes.push(
            submit({
              data: {
                clientId,
                domainSlug: "muscular_endurance",
                testUsed: "grip_right",
                rawValue: jamarSummary.bestR,
                rawUnit: "kg",
                measuredAt,
                notes: `Jamar — D tentativas: ${["right_t1","right_t2","right_t3"].map((k)=>values[k]??"–").join(" / ")}${trail ? ` · ${trail}` : ""}`,
              },
            }),
          );
        }
        if (jamarSummary.bestL != null) {
          writes.push(
            submit({
              data: {
                clientId,
                domainSlug: "muscular_endurance",
                testUsed: "grip_left",
                rawValue: jamarSummary.bestL,
                rawUnit: "kg",
                measuredAt,
                notes: `Jamar — E tentativas: ${["left_t1","left_t2","left_t3"].map((k)=>values[k]??"–").join(" / ")}${trail ? ` · ${trail}` : ""}`,
              },
            }),
          );
        }
      } else {
        for (const f of device.fields) {
          const raw = values[f.key];
          if (!raw || raw.trim() === "") continue;
          const num = Number(raw.replace(",", "."));
          if (!Number.isFinite(num)) continue;
          writes.push(
            submit({
              data: {
                clientId,
                domainSlug: f.domain,
                testUsed: f.testUsed,
                rawValue: num,
                rawUnit: f.unit,
                measuredAt,
                notes: trail,
              },
            }),
          );
        }
      }

      if (writes.length === 0) {
        toast.error("Preencha pelo menos um campo.");
        setBusy(false);
        return;
      }
      await Promise.all(writes);
      toast.success(`${writes.length} ${writes.length === 1 ? "medição gravada" : "medições gravadas"}.`);
      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha a gravar medições.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{device.label}</SheetTitle>
          <SheetDescription>{device.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {basicFields.map((f) => (
              <FieldRow
                key={f.key}
                label={f.label}
                unit={f.unit}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(v) => setField(f.key, v)}
              />
            ))}
          </div>

          {isJamar && (jamarSummary?.bestR != null || jamarSummary?.bestL != null) && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-xs">
              <div className="font-semibold text-foreground">Resumo</div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-foreground/80">
                <div>Melhor D: <span className="font-mono tabular-nums">{jamarSummary?.bestR != null ? `${jamarSummary.bestR.toFixed(1)} kg` : "—"}</span></div>
                <div>Melhor E: <span className="font-mono tabular-nums">{jamarSummary?.bestL != null ? `${jamarSummary.bestL.toFixed(1)} kg` : "—"}</span></div>
                <div>Assimetria: <span className="font-mono tabular-nums">{jamarSummary?.asym != null ? `${jamarSummary.asym} %` : "—"}</span></div>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Assimetria &gt; 10–15 % normalmente é bandeira amarela em adultos saudáveis.
              </p>
            </div>
          )}

          {advancedFields.length > 0 && (
            <div className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-secondary/50"
              >
                <span>Avançado · {advancedFields.length} campos extra (segmental, BMR, idade metabólica)</span>
                {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 gap-3 border-t border-border p-3 sm:grid-cols-2">
                  {advancedFields.map((f) => (
                    <FieldRow
                      key={f.key}
                      label={f.label}
                      unit={f.unit}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(v) => setField(f.key, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Modelo (opcional)</Label>
              <Input className="h-8 text-sm" value={model} onChange={(e) => setModel(e.target.value)} placeholder={isJamar ? "ex. Jamar Plus+" : "ex. Tanita BC-601"} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas (opcional)</Label>
              <Input className="h-8 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex. medição de manhã, em jejum" />
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Gravar medições
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FieldRow({
  label,
  unit,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          className="h-8 pr-12 text-sm"
          inputMode="decimal"
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}
