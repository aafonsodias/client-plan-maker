import { useRef, useState } from "react";
import { Camera, Loader2, X, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractSessionFromImage } from "@/server/sessions-ocr.functions";
import type { LogEntryV2 } from "./ExerciseSetsCard";

type ExtractedEntry = {
  exercise_name: string;
  matched: boolean;
  sets: Array<{ reps: string; weight: string; rpe: string }>;
};

type Props = {
  token: string;
  planId: string;
  weekNumber: number;
  dayLabel: string;
  /** Current entries in the form, in plan order. We merge into these positionally. */
  entries: LogEntryV2[];
  onApply: (mergedEntries: LogEntryV2[], notesAppend: string | null) => void;
};

const MAX_BYTES = 5 * 1024 * 1024; // 5MB raw file (data URL ≈ 6.7MB)

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não consegui ler o ficheiro."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

export function ImportFromPhotoButton({
  token,
  planId,
  weekNumber,
  dayLabel,
  entries,
  onApply,
}: Props) {
  const ocrFn = useServerFn(extractSessionFromImage);
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{
    confidence: number;
    notes: string;
    entries: ExtractedEntry[];
  } | null>(null);

  const reset = () => {
    setBusy(false);
    setPreviewUrl(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("Ficheiro maior que 5MB. Tira foto com menos resolução ou recorta.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewUrl(dataUrl);
      const res = await ocrFn({
        data: {
          token,
          plan_id: planId,
          week_number: weekNumber,
          day_label: dayLabel,
          image_data_url: dataUrl,
        },
      });
      setResult({
        confidence: res.overall_confidence,
        notes: res.notes_excerpt ?? "",
        entries: res.entries,
      });
      toast.success("Foto lida. Revê os valores antes de aplicar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui processar a foto.");
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    // Positional merge: result.entries[i] → entries[i] when i is in range.
    // Only fill set fields that the OCR returned non-empty AND that are
    // currently empty (don't overwrite a value the user already typed).
    const next = entries.map((e, i) => {
      const ocr = result.entries[i];
      if (!ocr || !ocr.matched) return e;
      const mergedSets = e.sets.map((s, si) => {
        const o = ocr.sets[si];
        if (!o) return s;
        const reps = s.reps?.trim() ? s.reps : o.reps;
        const weight = s.weight?.trim() ? s.weight : o.weight;
        const rpe = (s.rpe ?? "").trim() ? (s.rpe ?? "") : o.rpe;
        const becameFilled = !!(reps && weight);
        return {
          ...s,
          reps,
          weight,
          rpe,
          // mark done if reps + weight present and user hadn't toggled yet
          done: s.done || becameFilled,
        };
      });
      return { ...e, sets: mergedSets };
    });
    onApply(next, result.notes ? result.notes : null);
    setOpen(false);
    reset();
  };

  const confidencePct = result ? Math.round(result.confidence * 100) : 0;
  const confidenceTone =
    confidencePct >= 80 ? "text-emerald-400" : confidencePct >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Camera className="h-3.5 w-3.5" />
        Importar de foto
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar registo de uma foto</DialogTitle>
            <DialogDescription>
              Tira foto à folha de treino preenchida à mão. A IA lê os valores e tu confirmas antes de aplicar.
            </DialogDescription>
          </DialogHeader>

          {!result && (
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/40 px-4 py-10 text-sm text-muted-foreground transition hover:border-accent hover:bg-secondary/60 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                    <span>A ler a foto…</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-6 w-6 text-accent" />
                    <span className="font-medium text-foreground">Carrega ou tira foto</span>
                    <span className="text-xs">JPG ou PNG, até 5MB. Boa luz, perpendicular à folha.</span>
                  </>
                )}
              </button>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="mx-auto max-h-48 rounded-lg border border-border object-contain"
                />
              )}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Confiança da leitura:{" "}
                  <span className={`font-bold ${confidenceTone}`}>{confidencePct}%</span>
                </span>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    Ver foto
                  </a>
                )}
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {entries.map((e, i) => {
                  const ocr = result.entries[i];
                  if (!ocr || !ocr.matched) {
                    return (
                      <div
                        key={`${e.exercise_name}-${i}`}
                        className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-2 text-xs"
                      >
                        <div className="font-medium">{e.exercise_name}</div>
                        <div className="text-muted-foreground">
                          Sem leitura — preenche manualmente.
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`${e.exercise_name}-${i}`}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
                    >
                      <div className="mb-1 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        {e.exercise_name}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ocr.sets.map((s, si) => (
                          <span
                            key={si}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-0.5 tabular-nums"
                          >
                            <span className="text-muted-foreground">S{si + 1}</span>
                            <span className="font-medium">
                              {s.reps || "—"}×{s.weight || "—"}
                            </span>
                            {s.rpe && <span className="text-amber-400">@{s.rpe}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {result.notes && (
                <div className="rounded-lg border border-border bg-secondary/40 p-2 text-xs">
                  <div className="mb-1 font-semibold text-muted-foreground">Notas detectadas</div>
                  <div className="italic">{result.notes}</div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {result && (
              <Button variant="ghost" onClick={reset} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Tentar outra foto
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancelar
            </Button>
            {result && (
              <Button onClick={apply} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Aplicar valores
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}