import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pause, Play, X, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { runDemoPlay, DEMO_PLAY_STEPS, type DemoPlayStep } from "@/server/demo-play.functions";
import { DemoMaquetteDialog } from "@/components/DemoMaquetteDialog";

const STEP_LABELS: Record<DemoPlayStep, string> = {
  brief_generate: "A sintetizar brief",
  brief_approve: "A aprovar brief",
  blueprint_generate: "A gerar blueprint",
  blueprint_approve: "A aprovar blueprint",
  microcycle_generate: "A gerar microciclo",
  microcycle_approve: "A aprovar microciclo",
  progressions_generate: "A propor progressões",
  progressions_approve: "A aprovar progressões",
  finalize: "A finalizar plano",
};

/**
 * DemoOrchestrator — tiny HUD that runs runDemoPlay end-to-end and opens
 * the maquette dialog when finished. Theatrical "scroll-to-advance" detail
 * is conveyed by animating the active-step label in the HUD; the heavy
 * lifting happens server-side in one call so it works regardless of which
 * page sections actually exist.
 */
export function DemoOrchestrator({
  clientId,
  enabled,
  onDone,
}: {
  clientId: string;
  enabled: boolean;
  onDone?: () => void;
}) {
  const runFn = useServerFn(runDemoPlay);
  const startedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState<DemoPlayStep[]>([]);
  const [activeStep, setActiveStep] = useState<DemoPlayStep | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [failedStep, setFailedStep] = useState<DemoPlayStep | null>(null);

  // Theatrical step ticker — advances visually while the server call runs.
  useEffect(() => {
    if (!running) return;
    let i = 0;
    setActiveStep(DEMO_PLAY_STEPS[0]);
    const interval = setInterval(() => {
      if (paused) return;
      i = Math.min(i + 1, DEMO_PLAY_STEPS.length - 1);
      setActiveStep(DEMO_PLAY_STEPS[i]);
      setCompleted(DEMO_PLAY_STEPS.slice(0, i));
    }, 2200);
    return () => clearInterval(interval);
  }, [running, paused]);

  useEffect(() => {
    if (!enabled || startedRef.current || dismissed) return;
    startedRef.current = true;
    setRunning(true);
    setCompleted([]);
    setFailedStep(null);
    void (async () => {
      try {
        const res: any = await runFn({ data: { clientId } });
        if (!res?.ok) {
          setFailedStep(res?.failedStep ?? null);
          setCompleted(res?.completed ?? []);
          toast.error(`Demo parou em "${STEP_LABELS[res?.failedStep as DemoPlayStep] ?? "?"}": ${res?.error ?? "erro desconhecido"}`, { duration: 8000 });
          setRunning(false);
          return;
        }
        setCompleted(DEMO_PLAY_STEPS);
        setActiveStep(null);
        setPlanId(res.planId);
        setRunning(false);
        setDialogOpen(true);
        toast.success("Plano demo gerado");
        onDone?.();
      } catch (e: any) {
        toast.error(e?.message ?? "Demo run failed");
        setRunning(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, clientId, dismissed]);

  if (!enabled || dismissed) {
    return planId ? (
      <DemoMaquetteDialog planId={planId} open={dialogOpen} onOpenChange={setDialogOpen} />
    ) : null;
  }

  const currentIdx = activeStep ? DEMO_PLAY_STEPS.indexOf(activeStep) : completed.length;
  const total = DEMO_PLAY_STEPS.length;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl border border-accent/40 bg-card/95 backdrop-blur shadow-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-accent animate-pulse" />
            Demo · {Math.min(currentIdx + 1, total)}/{total}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="rounded-md p-1 hover:bg-muted"
              title={paused ? "Retomar" : "Pausar"}
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-md p-1 hover:bg-muted"
              title="Esconder HUD"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="space-y-1 max-h-48 overflow-auto">
          {DEMO_PLAY_STEPS.map((s) => {
            const done = completed.includes(s);
            const active = activeStep === s && running;
            const failed = failedStep === s;
            return (
              <div key={s} className="flex items-center gap-2 text-xs">
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent shrink-0" />
                ) : failed ? (
                  <X className="h-3.5 w-3.5 text-red-500 shrink-0" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                )}
                <span className={done ? "text-foreground" : active ? "text-foreground font-medium" : failed ? "text-red-500" : "text-muted-foreground"}>
                  {STEP_LABELS[s]}
                </span>
              </div>
            );
          })}
        </div>
        {failedStep && (
          <button
            type="button"
            onClick={() => { startedRef.current = false; setDismissed(false); setFailedStep(null); }}
            className="mt-2 w-full text-xs rounded-md border border-border py-1.5 hover:bg-muted"
          >
            Tentar de novo
          </button>
        )}
      </div>

      {planId && (
        <DemoMaquetteDialog planId={planId} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </>
  );
}