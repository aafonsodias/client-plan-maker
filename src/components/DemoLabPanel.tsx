import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Beaker, Zap, Activity, Loader2, Trophy, Check, X, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDemoClientFull, getDemoRun, cancelDemoRun } from "@/server/demo-oneshot.functions";
import { advanceSimulation } from "@/server/demo-sessions.functions";
import { useAuth } from "@/hooks/use-auth";

type GateState = "idle" | "running" | "done" | "failed";
const GATE_LABELS = [
  { key: "client", label: "Cliente + avaliação" },
  { key: "prestage", label: "Análise por secção (pré-stage)" },
  { key: "plan", label: "Plano (brief → progressões)" },
  { key: "logbook", label: "Logbook" },
  { key: "done", label: "Pronto" },
] as const;

const STAGE_ORDER = GATE_LABELS.map((g) => g.key) as readonly string[];

/**
 * Founder-only Demo Lab: creates a fully realistic demo client (client +
 * assessment + plan + logbook) with one click. Real per-stage progress now
 * comes from polling the `demo_runs` row that the server writes between
 * stages — the previous fake setInterval animation lied when stages took
 * unequal time. The cancel button writes `cancelled = true`; the runner
 * checks between stages and exits early.
 */
export function DemoLabPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const startFn = useServerFn(startDemoClientFull);
  const pollFn = useServerFn(getDemoRun);
  const cancelFn = useServerFn(cancelDemoRun);
  const tickFn = useServerFn(advanceSimulation);
  const [busy, setBusy] = useState<"instant" | "tick" | null>(null);
  const [gates, setGates] = useState<Record<string, GateState>>({});
  const [durationWeeks, setDurationWeeks] = useState<4 | 6 | 8>(4);
  const [weeksToSeed, setWeeksToSeed] = useState<1 | 2 | 4>(2);
  const runIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  if (!user || user.email !== "aafonsodias@gmail.com") return null;

  const resetGates = () => {
    setGates(Object.fromEntries(GATE_LABELS.map((g) => [g.key, "idle"])));
  };

  const applyStage = (stage: string, status: "running" | "done" | "failed") => {
    setGates((prev) => {
      const next = { ...prev };
      const idx = STAGE_ORDER.indexOf(stage);
      if (idx === -1) return prev;
      // Mark all earlier stages as done.
      for (let i = 0; i < idx; i++) next[STAGE_ORDER[i]] = "done";
      next[stage] = status;
      // Reset later stages to idle.
      for (let i = idx + 1; i < STAGE_ORDER.length; i++) {
        if (next[STAGE_ORDER[i]] !== "done") next[STAGE_ORDER[i]] = "idle";
      }
      return next;
    });
  };

  const stopPolling = () => {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  };

  const startPolling = (onComplete: (row: any) => void) => {
    stopPolling();
    pollTimerRef.current = window.setInterval(async () => {
      const id = runIdRef.current;
      if (!id) return;
      try {
        const row: any = await pollFn({ data: { runId: id } });
        if (!row) return;
        applyStage(row.stage, row.status);
        const finished =
          (row.stage === "done" && row.status === "done") ||
          row.status === "failed" ||
          row.cancelled;
        if (finished) {
          stopPolling();
          onComplete(row);
        }
      } catch {
        /* swallow — best-effort */
      }
    }, 1500);
  };

  useEffect(() => () => stopPolling(), []);

  const runInstant = async () => {
    if (busy) return;
    setBusy("instant");
    resetGates();
    applyStage("client", "running");
    try {
      // Fire-and-poll: the server returns runId in <1s and runs the rest in
      // background. We follow progress via getDemoRun and only navigate when
      // the run reaches stage="done". This avoids the upstream timeout that
      // crashed the long-running response.
      const res: any = await startFn({ data: { durationWeeks, weeksToSeed } });
      if (!res?.ok || !res?.runId) {
        applyStage("client", "failed");
        toast.error(res?.error ?? "Falhou a iniciar a simulação.");
        setBusy(null);
        return;
      }
      runIdRef.current = res.runId;
      startPolling((row) => {
        setBusy(null);
        if (row.cancelled) {
          toast.info("Simulação cancelada.");
          return;
        }
        if (row.status === "failed") {
          toast.error(`Falhou em ${row.stage ?? "?"}: ${row.error ?? "erro desconhecido"}`);
          return;
        }
        setGates(Object.fromEntries(GATE_LABELS.map((g) => [g.key, "done"])));
        toast.success(`Cliente demo + plano (${durationWeeks} sem) prontos.`);
        if (row.plan_id) {
          void navigate({ to: "/plans/$planId", params: { planId: row.plan_id } });
        }
      });
    } catch (e: any) {
      stopPolling();
      setBusy(null);
      toast.error(e?.message ?? "Erro inesperado.");
    }
  };

  const cancelInstant = async () => {
    const id = runIdRef.current;
    if (!id) {
      toast.info("Cancelamento pedido (sem runId — a chamada vai concluir).");
      return;
    }
    try {
      await cancelFn({ data: { runId: id } });
      toast.info("A pedir para parar… (stage atual termina antes de sair).");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha a cancelar.");
    }
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

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Beaker className="h-4 w-4 text-amber-500" />
        <p className="text-xs uppercase tracking-widest text-amber-500/90">Demo Lab · Founder only</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Duração</span>
          <SegBtn value={4} current={durationWeeks} onClick={(v) => setDurationWeeks(v as 4 | 6 | 8)}>4 sem</SegBtn>
          <SegBtn value={6} current={durationWeeks} onClick={(v) => setDurationWeeks(v as 4 | 6 | 8)}>6 sem</SegBtn>
          <SegBtn value={8} current={durationWeeks} onClick={(v) => setDurationWeeks(v as 4 | 6 | 8)}>8 sem</SegBtn>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Logbook</span>
          <SegBtn value={1} current={weeksToSeed} onClick={(v) => setWeeksToSeed(v as 1 | 2 | 4)}>1 sem</SegBtn>
          <SegBtn value={2} current={weeksToSeed} onClick={(v) => setWeeksToSeed(v as 1 | 2 | 4)}>2 sem</SegBtn>
          <SegBtn value={4} current={weeksToSeed} onClick={(v) => setWeeksToSeed(v as 1 | 2 | 4)}>4 sem</SegBtn>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void runInstant()}
          disabled={busy !== null}
          className="border-amber-500/40"
        >
          {busy === "instant" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          Instant: cliente + plano + logbook
        </Button>
        {busy === "instant" && (
          <Button size="sm" variant="ghost" onClick={() => void cancelInstant()} className="text-amber-400 hover:text-amber-300">
            <Square className="mr-2 h-4 w-4" /> Parar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void runTick()}
          disabled={busy !== null}
          className="border-amber-500/40"
        >
          {busy === "tick" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          Avançar simulação (+1 sessão / cliente demo)
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void navigate({ to: "/forge" })}
          disabled={busy !== null}
          className="border-amber-500/40"
        >
          <Trophy className="mr-2 h-4 w-4" />
          Forge (leaderboard)
        </Button>
      </div>
      {(busy === "instant" || Object.values(gates).some((v) => v === "failed")) ? (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-background/40 p-3">
          <ol className="space-y-1.5 text-[11px]">
            {GATE_LABELS.map((g) => {
              const s = gates[g.key] ?? "idle";
              const Icon =
                s === "done" ? Check
                : s === "failed" ? X
                : s === "running" ? Loader2
                : null;
              const tone =
                s === "done" ? "text-emerald-400"
                : s === "failed" ? "text-red-400"
                : s === "running" ? "text-amber-300"
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
        </div>
      ) : null}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Instant cria um cliente fictício realista, gera o plano completo (com brief + blueprint + microciclo + progressões) e enche o logbook com a duração escolhida.
      </p>
    </div>
  );
}
