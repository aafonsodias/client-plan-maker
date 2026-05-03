import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Beaker, Zap, Activity, Loader2, Check, X, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { advanceSimulation } from "@/server/demo-sessions.functions";
import { useAuth } from "@/hooks/use-auth";
import { useDemoRuns, DEMO_RUN_STAGES } from "@/contexts/DemoRunsContext";

/**
 * Founder-only Demo Lab: creates a fully realistic demo client (client +
 * assessment + plan + logbook) with one click. Generations now run via the
 * global DemoRunsProvider so the trainer can navigate the app while the
 * pipeline is running and gets a toast (with "Abrir plano" action) when it
 * finishes. The inline gate list mirrors the same context state so this
 * panel stays informative when the user is on /dashboard.
 */
export function DemoLabPanel() {
  const { user } = useAuth();
  const { runs, startRun, cancelRun } = useDemoRuns();
  const tickFn = useServerFn(advanceSimulation);
  const [busy, setBusy] = useState<"tick" | null>(null);
  const [durationWeeks, setDurationWeeks] = useState<4 | 6 | 8>(4);

  if (!user || user.email !== "aafonsodias@gmail.com") return null;

  // Track the last run started from this panel so the inline gate list
  // shows the matching progress. If the run is gone (cleaned up after
  // completion), fall back to the most recent active run if any.
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const trackedRun =
    (lastRunId ? runs.find((r) => r.runId === lastRunId) : null) ??
    runs.find((r) => r.status !== "done" && r.status !== "failed" && !r.cancelled) ??
    null;
  const stageIdx = trackedRun
    ? DEMO_RUN_STAGES.findIndex((s) => s.key === trackedRun.stage)
    : -1;

  const runInstant = async () => {
    if (trackedRun && trackedRun.status !== "done" && trackedRun.status !== "failed") return;
    const id = await startRun({ durationWeeks });
    if (id) setLastRunId(id);
  };

  const cancelInstant = async () => {
    if (!trackedRun) return;
    await cancelRun(trackedRun.runId);
  };

  const runTick = async () => {
    if (busy) return;
    setBusy("tick");
    try {
      const res: any = await tickFn();
      if (res?.ticked > 0) toast.success(`${res.ticked} sessões adicionadas.`);
      else toast.info(res?.message ?? "Nada para avançar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  };

  const SegBtn = <T extends string | number>({
    value,
    current,
    onClick,
    children,
  }: {
    value: T;
    current: T;
    onClick: (v: T) => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => onClick(value)}
      disabled={busy !== null}
      className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
        value === current
          ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
          : "border-amber-500/20 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  const isRunning = !!trackedRun && trackedRun.status !== "done" && trackedRun.status !== "failed" && !trackedRun.cancelled;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Beaker className="h-4 w-4 text-amber-500" />
        <p className="text-xs uppercase tracking-widest text-amber-500/90">Demo Lab · Founder only</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Duração (= semanas de logbook)
          </span>
          <SegBtn value={4} current={durationWeeks} onClick={(v) => setDurationWeeks(v as 4 | 6 | 8)}>4 sem</SegBtn>
          <SegBtn value={6} current={durationWeeks} onClick={(v) => setDurationWeeks(v as 4 | 6 | 8)}>6 sem</SegBtn>
          <SegBtn value={8} current={durationWeeks} onClick={(v) => setDurationWeeks(v as 4 | 6 | 8)}>8 sem</SegBtn>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void runInstant()}
          disabled={isRunning}
          className="border-amber-500/40"
        >
          {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          Instant: cliente + plano + logbook
        </Button>
        {isRunning && (
          <Button size="sm" variant="ghost" onClick={() => void cancelInstant()} className="text-amber-400 hover:text-amber-300">
            <Square className="mr-2 h-4 w-4" /> Parar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void runTick()}
          disabled={busy !== null || isRunning}
          className="border-amber-500/40"
        >
          {busy === "tick" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          Avançar simulação (+1 sessão / cliente demo)
        </Button>
      </div>
      {trackedRun ? (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-background/40 p-3">
          <ol className="space-y-1.5 text-[11px]">
            {DEMO_RUN_STAGES.map((g, i) => {
              const s =
                trackedRun.status === "failed" && i === stageIdx
                  ? "failed"
                  : i < stageIdx
                  ? "done"
                  : i === stageIdx
                  ? trackedRun.status === "done"
                    ? "done"
                    : "running"
                  : "idle";
              const Icon = s === "done" ? Check : s === "failed" ? X : s === "running" ? Loader2 : null;
              const tone =
                s === "done"
                  ? "text-emerald-400"
                  : s === "failed"
                  ? "text-red-400"
                  : s === "running"
                  ? "text-amber-300"
                  : "text-muted-foreground/60";
              return (
                <li key={g.key} className={`flex items-center gap-2 ${tone}`}>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current/40">
                    {Icon ? <Icon className={`h-3 w-3 ${s === "running" ? "animate-spin" : ""}`} /> : null}
                  </span>
                  <span>{g.label}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Podes navegar para outras páginas — vais ver o progresso no canto inferior direito e receber um aviso quando terminar.
          </p>
        </div>
      ) : null}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Cria um cliente fictício realista, gera o plano completo (brief → blueprint → microciclo → progressões)
        e enche o logbook até ao fim da duração escolhida. Não conta para a tua quota.
      </p>
    </div>
  );
}
